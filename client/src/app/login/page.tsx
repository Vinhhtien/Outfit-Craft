'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { AuthLayout, AuthField, AuthSubmitButton, AuthTabs } from '@/components/layout/AuthLayout';
// ===== ADDED: Validation =====
import { pickErrors, validateEmail, validatePassword } from '@/lib/authValidation';

type LoginField = 'email' | 'password';
// ===== END ADDED =====

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // ===== ADDED: Validation =====
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const clearFieldError = (k: LoginField) => setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  // ===== END ADDED =====

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ===== ADDED: Validation =====
    const errors = pickErrors<LoginField>({
      email: validateEmail(email),
      password: validatePassword(password),
    });
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0] as LoginField | undefined;
    if (firstInvalid) {
      ({ email: emailRef, password: passwordRef })[firstInvalid].current?.focus();
      return;
    }
    // ===== END ADDED =====

    setLoading(true);
    try {
      const user = await login(email, password);
      // Admin vao thang trang quan tri, nguoi dung thuong vao tu do.
      router.push(user.role === 'admin' ? '/admin' : '/wardrobe');
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

      {/* ADDED: Validation - noValidate de hien thong bao loi tuy bien thay cho tooltip mac dinh cua trinh duyet */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          <AuthField
            ref={emailRef}
            error={fieldErrors.email}
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError('email'); // ADDED: Validation
            }}
            placeholder="ban@example.com"
          />
          <AuthField
            ref={passwordRef}
            error={fieldErrors.password}
            label="Mật khẩu"
            type="password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError('password'); // ADDED: Validation
            }}
            placeholder="••••••"
          />
          {/* ===== NEW: Forgot Password ===== */}
          <div className="-mt-2 text-right">
            <Link href="/forgot-password" className="text-xs font-semibold text-[#1F453E] underline-offset-2 hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          {/* ===== END NEW ===== */}

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
