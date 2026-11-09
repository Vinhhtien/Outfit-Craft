import { env } from '../config/env.js';
import { ITryOnSession, TryOnEndReason, TryOnSession } from '../models/TryOnSession.js';
import { ApiError } from '../utils/ApiError.js';

const DECART_MODELS = ['lucy-vton-latest', 'lucy-vton-3.6'];
const TOKEN_TTL_SECONDS = 60;
/** Decart khong nhan maxSessionDuration duoi 10 giay. */
const MIN_SESSION_SECONDS = 10;
/** Khong nhan heartbeat qua khoang nay thi coi nhu tab da mat. Client gui moi 10 giay. */
const SILENCE_SECONDS = 30;

export interface TryOnQuota {
  configured: boolean;
  dailySeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  maxSessionSeconds: number;
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});
export const tryOnDayKey = (date: Date) => dayFormat.format(date);

function quotaError() {
  const error = new ApiError(403, 'Bạn đã dùng hết thời lượng thử đồ trực tiếp hôm nay. Hãy quay lại vào ngày mai nhé.');
  error.code = 'TRYON_QUOTA_EXCEEDED';
  return error;
}

function sessionOverError() {
  const error = ApiError.conflict('Phiên thử đồ này đã kết thúc. Vui lòng bắt đầu phiên mới.');
  error.code = 'TRYON_SESSION_OVER';
  return error;
}

/** Tinh tu luc video ghep do chay; thoi gian ket noi va cho may chu khong bi tinh. */
function secondsUsed(session: ITryOnSession, until: Date): number {
  if (!session.activatedAt) return 0;
  const elapsed = Math.ceil((until.getTime() - session.activatedAt.getTime()) / 1000);
  return Math.min(session.maxSeconds, Math.max(0, elapsed));
}

/** Da lay token nhung bien mat truoc khi bao video chay: van co the da chay, tinh mot khoang ngan. */
const unconfirmedSeconds = (session: ITryOnSession) =>
  session.activatedAt || !session.tokenIssuedAt ? 0 : Math.min(SILENCE_SECONDS, session.maxSeconds);

async function closeSession(session: ITryOnSession, usedSeconds: number, reason: TryOnEndReason, now: Date) {
  await TryOnSession.updateOne(
    { _id: session._id, status: 'active' },
    { $set: { status: 'ended', usedSeconds, endedAt: now, endReason: reason } }
  );
}

/** Dong cac phien tab da mat ket noi. Tinh gio den lan cuoi con thay tin hieu + thoi gian cho. */
async function settleSilentSessions(owner: string, now: Date) {
  const silent = await TryOnSession.find({
    owner, status: 'active', lastSeenAt: { $lt: new Date(now.getTime() - SILENCE_SECONDS * 1000) },
  });
  await Promise.all(silent.map((session) => {
    const lastHeard = new Date(session.lastSeenAt.getTime() + SILENCE_SECONDS * 1000);
    return closeSession(session, secondsUsed(session, lastHeard) + unconfirmedSeconds(session), 'abandoned', now);
  }));
}

async function readQuota(owner: string, now: Date): Promise<TryOnQuota> {
  const sessions = await TryOnSession.find({ owner, dayKey: tryOnDayKey(now) }).select('usedSeconds').lean();
  const usedSeconds = sessions.reduce((sum, session) => sum + session.usedSeconds, 0);
  return {
    configured: Boolean(env.decartKey),
    dailySeconds: env.tryOn.dailySeconds,
    usedSeconds,
    remainingSeconds: Math.max(0, env.tryOn.dailySeconds - usedSeconds),
    maxSessionSeconds: env.tryOn.maxSessionSeconds,
  };
}

export async function getTryOnQuota(owner: string, now = new Date()): Promise<TryOnQuota> {
  await settleSilentSessions(owner, now);
  return readQuota(owner, now);
}

