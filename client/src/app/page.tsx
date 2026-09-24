'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/ui';

/** Trang goc: dieu huong theo trang thai dang nhap. */
export default function Home() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? '/wardrobe' : '/login');
  }, [user, isLoading, router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  );
}
