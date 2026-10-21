'use client';

import { create } from 'zustand';
import { tokenStore, getErrorMessage } from '@/lib/api';
import { authApi } from '@/lib/services';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** true khi dang kiem tra token luc tai trang - tranh nhay man hinh login. */
  isLoading: boolean;
  hydrateError: string;
  sessionExpired: boolean;
  expireSession: () => void;
  /** Tra ve user vua dang nhap de trang login dieu huong theo role. */
  login: (email: string, password: string) => Promise<User>;
  // ===== NEW: Register OTP =====
  /** Gui form dang ky -> server gui OTP ve email. Tra ve email da chuan hoa de dung o buoc xac thuc. */
  register: (body: { email: string; password: string; displayName: string; defaultCity?: string }) => Promise<string>;
  /** Xac thuc OTP thanh cong -> luu token + user (tu dong dang nhap). */
  verifyRegistration: (email: string, otp: string) => Promise<void>;
  // ===== END NEW =====
  logout: () => void;
  /** Goi 1 lan khi app khoi dong de khoi phuc phien dang nhap. */
  hydrate: () => Promise<void>;
  // ===== NEW: Update Profile =====
  /** Ghi de mot phan thong tin user trong store (Navbar cap nhat ngay, khong can F5). */
  updateUser: (patch: Partial<User>) => void;
  /** Goi API cap nhat ho so roi dong bo lai store. */
  updateProfile: (formData: FormData) => Promise<User>;
  // ===== END NEW =====
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  hydrateError: '',
  sessionExpired: false,
  expireSession: () => set({ sessionExpired: true }),

  login: async (email, password) => {
    const { token, user } = await authApi.login({ email, password });
    tokenStore.set(token);
    set({ user, sessionExpired: false, hydrateError: '', isLoading: false });
    return user;
  },

  // ===== NEW: Register OTP =====
  register: async (body) => {
    const res = await authApi.register(body);
    return res.data.email;
  },

  verifyRegistration: async (email, otp) => {
    const { token, user } = await authApi.verifyRegistration(email, otp);
    tokenStore.set(token);
    set({ user, sessionExpired: false, hydrateError: '', isLoading: false });
  },
  // ===== END NEW =====

  logout: () => {
    tokenStore.clear();
    set({ user: null, sessionExpired: false, hydrateError: '', isLoading: false });
  },

  hydrate: async () => {
    set({ isLoading: true, hydrateError: '' });
    const token = tokenStore.get();
    if (!tokenStore.get()) {
      set({ isLoading: false });
      return;
    }
    try {
      const raw = await authApi.me();
      if (tokenStore.get() !== token) return;
      // Server tra ve document Mongo (_id), chuan hoa ve shape User cua client.
      const u = raw as unknown as User & { _id?: string };
      set({ user: { ...u, id: u.id ?? u._id ?? '' }, isLoading: false });
    } catch (error) {
      if (tokenStore.get() !== token) {
        set({ isLoading: false });
        return;
      }
      set({ hydrateError: getErrorMessage(error), isLoading: false });
    }
  },

  // ===== NEW: Update Profile =====
  updateUser: (patch) =>
    set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),

  updateProfile: async (formData) => {
    const user = await authApi.updateProfile(formData);
    set((s) => ({ user: s.user ? { ...s.user, ...user } : user }));
    return user;
  },
  // ===== END NEW =====
}));
