'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage, isCancelled } from '@/lib/api';

/** Abort superseded reads and keep the last successful value while refreshing. */
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, delay = 0) {
  const userId = useAuthStore((state) => state.user?.id);
  const [snapshot, setSnapshot] = useState<{ owner?: string; value: T | null }>({ value: null });
  const data = snapshot.owner === userId ? snapshot.value : null;
  const setData = useCallback((next: SetStateAction<T | null>) => {
    setSnapshot((previous) => ({ owner: userId, value: typeof next === 'function'
      ? (next as (value: T | null) => T | null)(previous.owner === userId ? previous.value : null) : next }));
  }, [userId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const loaderRef = useRef(loader);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(async () => {
    if (!userId) return;
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const version = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await loaderRef.current(request.signal);
      if (!request.signal.aborted && version === sequence.current) setData(result);
    } catch (err) {
      if (!request.signal.aborted && version === sequence.current && !isCancelled(err)) setError(getErrorMessage(err));
    } finally {
      if (!request.signal.aborted && version === sequence.current) setLoading(false);
    }
  }, [userId, setData]);
  useEffect(() => {
    loaderRef.current = loader;
    // Reflect a changed query immediately while the debounce delays only the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    timer.current = setTimeout(() => void reload(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [loader, reload, delay]);
  return { data, setData, loading, error, reload };
}
