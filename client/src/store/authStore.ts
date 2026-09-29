'use client';

import { create } from 'zustand';
import { tokenStore } from '@/lib/api';
import { authApi } from '@/lib/services';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** true khi dang kiem tra token luc tai trang - tranh nhay man hinh login. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: { email: string; password: string; displayName: string; defaultCity?: string }) => Promise<void>;
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

  login: async (email, password) => {
    const { token, user } = await authApi.login({ email, password });
    tokenStore.set(token);
    set({ user });
  },

  register: async (body) => {
    const { token, user } = await authApi.register(body);
    tokenStore.set(token);
    set({ user });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null });
  },

  hydrate: async () => {
    if (!tokenStore.get()) {
      set({ isLoading: false });
      return;
    }
    try {
      const raw = await authApi.me();
      // Server tra ve document Mongo (_id), chuan hoa ve shape User cua client.
      const u = raw as unknown as User & { _id?: string };
      set({ user: { ...u, id: u.id ?? u._id ?? '' }, isLoading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, isLoading: false });
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
