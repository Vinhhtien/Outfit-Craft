'use client';

// ===== NEW: Reset Password =====
import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { authApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { PASSWORD_MIN_LENGTH, getErrorStatus, validateNewPassword } from '@/lib/passwordPolicy';
import { AuthLayout, AuthField, AuthSubmitButton } from '@/components/layout/AuthLayout';

/** Loi lien quan den link -> an form, chi cho yeu cau link moi. */
type LinkError = 'invalid' | 'expired' | null;

const REDIRECT_AFTER_MS = 3000;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState<LinkError>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dat lai thanh cong -> tu dong ve trang dang nhap sau vai giay.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push('/login'), REDIRECT_AFTER_MS);
    return () => clearTimeout(t);
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const invalid = validateNewPassword(newPassword, confirmPassword);
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      const status = getErrorStatus(err);
      const hasFieldErrors =
        axios.isAxiosError(err) && Array.isArray((err.response?.data as { details?: unknown })?.details);

      if (status === 410) setLinkError('expired');
      else if (status === 400 && hasFieldErrors) setError(getErrorMessage(err)); // mat khau sai policy
      else if (status === 400) setLinkError('invalid');
      else setError('Lỗi hệ thống, vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="mb-6 text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
        Đặt lại mật khẩu
      </h1>

      {success ? (
        <>
          <p className="rounded-lg bg-[#E2ECC8]/60 px-3 py-3 text-sm leading-relaxed text-[#1F453E]">
            Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập...
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#1F453E] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
          >
            Đăng nhập ngay
          </button>
        </>
      ) : linkError ? (
        <>
          <p className="rounded-lg bg-red-50 px-3 py-3 text-sm leading-relaxed text-red-600">
            {linkError === 'expired'
              ? 'Link đặt lại mật khẩu đã hết hạn (hiệu lực 15 phút). Vui lòng yêu cầu link mới.'
              : 'Link đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu link mới.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#1F453E] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
          >
            Yêu cầu link mới
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <AuthField
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
              disabled={loading}
            />
            <AuthField
              label="Xác nhận mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              disabled={loading}
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <AuthSubmitButton loading={loading}>Lưu mật khẩu mới</AuthSubmitButton>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-[#71807B]">
        <Link href="/login" className="font-semibold text-[#1F453E] underline underline-offset-2">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
// ===== END NEW =====
