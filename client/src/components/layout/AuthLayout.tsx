'use client';

import { forwardRef } from 'react';

/* ---------------- Logo (Outfit viet tay + CRAFT co chan) ---------------- */
export function BrandLogo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  if (size === 'sm') {
    return (
      <span className="inline-flex items-baseline gap-1 leading-none text-white">
        <span className="font-script text-lg -rotate-3">Outfit</span>
        <span className="font-serif-display text-sm tracking-[0.2em]">CRAFT</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center leading-none text-[#1F453E]">
      <span className="relative z-10 mb-[-10px] font-script text-6xl -rotate-3 xl:text-7xl">
        Outfit
      </span>
      <span className="font-serif-display text-5xl font-normal tracking-[0.22em] xl:text-6xl">
        CRAFT
      </span>
    </div>
  );
}

/* ---------------- Khung chung: cot trai + card + footer ---------------- */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#FAF9F5] font-jakarta text-[#1F453E]">
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Branding panel */}
        <aside className="hidden flex-col justify-between border-r border-[#DFE6C5] bg-[#EBF0D6] p-10 lg:flex lg:w-[45%] xl:p-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1F453E]">
            Digital Atelier · Est. 2026
          </p>

          <div className="flex flex-col items-center text-center">
            <BrandLogo />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1F453E]">
              Wardrobe · Studio
            </p>
            <p className="mt-5 text-[15px] text-[#2C4C45]">Tủ đồ số và trợ lý phối đồ của bạn</p>
          </div>

          <p className="text-xs font-medium text-[#1F453E]">Đà Nẵng</p>
        </aside>

        {/* Form area */}
        <section className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 lg:w-[55%]">
          <div className="mb-8 lg:hidden">
            <BrandLogo />
          </div>
          <div className="w-full max-w-[420px] rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-10">
            {children}
          </div>
        </section>
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
type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, className = '', ...rest },
  ref
) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#1F453E]">{label}</span>
      <input
        ref={ref}
        className={`w-full rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-[#1F453E] focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  );
});

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
