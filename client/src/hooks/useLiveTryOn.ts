'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealTimeClient } from '@decartai/sdk';
import { tryOnApi } from '@/lib/services';
import {
  apiFailure, cameraFailure, cameraLostFailure, connectionFailure, sessionEndedFailure, setupRejectedFailure,
  unsupportedFailure, type TryOnFailure,
} from '@/lib/tryOnErrors';
import { captureVideoFrame, garmentImageBlob, waitForVideoFrame } from '@/lib/tryOnMedia';
import type { ClothingItem, TryOnQuota } from '@/types';

const MODEL = 'lucy-vton-latest';
const HEARTBEAT_MS = 10_000;
/** Roi tab qua lau thi tu dung, tranh bi tinh tien khi khong ai xem. */
const BACKGROUND_STOP_MS = 30_000;

export type TryOnStatus = 'idle' | 'preparing' | 'connecting' | 'live' | 'reconnecting' | 'ended';
export type TryOnEnd =
  | { reason: 'user' | 'limit' | 'closed' | 'background' }
  | { reason: 'failure'; failure: TryOnFailure };

interface Garment { prompt: string; image: Blob }

/** Toan bo tai nguyen cua 1 lan bat dau. Moi callback bat dong bo phai kiem tra run.stopped. */
interface Run {
  stopped: boolean;
  stream: MediaStream | null;
  client: RealTimeClient | null;
  sessionId: string | null;
  live: boolean;
  maxSeconds: number;
  deadline: number;
  heartbeat?: ReturnType<typeof setInterval>;
  ticker?: ReturnType<typeof setInterval>;
  tokenError?: unknown;
  /** set() lan luot: lenh sau khong chen ngang lenh truoc, lenh da cu thi bo qua. */
  setQueue: Promise<void>;
}

/** In thanh chuoi de doc va copy duoc. Loi da hien tren panel nen khong dung console.error. */
function logSdk(message: string, data?: Record<string, unknown>) {
  let detail = '';
  try { detail = data ? ` ${JSON.stringify(data)}` : ''; } catch { /* du lieu log khong serialize duoc */ }
  console.warn(`[DecartSDK] ${message}${detail}`);
}
const sdkLogger = { debug: () => undefined, info: () => undefined, warn: logSdk, error: logSdk };

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

function attach(video: HTMLVideoElement | null, stream: MediaStream) {
  if (!video) return;
  video.srcObject = stream;
  void video.play().catch(() => undefined);
}

/** Dung camera, dong ket noi, chot thoi luong o backend. Goi nhieu lan van an toan. */
function release(run: Run, onQuota?: (quota: TryOnQuota) => void, pageClosing = false) {
  if (run.stopped) return;
  run.stopped = true;
  clearInterval(run.heartbeat);
  clearInterval(run.ticker);
  try { run.client?.disconnect(); } catch { /* ket noi da dong tu truoc */ }
  if (run.stream) stopTracks(run.stream);
  if (!run.sessionId) return;
  if (pageClosing) tryOnApi.endOnPageHide(run.sessionId);
  else void tryOnApi.end(run.sessionId).then((quota) => onQuota?.(quota)).catch(() => undefined);
}

