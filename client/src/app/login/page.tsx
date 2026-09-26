'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { AuthLayout, AuthField, AuthSubmitButton, AuthTabs } from '@/components/layout/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/wardrobe');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
        Đăng nhập OutfitCraft
      </h1>
      <p className="mb-5 mt-1.5 text-center text-[13px] text-[#71807B]">
        Tủ đồ số và trợ lý phối đồ của bạn
      </p>

      <AuthTabs active="login" />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AuthField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
          />
          <AuthField
            label="Mật khẩu"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <AuthSubmitButton loading={loading}>Đăng nhập</AuthSubmitButton>
      </form>

      <p className="mt-5 text-center text-xs text-[#71807B]">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-semibold text-[#1F453E] underline underline-offset-2">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
}
