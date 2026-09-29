// ===== NEW: Forgot / Reset / Change Password =====
import axios from 'axios';

/** Giu dong bo voi registerSchema.password o server (min 6 ky tu). */
export const PASSWORD_MIN_LENGTH = 6;

/** Tra ve thong bao loi, hoac '' neu mat khau hop le. */
export function validateNewPassword(password: string, confirm: string): string {
  if (!password) return 'Vui lòng nhập mật khẩu mới.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  if (password !== confirm) return 'Xác nhận mật khẩu không khớp.';
  return '';
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Status HTTP cua loi axios (undefined neu loi mang). */
export const getErrorStatus = (err: unknown) =>
  axios.isAxiosError(err) ? err.response?.status : undefined;
// ===== END NEW =====
