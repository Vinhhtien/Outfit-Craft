'use client';
import { create } from 'zustand';
import { itemApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from './authStore';
import type { ItemFit } from '@/types';

type Job = { owner: string; itemId: string; fit: ItemFit; error: string };
export const useFitSaves = create<{ jobs: Record<string, Job>; storageError: string }>(() => ({ jobs: {}, storageError: '' }));
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Map<string, Promise<void>>();
const keyFor = (owner: string) => `outfitcraft:pending-fits:${owner}`;
const jobKey = (owner: string, itemId: string) => `${owner}:${itemId}`;

function persist(owner: string) {
  try {
    const jobs = Object.values(useFitSaves.getState().jobs).filter((job) => job.owner === owner);
    if (jobs.length) window.sessionStorage.setItem(keyFor(owner), JSON.stringify(jobs));
    else window.sessionStorage.removeItem(keyFor(owner));
    useFitSaves.setState({ storageError: '' });
  } catch {
    useFitSaves.setState({ storageError: 'Trình duyệt không lưu được bản nháp. Hãy giữ trang mở đến khi lưu thành công.' });
  }
}

/** A single writer per item prevents an older request from finishing after a newer edit. */
async function drain(key: string) {
  while (true) {
    const job = useFitSaves.getState().jobs[key];
    const auth = useAuthStore.getState();
    if (!job || auth.user?.id !== job.owner || auth.sessionExpired) return;
    try {
      await itemApi.saveFit(job.itemId, job.fit);
      // A newer edit stays queued until its own request succeeds.
      if (useFitSaves.getState().jobs[key] === job) {
        const jobs = { ...useFitSaves.getState().jobs };
        delete jobs[key];
        useFitSaves.setState({ jobs });
      }
      persist(job.owner);
    } catch (error) {
      const latest = useFitSaves.getState().jobs[key];
      if (latest) useFitSaves.setState({ jobs: { ...useFitSaves.getState().jobs, [key]: { ...latest, error: getErrorMessage(error) } } });
      persist(job.owner);
      return;
    }
  }
}

function start(key: string): Promise<void> {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
  const active = running.get(key);
  if (active) return active;
  const promise = drain(key).finally(() => running.delete(key));
  running.set(key, promise);
  return promise;
}

export function queueFitSave(owner: string, itemId: string, fit: ItemFit, delay = 800) {
  if (useAuthStore.getState().user?.id !== owner) return;
  const key = jobKey(owner, itemId);
  useFitSaves.setState({ jobs: { ...useFitSaves.getState().jobs, [key]: { owner, itemId, fit: { ...fit }, error: '' } } });
  // Persist before the debounce, so navigation/reload cannot discard a pending edit.
  persist(owner);
  const previous = timers.get(key);
  if (previous) clearTimeout(previous);
  timers.set(key, setTimeout(() => { void start(key); }, delay));
}

export async function retryFitSaves(owner: string) {
  const keys = Object.keys(useFitSaves.getState().jobs).filter((key) => useFitSaves.getState().jobs[key].owner === owner);
  useFitSaves.setState((state) => ({ jobs: Object.fromEntries(Object.entries(state.jobs).map(([key, job]) => [key, job.owner === owner && job.error ? { ...job, error: '' } : job])) }));
  await Promise.all(keys.map(start));
}

export async function flushFitSaves(owner: string) {
  const keys = Object.entries(useFitSaves.getState().jobs)
    .filter(([, job]) => job.owner === owner && !job.error).map(([key]) => key);
  await Promise.all(keys.map(start));
}

export function restoreFitSaves(owner: string) {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(keyFor(owner)) ?? '[]');
    if (!Array.isArray(saved)) return;
    const jobs = { ...useFitSaves.getState().jobs };
    for (const job of saved) {
      if (job?.owner !== owner || typeof job.itemId !== 'string' || !job.fit ||
        typeof job.fit.category !== 'string' || typeof job.fit.anchorRef !== 'string' ||
        !['offsetX', 'offsetY', 'width', 'height'].every((field) => typeof job.fit[field] === 'number' && Number.isFinite(job.fit[field]))) continue;
      const key = jobKey(owner, job.itemId);
      jobs[key] ??= { owner, itemId: job.itemId, fit: job.fit, error: '' };
    }
    useFitSaves.setState({ jobs });
  } catch {
    useFitSaves.setState({ storageError: 'Không đọc được bản nháp vị trí món đồ. Hãy kiểm tra lại các thay đổi trong Studio.' });
  }
}
