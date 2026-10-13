'use client';

import { forwardRef, useId } from 'react';
import Link from 'next/link';
import { ScallopBanner } from './ScallopBanner';

/* ---------------- Logo (Outfit viet tay + CRAFT co chan, xep ngang) ---------------- */
export function BrandLogo({ size = 'md' }: { size?: 'md' | 'sm' }) {
  if (size === 'sm') {
    return (
      <span className="inline-flex items-baseline gap-1 leading-none text-white">
        <span className="font-script text-lg -rotate-3">Outfit</span>
        <span className="font-serif-display text-sm tracking-[0.2em]">CRAFT</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-2 leading-none text-[#1F453E]">
      <span className="font-script text-3xl -rotate-3 sm:text-4xl">Outfit</span>
      <span className="font-serif-display text-xl font-normal tracking-[0.2em] sm:text-2xl">
        CRAFT
      </span>
    </span>
  );
}

/* ---------------- Khung chung: banner + card + footer ---------------- */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#FAF9F5] font-jakarta text-[#1F453E]">
      {/* Banner ke soc + vien luon song, dung chung voi /wardrobe */}
      <ScallopBanner innerClassName="items-center px-6 py-5 sm:px-8">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1F453E] sm:block">
            Digital Atelier · Est. 2026
          </p>
          <div className="col-start-2">
            <BrandLogo />
          </div>
          <p className="hidden text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1F453E] sm:block">
            Wardrobe · Studio
          </p>
        </div>
      </ScallopBanner>

      {/* Form area */}
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px] rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-10">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col items-center justify-between gap-3 bg-[#1F453E] px-8 py-3.5 text-xs text-white sm:min-h-14 sm:flex-row lg:px-14">
        <div className="flex items-center">
          <BrandLogo size="sm" />
          <span className="ml-4 text-white/80">© 2026 · FPT University Đà Nẵng</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#" className="text-white/90 transition hover:text-white">
            Điều khoản sử dụng
          </a>
          <a href="#" className="text-white/90 transition hover:text-white">
            Quyền riêng tư
          </a>
          <a href="#" className="text-white/90 transition hover:text-white">
            Hỗ trợ
          </a>
        </nav>
      </footer>
    </div>
  );
}

/* ---------------- Field (label + input) ---------------- */
// ===== ADDED: Validation ===== (prop `error` tuy chon: hien loi duoi input + doi vien do tram)
type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, error, className = '', ...rest },
  ref
) {
  const errorId = useId();
  const borderClass = error
    ? 'border-[#8C2D19] focus:border-[#8C2D19]'
    : 'border-[#E2E8F0] focus:border-[#1F453E]';

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#1F453E]">{label}</span>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border ${borderClass} bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:outline-none ${className}`}
        {...rest}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block font-sans text-[11px] text-[#8C2D19]">
          {error}
        </span>
      )}
    </label>
  );
});
// ===== END ADDED =====

/* ---------------- Nut submit dang vien thuoc ---------------- */
export function AuthSubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1F453E] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* ---------------- Tab chuyen Dang nhap / Dang ky (chi la 2 link dieu huong) ---------------- */
export function AuthTabs({ active }: { active: 'login' | 'register' }) {
  const tab = (isActive: boolean) =>
    `rounded-full py-2 text-center text-[11px] font-bold uppercase tracking-wider transition-colors ${
      isActive ? 'bg-[#1F453E] text-white shadow-xs' : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
    }`;

  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-[#E2E8F0] bg-[#FAF9F5] p-1">
      <Link href="/login" aria-current={active === 'login' ? 'page' : undefined} className={tab(active === 'login')}>
        Đăng nhập
      </Link>
      <Link href="/register" aria-current={active === 'register' ? 'page' : undefined} className={tab(active === 'register')}>
        Đăng ký
      </Link>
    </div>
  );
}
