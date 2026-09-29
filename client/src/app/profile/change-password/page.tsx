'use client';

// ===== NEW: Change Password =====
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { PASSWORD_MIN_LENGTH, getErrorStatus, validateNewPassword } from '@/lib/passwordPolicy';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { AuthField, AuthSubmitButton } from '@/components/layout/AuthLayout';

const REDIRECT_AFTER_MS = 2000;

export default function ChangePasswordPage() {
  const router = useRouter();

  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Doi thanh cong -> quay ve tu do sau vai giay (JWT hien tai van con hieu luc).
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push('/wardrobe'), REDIRECT_AFTER_MS);
    return () => clearTimeout(t);
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.oldPassword) {
      setError('Vui lòng nhập mật khẩu cũ.');
      return;
    }
    const invalid = validateNewPassword(form.newPassword, form.confirmPassword);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (form.newPassword === form.oldPassword) {
      setError('Mật khẩu mới phải khác mật khẩu cũ.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(form.oldPassword, form.newPassword);
      setSuccess(true);
    } catch (err) {
      // 401 (het phien) da duoc interceptor trong lib/api.ts xu ly: dang xuat + ve /login.
      const status = getErrorStatus(err);
      if (status === 400) setError(getErrorMessage(err)); // sai mat khau cu / sai policy / trung mat khau cu
      else if (status !== 401) setError('Lỗi hệ thống, vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedLayout fullBleed>
      <div className="flex flex-1 items-center justify-center bg-[#FAF9F5] px-6 py-12 font-jakarta text-[#1F453E]">
        <div className="w-full max-w-[420px] rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-10">
          <h1 className="mb-6 text-center font-serif-display text-[26px] font-medium text-[#1F453E]">
            Đổi mật khẩu
          </h1>

          {success ? (
            <p className="rounded-lg bg-[#E2ECC8]/60 px-3 py-3 text-sm leading-relaxed text-[#1F453E]">
              Đổi mật khẩu thành công. Đang chuyển về Tủ đồ...
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                <AuthField
                  label="Mật khẩu cũ"
                  type="password"
                  autoComplete="current-password"
                  value={form.oldPassword}
                  onChange={set('oldPassword')}
                  disabled={loading}
                />
                <AuthField
                  label="Mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={set('newPassword')}
                  placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
                  disabled={loading}
                />
                <AuthField
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  disabled={loading}
                />

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                )}
              </div>

              <AuthSubmitButton loading={loading}>Cập nhật</AuthSubmitButton>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-[#71807B]">
            Quên mật khẩu cũ?{' '}
            <Link href="/forgot-password" className="font-semibold text-[#1F453E] underline underline-offset-2">
              Đặt lại qua email
            </Link>
          </p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
// ===== END NEW =====
