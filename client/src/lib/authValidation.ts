// ===== ADDED: Validation =====
// Validate form Login / Register / Forgot Password truoc khi goi API.
// Giu dong bo voi registerSchema / loginSchema / verifyRegistrationSchema o server.
import { PASSWORD_MIN_LENGTH, isValidEmail } from './passwordPolicy';

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;

/** Ky tu co the dung de chen HTML/script hoac toan tu query: < > { } [ ] \ ` " $ ; */
export const DANGEROUS_CHARS = /[<>{}[\]\\`"$;]/;

/** Moi ham tra ve thong bao loi, hoac '' neu hop le. */
export function validateEmail(email: string): string {
  if (!email.trim()) return 'Email không được để trống.';
  if (!isValidEmail(email)) return 'Vui lòng nhập email hợp lệ.';
  return '';
}

export function validatePassword(password: string): string {
  if (!password) return 'Vui lòng nhập mật khẩu.';
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  return '';
}

export function validateDisplayName(name: string): string {
  const value = name.trim();
  if (value.length < DISPLAY_NAME_MIN || value.length > DISPLAY_NAME_MAX) {
    return `Tên hiển thị phải từ ${DISPLAY_NAME_MIN} đến ${DISPLAY_NAME_MAX} ký tự.`;
  }
  if (DANGEROUS_CHARS.test(value)) return 'Tên hiển thị không được chứa ký tự đặc biệt như < > { } [ ] \\ ` " $ ;';
  return '';
}

export function validateCity(city: string): string {
  return city.trim() ? '' : 'Vui lòng nhập tên thành phố.';
}

export function validateOtp(otp: string): string {
  return /^\d{6}$/.test(otp) ? '' : 'Mã OTP phải gồm 6 chữ số.';
}

/** Loc ra cac field dang loi; key dau tien (theo thu tu khai bao) la o can focus. */
export function pickErrors<K extends string>(errors: Record<K, string>): Partial<Record<K, string>> {
  return Object.fromEntries(Object.entries(errors).filter(([, msg]) => msg)) as Partial<Record<K, string>>;
}
// ===== END ADDED =====
