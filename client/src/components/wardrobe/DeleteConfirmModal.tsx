'use client';

// ===== NEW: Delete Confirmation Popup =====
import { useEffect } from 'react';

/**
 * Popup xac nhan xoa - thay cho window.confirm() cua trinh duyet.
 * Dung chung cho trang Tu do va trang Lich (tuy bien title/description qua prop).
 */
export function DeleteConfirmModal({
  open,
  title = 'Xóa món đồ?',
  description,
  confirmLabel = 'Xác nhận xóa',
  deleting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  /** Dang goi API xoa -> khoa nut, khong cho dong popup. */
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Bam Esc de dong popup.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, deleting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        className="w-full max-w-sm rounded-2xl border border-[#1F453E]/20 bg-[#FAF9F5] p-6 font-jakarta text-[#1F453E] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-confirm-title"
          className="font-serif-display text-xl font-semibold text-[#1F453E]"
        >
          {title}
        </h2>
        <p id="delete-confirm-desc" className="mt-2 text-sm text-[#6B7B76]">
          {description}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-full border border-[#1F453E]/40 bg-transparent px-5 py-2 text-sm font-semibold text-[#1F453E] transition-colors hover:bg-[#E2ECC8]/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            autoFocus
            className="rounded-full bg-[#8C2D19] px-5 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
// ===== END NEW =====
