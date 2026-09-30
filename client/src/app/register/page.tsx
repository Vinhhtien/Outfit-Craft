'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { AuthLayout, AuthField, AuthSubmitButton, AuthTabs } from '@/components/layout/AuthLayout';

/** Thoi gian cho giua 2 lan "Gui lai ma OTP". */
const RESEND_COOLDOWN_S = 60;

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const verifyRegistration = useAuthStore((s) => s.verifyRegistration);

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    defaultCity: 'Hanoi',
  });
  /** Email da chuan hoa server tra ve - dung cho buoc xac thuc OTP. */
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ---------- Step 1: gui form dang ky -> server gui OTP ---------- */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const email = await register(form);
      setPendingEmail(email);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_S);
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 2: xac thuc OTP -> tu dong dang nhap ---------- */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await verifyRegistration(pendingEmail, otp);
      router.push('/wardrobe');
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  // Server cho phep dang ky lai tai khoan dang cho xac thuc -> gui lai form = gui ma moi.
  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      await register(form);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_S);
      setInfo('Đã gửi mã OTP mới, vui lòng kiểm tra email.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const backToForm = () => {
    setStep('form');
    setOtp('');
    setError('');
    setInfo('');
  };

  if (step === 'otp') {
    return (
      <AuthLayout>
        <h1 className="mb-2 text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
          Xác thực Email
        </h1>
        <p className="mb-6 text-center text-sm leading-relaxed text-[#71807B]">
          Mã xác nhận 6 số đã được gửi đến email{' '}
          <span className="font-semibold break-all text-[#1F453E]">{pendingEmail}</span>
        </p>

        <form onSubmit={handleVerify}>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#1F453E]">Mã OTP</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#FAF9F5] px-3.5 py-3 text-center font-serif-display text-3xl tracking-[0.5em] text-[#1F453E] transition-colors placeholder:text-gray-300 focus:border-[#1F453E] focus:outline-none"
              />
            </label>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {info && <p className="rounded-lg bg-[#E2ECC8]/60 px-3 py-2 text-sm text-[#1F453E]">{info}</p>}
          </div>

          <AuthSubmitButton loading={loading}>Xác nhận &amp; vào tủ đồ</AuthSubmitButton>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#1F453E] py-3 text-xs font-bold uppercase tracking-wider text-[#1F453E] transition-colors hover:bg-[#E2ECC8]/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {cooldown > 0 ? `Gửi lại mã OTP (${cooldown}s)` : 'Gửi lại mã OTP'}
        </button>

        <p className="mt-5 text-center text-xs text-[#71807B]">
          Nhập sai email?{' '}
          <button
            type="button"
            onClick={backToForm}
            className="font-semibold text-[#1F453E] underline underline-offset-2"
          >
            Quay lại sửa thông tin
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="mb-5 text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
        Tạo tài khoản
      </h1>

      <AuthTabs active="register" />

      <form onSubmit={handleRegister}>
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
