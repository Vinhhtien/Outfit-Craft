'use client';

import { forwardRef } from 'react';
import { X } from 'lucide-react';
// ===== NEW: Update Profile =====
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
// ===== END NEW =====
// ===== NEW: Toast thay alert() =====
import { AlertCircle } from 'lucide-react';
// ===== END NEW =====

/*
 * Bo UI "Vintage Boutique" (xanh co vit #1F453E, xanh com #E2ECC8, nen kem #FAF9F5).
 * Tach rieng khoi components/ui de cac trang chua doi giao dien khong bi anh huong.
 */

/* ---------------- Button (dang vien thuoc) ---------------- */
type VButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline';
  loading?: boolean;
};

const V_BUTTON_VARIANTS: Record<NonNullable<VButtonProps['variant']>, string> = {
  primary: 'border-[#1F453E] bg-[#1F453E] text-white shadow-sm hover:bg-[#16352F]',
  outline: 'border-[#1F453E] bg-white text-[#1F453E] hover:bg-[#E2ECC8]/50',
};

export const VButton = forwardRef<HTMLButtonElement, VButtonProps>(function VButton(
  { variant = 'primary', loading, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${V_BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});

/* ---------------- Chip (nut loc / tag chon nhieu) ---------------- */
export function VChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-[#1F453E] bg-[#1F453E] text-white'
          : 'border-[#9EB0A8] bg-white text-[#1F453E] hover:bg-[#E2ECC8]/50'
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- Input / Select co label ---------------- */
const V_FIELD =
  'w-full rounded-lg border border-[#9EB0A8] bg-white px-3.5 py-2.5 text-sm text-[#1F453E] placeholder:text-[#6B7B76] transition-colors focus:border-[#1F453E] focus:outline-none';

export function VLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-[#1F453E]">{children}</span>;
}

type VInputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

export const VInput = forwardRef<HTMLInputElement, VInputProps>(function VInput(
  { label, className = '', ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <VLabel>{label}</VLabel>}
      <input ref={ref} className={`${V_FIELD} ${className}`} {...rest} />
    </label>
  );
});

type VSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

export const VSelect = forwardRef<HTMLSelectElement, VSelectProps>(function VSelect(
  { label, className = '', children, ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <VLabel>{label}</VLabel>}
      <select ref={ref} className={`${V_FIELD} ${className}`} {...rest}>
        {children}
      </select>
    </label>
  );
});

/* ---------------- Modal ---------------- */
export function VModal({
  open,
  onClose,
  title,
  children,
  wide,
  serifTitle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Tieu de font Serif (Playfair) thay vi Sans dam. */
  serifTitle?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1F453E]/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[#1F453E]/20 bg-white p-6 font-jakarta text-[#1F453E] shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            className={
              serifTitle
                ? 'font-serif-display text-xl font-semibold text-[#1F453E]'
                : 'text-lg font-bold'
            }
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Đóng"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#CBD5E1] text-[#6B7B76] transition-colors hover:border-[#1F453E] hover:text-[#1F453E]"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ===== NEW: Update Profile =====
/* ---------------- Toast (thong bao nho goc duoi man hinh, tu an) ---------------- */
export function VToast({
  message,
  onClose,
  duration = 3000,
  // ===== NEW: Toast thay alert() =====
  variant = 'success',
  // ===== END NEW =====
}: {
  /** null/'' -> an toast. */
  message: string | null;
  onClose: () => void;
  duration?: number;
  // ===== NEW: Toast thay alert() =====
  /** success: vien + icon xanh reu; error: chu + icon do tram. */
  variant?: 'success' | 'error';
  // ===== END NEW =====
}) {
  const isError = variant === 'error';

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 transition-all duration-300 ${
        message ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      {/* ===== NEW: Toast thay alert() ===== nen kem, mau theo variant */}
      {message && (
        <div
          role={isError ? 'alert' : undefined}
          className={`flex w-max max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border bg-[#FAF9F5] px-5 py-2.5 font-jakarta text-sm font-semibold shadow-lg ${
            isError ? 'border-[#8C2D19]/40 text-[#8C2D19]' : 'border-[#1F453E] text-[#1F453E]'
          }`}
        >
          {isError ? (
            <AlertCircle size={16} className="shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0" />
          )}
          {message}
        </div>
      )}
    </div>
  );
}
// ===== END NEW =====

/* ---------------- Spinner ---------------- */
export function VSpinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-[#1F453E] border-t-transparent ${className}`}
    />
  );
}
