'use client';
import { useCallback, useState } from 'react';
import { Camera, RotateCcw, ShieldCheck, Square, Trash2, Video } from 'lucide-react';
import { CloudImage } from '@/components/ui/CloudImage';
import { VButton, VModal, VSpinner, VToast } from '@/components/ui/vintage';
import { useLiveTryOn, type TryOnEnd, type TryOnStatus } from '@/hooks/useLiveTryOn';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/api';
import { itemApi, tryOnApi } from '@/lib/services';
import { captureVideoFrame } from '@/lib/tryOnMedia';
import type { ClothingItem, TryOnSnapshot } from '@/types';

/** Backend khong mo phien ngan hon muc nay. */
const MIN_SESSION_SECONDS = 10;

const clockText = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function durationText(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest} giây`;
  return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

const GUIDE_STATUS: Partial<Record<TryOnStatus, string>> = {
  preparing: 'Đang bật camera và chuẩn bị món đồ…',
  connecting: 'Đang kết nối tới phòng thử đồ…',
  reconnecting: 'Mất tín hiệu, đang kết nối lại…',
};

function endMessage(end: TryOnEnd | null): string {
  switch (end?.reason) {
    case 'limit': return 'Đã hết thời lượng của phiên này.';
    case 'closed': return 'Phiên đã kết thúc vì hết thời lượng hoặc được mở ở tab khác.';
    case 'background': return 'Đã tự dừng vì bạn rời khỏi trang.';
    case 'failure': return end.failure.message;
    default: return 'Đã dừng thử đồ. Camera đã tắt.';
  }
}

/** Khung nguoi + loi nhac trong luc cho ket noi. */
function BodyGuide({ status, queued }: { status: TryOnStatus; queued: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#10241F]/35 p-4 text-center text-white">
      <svg viewBox="0 0 200 460" aria-hidden className="h-[62%] min-h-0 text-white/85">
        <g fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="3" strokeDasharray="9 7" strokeLinejoin="round">
          <circle cx="100" cy="46" r="34" />
          <path d="M72 96C52 102 40 112 36 134L22 262Q20 280 34 282Q44 282 46 266L58 160L62 250L58 440Q58 452 72 452L86 452Q96 452 96 440L100 276L104 440Q104 452 114 452L128 452Q142 452 142 440L138 250L142 160L154 266Q156 282 166 282Q180 280 178 262L164 134C160 112 148 102 128 96Q100 110 72 96Z" />
        </g>
      </svg>
      <p className="font-serif-display text-xl font-semibold sm:text-2xl">Lùi lại để thấy toàn thân</p>
      <div className="inline-flex items-center gap-2 text-xs font-medium text-white/85">
        <VSpinner className="h-3.5 w-3.5 border-white border-t-transparent" />
        <span role="status">{queued ? 'Máy chủ đang bận, đang xếp hàng cho bạn…' : GUIDE_STATUS[status]}</span>
      </div>
    </div>
  );
}

export function LiveTryOnModal({ item, onClose }: { item: ClothingItem; onClose: () => void }) {
  const {
    localVideoRef, remoteVideoRef, status, end, activeItem, swappingId, waitingCapacity, clock, quota,
    start, stop, swap,
  } = useLiveTryOn();
  const [shareFrame, setShareFrame] = useState(false);
  const [tab, setTab] = useState<'items' | 'snapshots'>('items');
  const [capturing, setCapturing] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const loadQuota = useCallback((signal: AbortSignal) => tryOnApi.quota(signal), []);
  const loadItems = useCallback((signal: AbortSignal) => itemApi.list({ limit: 100 }, signal).then((r) => r.data), []);
  const loadSnapshots = useCallback((signal: AbortSignal) => tryOnApi.snapshots(signal), []);
  const quotaResource = useResource(loadQuota);
  const itemsResource = useResource(loadItems);
  const snapshotsResource = useResource(loadSnapshots);
  const setSnapshots = snapshotsResource.setData;

  const currentQuota = quota ?? quotaResource.data;
  const items = itemsResource.data ?? [];
  const strip = items.some((entry) => entry._id === item._id) ? items : [item, ...items];
  const snapshots = snapshotsResource.data ?? [];

  const outOfTime = currentQuota ? currentQuota.remainingSeconds < MIN_SESSION_SECONDS : false;
  const notConfigured = currentQuota ? !currentQuota.configured : false;
  const started = status !== 'idle';
  const live = status === 'live';
  const ended = status === 'ended';
  const running = started && !ended;
  const wearing = activeItem ?? item;
  const quotaFailure = end?.reason === 'failure' && end.failure.kind === 'quota';

  const handleSwap = (next: ClothingItem) => {
    if (next._id === wearing._id) return;
    swap(next).catch((err) => setToast({ message: `Chưa đổi được món đồ. ${getErrorMessage(err)}`, variant: 'error' }));
  };

  const takeSnapshot = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const image = await captureVideoFrame(remoteVideoRef.current);
      if (!image) throw new Error('Chưa có hình để chụp. Vui lòng thử lại sau giây lát.');
      const saved = await tryOnApi.saveSnapshot(image, wearing._id);
      setSnapshots((list) => [saved, ...(list ?? [])]);
      setToast({ message: 'Đã lưu ảnh vào lịch sử thử đồ.', variant: 'success' });
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setCapturing(false);
    }
  };

  const removeSnapshot = async (snapshot: TryOnSnapshot) => {
    try {
      await tryOnApi.removeSnapshot(snapshot._id);
      setSnapshots((list) => (list ?? []).filter((entry) => entry._id !== snapshot._id));
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    }
  };

  return (
    <VModal open onClose={onClose} title="Thử đồ trực tiếp" serifTitle extraWide>
      {!started && (
        <div className="mx-auto max-w-xl space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#F8F9F5] p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white p-1">
              <CloudImage src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-[#52665F]">Xem chính bạn mặc món này ngay trên camera.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1F453E]/20 p-4 text-sm leading-relaxed text-[#2C4C45]">
            <p className="mb-2 flex items-center gap-2 font-bold text-[#1F453E]">
              <ShieldCheck size={16} /> Trước khi bật camera
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Video webcam của bạn được gửi tới <b>Decart</b>, một dịch vụ AI bên thứ ba, để xử lý theo thời gian thực và <b>không được lưu lại</b>.</li>
              <li>Ảnh món đồ được gửi tới Decart và Google Gemini để tạo hình mặc thử.</li>
              <li>Ảnh chỉ được lưu vào tài khoản của bạn khi bạn bấm <b>Chụp ảnh</b>, và bạn có thể xóa bất cứ lúc nào.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm text-[#1F453E]">
            <input
              type="checkbox"
              checked={shareFrame}
              onChange={(event) => setShareFrame(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1F453E]"
            />
            <span>
              Cho phép gửi 1 khung hình từ camera tới Google Gemini để mô tả món đồ chính xác hơn (tùy chọn).
              OutfitCraft không lưu khung hình này.
            </span>
          </label>

          {currentQuota && !notConfigured && (
            <p className="text-xs text-[#52665F]">
              Mỗi phiên tối đa {durationText(currentQuota.maxSessionSeconds)}. Hôm nay bạn còn {durationText(currentQuota.remainingSeconds)}.
            </p>
          )}
          {notConfigured && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Tính năng thử đồ trực tiếp chưa sẵn sàng. Vui lòng thử lại sau.</p>
          )}
          {outOfTime && !notConfigured && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Bạn đã dùng hết thời lượng thử đồ trực tiếp hôm nay. Hãy quay lại vào ngày mai nhé.</p>
          )}
          {quotaResource.error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{quotaResource.error}</p>
          )}

          <div className="flex gap-2">
            <VButton variant="outline" onClick={onClose} className="flex-1">Để sau</VButton>
            <VButton onClick={() => void start(item, shareFrame)} disabled={!currentQuota || outOfTime || notConfigured} className="flex-1">
              <Video size={15} /> Đồng ý và bật camera
            </VButton>
          </div>
        </div>
      )}

      <div className={started ? 'space-y-3' : 'hidden'}>
        <div className="relative h-[56dvh] max-h-[580px] overflow-hidden rounded-xl bg-[#10241F]">
          {/* Xem truoc camera cua user, lat nhu soi guong. Luong ket qua da duoc SDK lat san. */}
          <video
            ref={localVideoRef}
            muted autoPlay playsInline aria-hidden
            className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity ${running && !live ? 'opacity-70' : 'opacity-0'}`}
          />
          <video
            ref={remoteVideoRef}
            muted autoPlay playsInline
            aria-label={`Video bạn đang mặc ${wearing.name}`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity ${live ? 'opacity-100' : 'opacity-0'}`}
          />
          {running && !live && <BodyGuide status={status} queued={waitingCapacity} />}
          {ended && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              <p role="alert" className="max-w-md text-sm leading-relaxed">{endMessage(end)}</p>
              {!quotaFailure && !outOfTime ? (
                <button
                  type="button"
                  onClick={() => void start(wearing, false)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-bold text-[#1F453E] hover:bg-[#E2ECC8]"
                >
                  <RotateCcw size={14} /> Bắt đầu lại
                </button>
              ) : (
                <p className="text-xs text-white/80">Bạn đã dùng hết thời lượng hôm nay.</p>
              )}
            </div>
          )}
          {live && swappingId && (
            <p role="status" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              Đang đổi món…
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p role="timer" className="font-mono text-sm font-bold tabular-nums">
              {clockText(clock.elapsed)} <span className="font-normal text-[#6B7B76]">/ {clockText(clock.total)}</span>
            </p>
            <p className="truncate text-xs text-[#52665F]">Đang thử: {wearing.name}</p>
          </div>
          <div className="flex gap-2">
            <VButton variant="outline" onClick={() => void takeSnapshot()} disabled={!live} loading={capturing}>
              <Camera size={15} /> Chụp ảnh
            </VButton>
            <VButton onClick={stop} disabled={!running}>
              <Square size={13} /> Dừng
            </VButton>
          </div>
        </div>

        <div>
          <div role="tablist" className="mb-2 flex gap-1 border-b border-[#E2ECC8]">
            {([['items', 'Đổi món'], ['snapshots', `Ảnh đã chụp (${snapshots.length})`]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-bold ${tab === value ? 'border-[#1F453E] text-[#1F453E]' : 'border-transparent text-[#6B7B76]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'items' ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {itemsResource.error && <p className="text-xs text-red-700">{itemsResource.error}</p>}
              {strip.map((entry) => (
                <button
                  key={entry._id}
                  type="button"
                  onClick={() => handleSwap(entry)}
                  disabled={!live}
                  aria-pressed={entry._id === wearing._id}
                  title={entry.name}
                  className={`relative grid h-20 w-20 shrink-0 place-items-center rounded-lg border-2 bg-[#F8F9F5] p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                    entry._id === wearing._id ? 'border-[#1F453E]' : 'border-[#E2E8F0] hover:border-[#869BB2]'
                  }`}
                >
                  <CloudImage src={entry.imageUrl} alt={entry.name} className="max-h-full max-w-full object-contain" />
                  {swappingId === entry._id && (
                    <span className="absolute inset-0 grid place-items-center rounded-md bg-white/70"><VSpinner /></span>
                  )}
                </button>
              ))}
            </div>
          ) : snapshots.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#6B7B76]">Chưa có ảnh nào. Bấm &ldquo;Chụp ảnh&rdquo; khi đang thử đồ để lưu lại.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {snapshots.map((snapshot) => (
                <div key={snapshot._id} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#10241F]">
                  <a href={snapshot.imageUrl} target="_blank" rel="noreferrer" title={snapshot.itemName ?? 'Ảnh thử đồ'}>
                    <CloudImage src={snapshot.imageUrl} alt={snapshot.itemName ?? 'Ảnh thử đồ'} className="h-full w-full object-cover" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void removeSnapshot(snapshot)}
                    title="Xóa ảnh"
                    aria-label="Xóa ảnh"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-red-500 shadow hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <VToast message={toast?.message ?? null} variant={toast?.variant} duration={3000} onClose={closeToast} />
    </VModal>
  );
}
