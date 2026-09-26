'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { AuthLayout, AuthField, AuthSubmitButton } from '@/components/layout/AuthLayout';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    defaultCity: 'Hanoi',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/wardrobe');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="mb-6 text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
        Tạo tài khoản
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AuthField label="Tên hiển thị" required value={form.displayName} onChange={set('displayName')} />
          <AuthField label="Email" type="email" required value={form.email} onChange={set('email')} />
          <AuthField
            label="Mật khẩu"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={set('password')}
            placeholder="Tối thiểu 6 ký tự"
          />
          <AuthField
            label="Thành phố (cho gợi ý thời tiết)"
            value={form.defaultCity}
            onChange={set('defaultCity')}
            placeholder="Hanoi"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <AuthSubmitButton loading={loading}>Đăng ký</AuthSubmitButton>
      </form>

      <p className="mt-5 text-center text-xs text-[#71807B]">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-semibold text-[#1F453E] underline underline-offset-2">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
