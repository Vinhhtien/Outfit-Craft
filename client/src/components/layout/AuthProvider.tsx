'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';
import { NotificationViewport } from '@/components/ui/Notifications';
import { FitSaveStatus } from '@/components/ui/FitSaveStatus';
import { VButton, VInput } from '@/components/ui/vintage';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { hydrate, expireSession, sessionExpired, user, login, logout } = useAuthStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    const expire = () => expireSession();
    window.addEventListener('outfitcraft:session-expired', expire);
    if (!started.current) { started.current = true; void hydrate(); }
    return () => window.removeEventListener('outfitcraft:session-expired', expire);
  }, [hydrate, expireSession]);
  return <>
    <div inert={Boolean(sessionExpired && user)}>{children}</div>
    <NotificationViewport />
    <FitSaveStatus />
    {sessionExpired && user && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#1F453E]/60 p-4 backdrop-blur-sm">
      <form role="dialog" aria-modal="true" aria-labelledby="session-title" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-[#1F453E]" onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true; setBusy(true); setError('');
        try { await login(user.email, password); setPassword(''); }
        catch (err) { setError(getErrorMessage(err)); }
        finally { submitting.current = false; setBusy(false); }
      }}>
        <h2 id="session-title" className="text-xl font-semibold">Đăng nhập lại để tiếp tục</h2>
        <p className="text-sm">Phiên đăng nhập đã hết hạn. Nội dung đang chỉnh sửa được giữ nguyên.</p>
        <p className="break-all text-sm">{user.email}</p>
        <VInput label="Mật khẩu" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><VButton type="submit" loading={busy}>Tiếp tục</VButton><VButton type="button" variant="outline" disabled={busy} onClick={() => { setPassword(''); logout(); }}>Đăng xuất</VButton></div>
      </form>
    </div>}
  </>;
}
