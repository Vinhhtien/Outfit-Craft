'use client';
import { create } from 'zustand';
type Notice = { id: string; message: string; variant: 'success' | 'error'; onClose: () => void };
export const useNotices = create<{ notices: Notice[]; add: (notice: Notice) => void; remove: (id: string) => void }>((set) => ({
  notices: [],
  add: (notice) => set((state) => ({ notices: [...state.notices.filter((item) => item.id !== notice.id), notice] })),
  remove: (id) => set((state) => ({ notices: state.notices.filter((item) => item.id !== id) })),
}));
export function NotificationViewport() {
  const notices = useNotices((state) => state.notices);
  return <div className="pointer-events-none fixed bottom-5 right-5 z-[110] flex max-w-[calc(100vw-2.5rem)] flex-col gap-2">{notices.slice(-3).map((notice) => <div key={notice.id} role={notice.variant === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[#FAF9F5] px-4 py-3 text-sm shadow-lg ${notice.variant === 'error' ? 'border-[#8C2D19]/40 text-[#8C2D19]' : 'border-[#1F453E]/30 text-[#1F453E]'}`}><p className="max-w-sm">{notice.message}</p><button type="button" aria-label="Đóng thông báo" className="shrink-0 px-1 font-semibold" onClick={notice.onClose}>×</button></div>)}</div>;
}