export async function startTryOnSession(owner: string, now = new Date()) {
  if (!env.decartKey) throw new ApiError(503, 'Tính năng thử đồ trực tiếp chưa sẵn sàng. Vui lòng thử lại sau.');
  await settleSilentSessions(owner, now);

  // Tab khac dang mo phien: dong lai, lan heartbeat ke tiep cua tab do se tu dung.
  const running = await TryOnSession.find({ owner, status: 'active' });
  await Promise.all(running.map((session) =>
    closeSession(session, secondsUsed(session, now) + unconfirmedSeconds(session), 'replaced', now)
  ));

  const quota = await readQuota(owner, now);
  if (quota.remainingSeconds < MIN_SESSION_SECONDS) throw quotaError();
  const maxSeconds = Math.min(env.tryOn.maxSessionSeconds, quota.remainingSeconds);
  try {
    const session = await TryOnSession.create({ owner, dayKey: tryOnDayKey(now), maxSeconds, lastSeenAt: now });
    return { sessionId: session.id as string, maxSeconds };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw ApiError.conflict('Một phiên thử đồ khác vừa được mở. Vui lòng thử lại.');
    throw error;
  }
}

async function findActiveSession(owner: string, id: string) {
  const session = await TryOnSession.findOne({ _id: id, owner });
  if (!session) throw ApiError.notFound('Không tìm thấy phiên thử đồ.');
  return session.status === 'active' ? session : null;
}

/** Moi lan connect/reconnect 1 token moi. Decart tu cat phien khi het phan thoi gian con lai. */
export async function issueTryOnToken(owner: string, id: string, now = new Date()) {
  const session = await findActiveSession(owner, id);
  if (!session) throw sessionOverError();
  const remaining = session.maxSeconds - secondsUsed(session, now);
  if (remaining < MIN_SESSION_SECONDS) {
    await closeSession(session, secondsUsed(session, now), 'limit', now);
    throw sessionOverError();
  }

  // SDK chi la ESM trong khi server build ra CommonJS.
  const { createDecartClient } = await import('@decartai/sdk');
  let token;
  try {
    token = await createDecartClient({ apiKey: env.decartKey }).tokens.create({
      expiresIn: TOKEN_TTL_SECONDS,
      allowedModels: DECART_MODELS,
      allowedOrigins: [new URL(env.clientOrigin).origin],
      constraints: { realtime: { maxSessionDuration: remaining } },
    });
  } catch (error) {
    console.error('[try-on] Khong tao duoc client token:', (error as { code?: string }).code ?? 'unknown');
    throw new ApiError(502, 'Không kết nối được dịch vụ thử đồ. Vui lòng thử lại sau.');
  }

  await TryOnSession.updateOne({ _id: session._id }, { $set: { tokenIssuedAt: now, lastSeenAt: now } });
  return { apiKey: token.apiKey, expiresAt: token.expiresAt };
}

export async function recordTryOnHeartbeat(owner: string, id: string, live: boolean, now = new Date()) {
  const session = await findActiveSession(owner, id);
  if (!session) return { active: false, usedSeconds: 0, remainingSeconds: 0 };

  if (live && !session.activatedAt) session.activatedAt = now;
  const usedSeconds = secondsUsed(session, now);
  const remainingSeconds = session.maxSeconds - usedSeconds;
  if (remainingSeconds <= 0) {
    await closeSession(session, usedSeconds, 'limit', now);
    return { active: false, usedSeconds, remainingSeconds: 0 };
  }
  await TryOnSession.updateOne(
    { _id: session._id, status: 'active' },
    { $set: { lastSeenAt: now, usedSeconds, ...(session.activatedAt ? { activatedAt: session.activatedAt } : {}) } }
  );
  return { active: true, usedSeconds, remainingSeconds };
}

/** Goi lai nhieu lan van an toan (dong panel va pagehide co the cung ban). */
export async function endTryOnSession(owner: string, id: string, now = new Date()) {
  const session = await findActiveSession(owner, id);
  if (session) await closeSession(session, secondsUsed(session, now), 'user', now);
  return readQuota(owner, now);
}
