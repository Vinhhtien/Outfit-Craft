// ===== NEW: Update Profile =====
// Doi mat khau da gop vao trang /profile. Giu route cu (chuyen huong) de bookmark cu khong bi 404.
import { redirect } from 'next/navigation';

export default function ChangePasswordPage() {
  redirect('/profile#password');
}
// ===== END NEW =====
