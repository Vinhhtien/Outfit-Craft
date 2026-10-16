'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { restoreFitSaves, retryFitSaves, useFitSaves } from '@/store/fitSaveQueue';

/** Mounted above page navigation: failed saves remain visible after leaving Studio. */
export function FitSaveStatus() {
  const owner = useAuthStore((state) => state.user?.id);
  const expired = useAuthStore((state) => state.sessionExpired);
  const { jobs, storageError } = useFitSaves();
  const mine = Object.values(jobs).filter((job) => job.owner === owner);
  const error = mine.find((job) => job.error)?.error;
  useEffect(() => {
    if (!owner || expired) return;
    restoreFitSaves(owner);
    const retry = () => { void retryFitSaves(owner); };
    retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [owner, expired]);
  useEffect(() => {
    if (!mine.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [mine.length]);
  if (!owner || !mine.length || expired) return null;
  return <div role={error || storageError ? 'alert' : 'status'} className="fixed bottom-5 left-5 z-[90] max-w-sm rounded-xl border border-[#9EB0A8] bg-white p-4 text-sm text-[#1F453E] shadow-lg">
    <p>{error ? `Chưa lưu được vị trí của ${mine.length} món đồ. ${error}` : `Đang lưu vị trí của ${mine.length} món đồ…`}</p>
    {storageError && <p className="mt-2 text-red-700">{storageError}</p>}
    {error && <><p className="mt-2">Thay đổi vẫn được giữ để thử lại.</p><button type="button" className="mt-2 rounded border px-3 py-2 font-semibold" onClick={() => void retryFitSaves(owner)}>Thử lưu lại</button></>}
  </div>;
}
