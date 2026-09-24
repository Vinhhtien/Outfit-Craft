'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shirt } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';

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
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary)] text-white">
            <Shirt size={22} />
          </span>
          <h1 className="text-2xl font-semibold">Tạo tài khoản</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Tên hiển thị" required value={form.displayName} onChange={set('displayName')} />
          <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
          <Input
            label="Mật khẩu"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={set('password')}
            placeholder="Tối thiểu 6 ký tự"
          />
          <Input
            label="Thành phố (cho gợi ý thời tiết)"
            value={form.defaultCity}
            onChange={set('defaultCity')}
            placeholder="Hanoi"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Đăng ký
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-medium text-[var(--primary)]">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
