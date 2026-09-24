'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

/** Khoi phuc phien dang nhap tu token trong localStorage khi app khoi dong. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