export function useLiveTryOn() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const runRef = useRef<Run | null>(null);
  const garments = useRef(new Map<string, Garment>());
  const swapSeq = useRef(0);

  const [status, setStatus] = useState<TryOnStatus>('idle');
  const [end, setEnd] = useState<TryOnEnd | null>(null);
  const [activeItem, setActiveItem] = useState<ClothingItem | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [waitingCapacity, setWaitingCapacity] = useState(false);
  const [clock, setClock] = useState({ elapsed: 0, total: 0 });
  const [quota, setQuota] = useState<TryOnQuota | null>(null);

  const finish = useCallback((run: Run, ended: TryOnEnd, pageClosing = false) => {
    if (runRef.current !== run) return;
    runRef.current = null;
    release(run, setQuota, pageClosing);
    swapSeq.current += 1;
    for (const video of [localVideoRef.current, remoteVideoRef.current]) {
      if (video) video.srcObject = null;
    }
    setSwappingId(null);
    setWaitingCapacity(false);
    setEnd(ended);
    setStatus('ended');
  }, []);

  const loadGarment = useCallback(async (item: ClothingItem, frame?: Blob | null): Promise<Garment> => {
    const known = garments.current.get(item._id);
    if (known) return known;
    const [{ prompt }, image] = await Promise.all([tryOnApi.prompt(item._id, frame), garmentImageBlob(item.imageUrl)]);
    const garment = { prompt, image };
    garments.current.set(item._id, garment);
    return garment;
  }, []);

  const start = useCallback(async (item: ClothingItem, shareFrame: boolean) => {
    if (runRef.current) return;
    const unsupported = unsupportedFailure({
      secure: window.isSecureContext,
      media: Boolean(navigator.mediaDevices?.getUserMedia),
      webrtc: 'RTCPeerConnection' in window,
    });
    if (unsupported) {
      setEnd({ reason: 'failure', failure: unsupported });
      setStatus('ended');
      return;
    }

    const run: Run = {
      stopped: false, stream: null, client: null, sessionId: null,
      live: false, maxSeconds: 0, deadline: 0, setQueue: Promise.resolve(),
    };
    runRef.current = run;
    setEnd(null);
    setActiveItem(item);
    setClock({ elapsed: 0, total: 0 });
    setStatus('preparing');

    let classify: (err: unknown) => TryOnFailure = apiFailure;
    try {
      const { createDecartClient, models } = await import('@decartai/sdk');
      if (run.stopped) return;
      const model = models.realtime(MODEL);
      const portrait = window.matchMedia('(orientation: portrait)').matches;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            frameRate: model.fps,
            width: { ideal: portrait ? model.height : model.width },
            height: { ideal: portrait ? model.width : model.height },
          },
        });
      } catch (err) {
        finish(run, { reason: 'failure', failure: cameraFailure(err) });
        return;
      }
      if (run.stopped) { stopTracks(stream); return; }
      run.stream = stream;
      attach(localVideoRef.current, stream);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        finish(run, { reason: 'failure', failure: cameraLostFailure });
      });

      const session = await tryOnApi.startSession();
      if (run.stopped) { void tryOnApi.end(session.sessionId).catch(() => undefined); return; }
      run.sessionId = session.sessionId;
      run.maxSeconds = session.maxSeconds;
      setClock({ elapsed: 0, total: session.maxSeconds });

      const beat = () => {
        void tryOnApi.heartbeat(session.sessionId, run.live).then((result) => {
          if (run.stopped) return;
          if (!result.active) finish(run, { reason: 'closed' });
          else if (run.live) run.deadline = Date.now() + result.remainingSeconds * 1000;
        }).catch(() => undefined);
      };
      run.heartbeat = setInterval(beat, HEARTBEAT_MS);

      const local = localVideoRef.current;
      if (shareFrame && local) await waitForVideoFrame(local);
      const frame = shareFrame ? await captureVideoFrame(local, 0.8) : null;
      const garment = await loadGarment(item, frame);
      if (run.stopped) return;

      const markLive = () => {
        if (run.live) return;
        run.live = true;
        run.deadline = Date.now() + run.maxSeconds * 1000;
        beat();
        run.ticker = setInterval(() => {
          const left = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
          setClock({ elapsed: run.maxSeconds - left, total: run.maxSeconds });
          if (left <= 0) finish(run, { reason: 'limit' });
        }, 500);
      };

      classify = () => (run.tokenError ? apiFailure(run.tokenError) : connectionFailure);
      const decart = createDecartClient({
        telemetry: false,
        logger: sdkLogger,
        apiKeyProvider: async () => {
          try {
            const token = await tryOnApi.token(session.sessionId);
            run.tokenError = undefined;
            return token.apiKey;
          } catch (err) {
            run.tokenError = err;
            throw err;
          }
        },
      });

      setStatus('connecting');
      const client = await decart.realtime.connect(stream, {
        model,
        // Webcam may tinh khong bao facingMode, ma day luon la camera truoc.
        mirror: true,
        onRemoteStream: (remote) => { if (!run.stopped) attach(remoteVideoRef.current, remote); },
        onCapacityWait: () => setWaitingCapacity(true),
        onConnectionChange: (state) => {
          if (run.stopped) return;
          if (state === 'generating') {
            setWaitingCapacity(false);
            markLive();
            setStatus('live');
          } else if (state === 'reconnecting') {
            setStatus('reconnecting');
          } else if (state === 'disconnected' && run.client) {
            // sessionEnded phat ngay sau trang thai nay va mang ly do cu the hon.
            setTimeout(() => finish(run, { reason: 'failure', failure: classify(null) }), 0);
          }
        },
        initialState: { prompt: { text: garment.prompt, enhance: false }, image: garment.image },
      });
      if (run.stopped) { client.disconnect(); return; }
      run.client = client;
      client.on('sessionEnded', ({ reason }) => finish(run, { reason: 'failure', failure: sessionEndedFailure(reason) }));
      client.on('error', (err) => {
        const rejected = run.live ? null : setupRejectedFailure(err.code);
        if (rejected) {
          console.warn(`[try-on] Decart tu choi "${item.name}": ${err.message} | prompt: ${garment.prompt}`);
          finish(run, { reason: 'failure', failure: rejected });
        } else if (client.getConnectionState() === 'disconnected') {
          finish(run, { reason: 'failure', failure: classify(null) });
        }
      });
    } catch (err) {
      finish(run, { reason: 'failure', failure: classify(err) });
    }
  }, [finish, loadGarment]);

  const stop = useCallback(() => {
    if (runRef.current) finish(runRef.current, { reason: 'user' });
  }, [finish]);

  /** Doi mon tren ket noi dang chay. set() thay toan bo state nen luon gui du prompt, image, enhance. */
  const swap = useCallback(async (item: ClothingItem) => {
    const run = runRef.current;
    const client = run?.client;
    if (!run || !client || !run.live) return;
    const seq = ++swapSeq.current;
    setSwappingId(item._id);
    try {
      const garment = await loadGarment(item);
      const superseded = () => seq !== swapSeq.current || run.stopped;
      if (superseded()) return;
      const applied = run.setQueue.catch(() => undefined).then(async () => {
        if (superseded()) return;
        await client.set({ prompt: garment.prompt, image: garment.image, enhance: false });
        if (!superseded()) setActiveItem(item);
      });
      run.setQueue = applied;
      await applied;
    } finally {
      if (seq === swapSeq.current) setSwappingId(null);
    }
  }, [loadGarment]);

  useEffect(() => {
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      clearTimeout(hiddenTimer);
      if (document.visibilityState !== 'hidden') return;
      hiddenTimer = setTimeout(() => {
        if (runRef.current) finish(runRef.current, { reason: 'background' });
      }, BACKGROUND_STOP_MS);
    };
    const onPageHide = () => {
      if (runRef.current) finish(runRef.current, { reason: 'background' }, true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      // Dong panel hoac chuyen trang: khong de lot camera va ket noi dang tinh tien.
      const run = runRef.current;
      runRef.current = null;
      if (run) release(run);
    };
  }, [finish]);

  return {
    localVideoRef, remoteVideoRef, status, end, activeItem, swappingId, waitingCapacity, clock, quota,
    start, stop, swap,
  };
}
