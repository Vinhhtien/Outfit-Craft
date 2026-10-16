'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Navbar } from './Navbar';

/**
 * Bao boc cac trang can dang nhap: chan render cho den khi xac thuc xong.
 * `fullBleed`: trang tu quan ly be rong/padding (vd. banner tran vien o /wardrobe).
 * `hideFooter`: an footer chung.
 */
export function ProtectedLayout({
  children,
  fullBleed,
  hideFooter,
}: {
  children: React.ReactNode;
  fullBleed?: boolean;
  hideFooter?: boolean;
}) {
  const { user, isLoading, hydrateError, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hydrateError && !user) router.replace('/login');
  }, [isLoading, hydrateError, user, router]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Đang khôi phục phiên đăng nhập…" />
      </div>
    );
  }

  if (hydrateError) return <main className="mx-auto max-w-xl p-8"><ErrorState message={hydrateError} onRetry={() => void hydrate()} /></main>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {fullBleed ? (
        <main className="flex flex-1 flex-col">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      )}
      {!hideFooter && (
        <footer className="border-t border-[#16352F] bg-[#1F453E] px-8 py-8 font-jakarta text-white">
          <div className="mx-auto max-w-6xl">
            <p className="flex items-baseline leading-none">
              <span className="font-script text-3xl text-[#E2ECC8]">Outfit</span>
              <span className="ml-1.5 font-serif-display text-xl tracking-[0.2em] text-white">CRAFT</span>
            </p>
            <p className="mt-3 text-sm text-white/80">Mỗi món đồ cũ là một câu chuyện mới.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
