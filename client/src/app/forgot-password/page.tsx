'use client';

// ===== NEW: Forgot Password =====
import { useRef, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { getErrorStatus } from '@/lib/passwordPolicy';
import { AuthLayout, AuthField, AuthSubmitButton } from '@/components/layout/AuthLayout';
// ===== ADDED: Validation =====
import { validateEmail } from '@/lib/authValidation';
// ===== END ADDED =====

const SUCCESS_MESSAGE =
  'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // ===== ADDED: Validation =====
  const [emailError, setEmailError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  // ===== END ADDED =====

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ===== ADDED: Validation ===== (thay cho check isValidEmail cu: loi hien ngay duoi o input)
    const emailMsg = validateEmail(email);
    setEmailError(emailMsg);
    if (emailMsg) {
      emailRef.current?.focus();
      return;
    }
    // ===== END ADDED =====

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      const status = getErrorStatus(err);
      if (status === 429) setError(getErrorMessage(err));
      else if (status === 400) setError('Email không hợp lệ.');
      else setError('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
        Quên mật khẩu
      </h1>
      <p className="mb-6 mt-1.5 text-center text-[13px] text-[#71807B]">
        Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu cho bạn.
      </p>

      {success ? (
        <p className="rounded-lg bg-[#E2ECC8]/60 px-3 py-3 text-sm leading-relaxed text-[#1F453E]">
          {SUCCESS_MESSAGE}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <AuthField
              ref={emailRef} // ADDED: Validation
              error={emailError} // ADDED: Validation
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(''); // ADDED: Validation
              }}
              placeholder="ban@example.com"
              disabled={loading}
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <AuthSubmitButton loading={loading}>Gửi link đặt lại</AuthSubmitButton>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-[#71807B]">
        Đã nhớ mật khẩu?{' '}
        <Link href="/login" className="font-semibold text-[#1F453E] underline underline-offset-2">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
// ===== END NEW =====
