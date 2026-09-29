'use client';

// ===== NEW: Update Profile =====
// Trang Ho so: 2 form doc lap tren cung 1 trang, moi form goi 1 API rieng
// (PUT /auth/profile va PUT /auth/change-password) -> doi ten/anh khong can nhap mat khau cu.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { authApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { PASSWORD_MIN_LENGTH, getErrorStatus, validateNewPassword } from '@/lib/passwordPolicy';
import { useAuthStore } from '@/store/authStore';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { VButton, VLabel, VToast } from '@/components/ui/vintage';

/** Giu dong bo voi server/src/middlewares/upload.ts */
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
const DISPLAY_NAME_MAX = 50;
const CITY_MAX = 100;

const FIELD =
  'w-full rounded-lg border border-[#869BB2] bg-white px-3.5 py-2.5 text-sm text-[#1F453E] placeholder:text-[#869BB2] transition-colors focus:border-[#1F453E] focus:outline-none focus:ring-2 focus:ring-[#1F453E]/10 disabled:cursor-not-allowed disabled:border-[#D9DEE5] disabled:bg-[#F1F1EE] disabled:text-[#869BB2]';

const CARD =
  'rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-8';

/** "Linh Mai" -> "LM" (giong Navbar). */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

function Field({ label, hint, ...rest }: FieldProps) {
  return (
    <label className="block">
      <VLabel>{label}</VLabel>
      <input className={FIELD} {...rest} />
      {hint && <span className="mt-1 block text-xs text-[#869BB2]">{hint}</span>}
    </label>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub: string }) {
  return (
    <div className="mb-6 border-b border-dashed border-[#869BB2]/50 pb-4">
      <h2 className="font-serif-display text-xl font-medium uppercase tracking-wide text-[#1F453E]">
        {children}
      </h2>
      <p className="mt-1 text-xs text-[#869BB2]">{sub}</p>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>;
}

/* ---------------- Phan vung 1: Thong tin ca nhan ---------------- */
function ProfileForm({ onSuccess }: { onSuccess: (msg: string) => void }) {
  // ProtectedLayout chi render children khi da co user.
  const user = useAuthStore((s) => s.user)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [form, setForm] = useState({ displayName: user.displayName, defaultCity: user.defaultCity ?? '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Giai phong object URL cu khi doi anh / roi trang.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phep chon lai cung 1 file
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Ảnh tối đa 10MB.');
      return;
    }

    setError('');
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearPickedFile = () => {
    setAvatarFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const displayName = form.displayName.trim();
    const defaultCity = form.defaultCity.trim();
    if (!displayName) return setError('Tên hiển thị không được để trống.');
    if (displayName.length > DISPLAY_NAME_MAX) {
      return setError(`Tên hiển thị tối đa ${DISPLAY_NAME_MAX} ký tự.`);
    }
    if (!defaultCity) return setError('Vui lòng nhập thành phố.');

    const data = new FormData();
    data.append('displayName', displayName);
    data.append('defaultCity', defaultCity);
    if (avatarFile) data.append('avatar', avatarFile);

    setSaving(true);
    try {
      const updated = await updateProfile(data);
      setForm({ displayName: updated.displayName, defaultCity: updated.defaultCity });
      clearPickedFile();
      onSuccess('Đã lưu hồ sơ của bạn.');
    } catch (err) {
      // 401 (het phien) da duoc interceptor trong lib/api.ts xu ly.
      if (getErrorStatus(err) !== 401) setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = previewUrl ?? user.avatarUrl;

  return (
    <section className={CARD}>
      <SectionTitle sub="Tên, ảnh đại diện và thành phố dùng cho gợi ý thời tiết.">
        Thông tin cá nhân
      </SectionTitle>

      <form onSubmit={handleSubmit} noValidate className="grid gap-8 sm:grid-cols-[auto_1fr]">
        {/* Avatar uploader */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={form.displayName || user.displayName}
                className="h-32 w-32 rounded-full border-2 border-[#869BB2] object-cover"
              />
            ) : (
              <span className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-[#869BB2] bg-[#DCE6C3] font-serif-display text-4xl text-[#1F453E]">
                {initials(form.displayName || user.displayName)}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              title="Thay đổi ảnh"
              className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#1F453E] text-white shadow-md transition-colors hover:bg-[#16352F] disabled:opacity-60"
            >
              <Camera size={16} />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            onChange={handlePickFile}
            className="hidden"
          />

          {avatarFile ? (
            <div className="text-center text-xs">
              <p className="text-[#869BB2]">Xem trước - chưa lưu</p>
              <button
                type="button"
                onClick={clearPickedFile}
                disabled={saving}
                className="mt-1 font-semibold text-[#1F453E] underline underline-offset-2"
              >
                Bỏ chọn
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="text-xs font-semibold text-[#1F453E] underline underline-offset-2"
            >
              Thay đổi ảnh
            </button>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <Field
            label="Tên hiển thị"
            value={form.displayName}
            onChange={set('displayName')}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            disabled={saving}
          />
          <Field
            label="Thành phố (dùng cho gợi ý thời tiết)"
            value={form.defaultCity}
            onChange={set('defaultCity')}
            maxLength={CITY_MAX}
            placeholder="Ví dụ: Hanoi"
            disabled={saving}
          />
          <Field
            label="Email"
            type="email"
            value={user.email}
            disabled
            readOnly
            hint="Email dùng để đăng nhập, không thể thay đổi tại đây."
          />

          <FormError message={error} />

          <div className="flex justify-end pt-2">
            <VButton type="submit" loading={saving} className="px-8 py-3">
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </VButton>
          </div>
        </div>
      </form>
    </section>
  );
}

/* ---------------- Phan vung 2: Doi mat khau ---------------- */
const EMPTY_PASSWORDS = { oldPassword: '', newPassword: '', confirmPassword: '' };

function PasswordForm({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Link cu /profile/change-password redirect ve /profile#password -> cuon toi form nay.
  useEffect(() => {
    if (window.location.hash === '#password') {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.oldPassword) return setError('Vui lòng nhập mật khẩu cũ.');
    const invalid = validateNewPassword(form.newPassword, form.confirmPassword);
    if (invalid) return setError(invalid);
    if (form.newPassword === form.oldPassword) {
      return setError('Mật khẩu mới phải khác mật khẩu cũ.');
    }

    setLoading(true);
    try {
      await authApi.changePassword(form.oldPassword, form.newPassword);
      // JWT hien tai van hop le -> giu nguyen phien, chi xoa trang 3 o mat khau.
      setForm(EMPTY_PASSWORDS);
      onSuccess('Đổi mật khẩu thành công.');
    } catch (err) {
      const status = getErrorStatus(err);
      if (status === 400) setError(getErrorMessage(err)); // sai mat khau cu / sai policy
      else if (status !== 401) setError('Lỗi hệ thống, vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="password" ref={sectionRef} className={`${CARD} scroll-mt-24`}>
      <SectionTitle sub="Chỉ cần điền khi bạn muốn đổi mật khẩu đăng nhập.">Đổi mật khẩu</SectionTitle>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Mật khẩu cũ"
          type="password"
          autoComplete="current-password"
          value={form.oldPassword}
          onChange={set('oldPassword')}
          disabled={loading}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={set('newPassword')}
            placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
            disabled={loading}
          />
          <Field
            label="Xác nhận mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            disabled={loading}
          />
        </div>

        <FormError message={error} />

        <div className="flex flex-col-reverse items-center justify-between gap-4 pt-2 sm:flex-row">
          <p className="text-xs text-[#869BB2]">
            Quên mật khẩu cũ?{' '}
            <Link href="/forgot-password" className="font-semibold text-[#1F453E] underline underline-offset-2">
              Đặt lại qua email
            </Link>
          </p>
          <VButton type="submit" loading={loading} className="px-8 py-3">
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </VButton>
        </div>
      </form>
    </section>
  );
}

/* ---------------- Trang ---------------- */
export default function ProfilePage() {
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <ProtectedLayout fullBleed>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner>
          <div>
            <h1 className="font-serif-display text-4xl font-normal uppercase tracking-wide text-[#1F453E]">
              Hồ sơ cá nhân
            </h1>
            <p className="mt-1 text-sm font-medium text-[#2C4C45]">
              Quản lý thông tin và bảo mật tài khoản của bạn
            </p>
          </div>
        </ScallopBanner>

        <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
          <ProfileForm onSuccess={setToast} />
          <PasswordForm onSuccess={setToast} />
        </div>
      </div>

      <VToast message={toast} onClose={closeToast} />
    </ProtectedLayout>
  );
}
// ===== END NEW =====
