'use client';
import { VButton, VSpinner } from './vintage';

export function LoadingState({ label = 'Đang tải dữ liệu…', compact = false }: { label?: string; compact?: boolean }) {
  return <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 text-sm text-[#52665F] ${compact ? 'py-3' : 'min-h-48 py-12'}`}><VSpinner /><span>{label}</span></div>;
}
export function ErrorState({ message, onRetry, busy = false }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return <div role="alert" className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5A99E] bg-[#FDF2F0] p-4 text-sm text-[#8C2D19]"><p>{message}</p>{onRetry && <VButton variant="outline" onClick={onRetry} disabled={busy}>Thử lại</VButton>}</div>;
}
export function CardSkeletons({ count = 10 }: { count?: number }) {
  return <div role="status" aria-label="Đang tải danh sách" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"><span className="sr-only">Đang tải danh sách…</span>{Array.from({ length: count }, (_, i) => <div key={i} aria-hidden="true" className="rounded-xl border border-[#CBD5E1] bg-white p-3"><div className="aspect-square animate-pulse rounded-lg bg-[#E9EDE5] motion-reduce:animate-none" /><div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[#E9EDE5] motion-reduce:animate-none" /></div>)}</div>;
}
