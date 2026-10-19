import { api } from './api';
import type { Category } from '@/types';

export interface AdminUser {
  _id: string; displayName: string; email: string; role: 'user' | 'admin';
  isActive: boolean; isVerified?: boolean; defaultCity?: string; lockReason?: string;
  createdAt: string; itemCount?: number; outfitCount?: number;
}
export interface AdminCategory {
  _id: string; code: Category; name: string; layerOrder: number;
  defaultTempMin: number; defaultTempMax: number; itemCount: number;
}
export interface AdminOutfit {
  _id: string; name: string; thumbnailUrl?: string; isHidden: boolean; moderationReason?: string;
  owner: { _id: string; displayName: string; email: string } | null; createdAt: string; tags: string[];
}
export interface AdminLogEntry {
  _id: string; actorName: string; action: string; targetName: string; reason: string;
  status: 'pending' | 'completed' | 'failed'; createdAt: string;
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> };
}
export interface DashboardData {
  users: number; items: number; outfits: number; lockedUsers: number;
  publicOutfits: number; hiddenOutfits: number; recentLogs: AdminLogEntry[];
}
export interface PageResult<T> { data: T[]; pagination: { page: number; pages: number; total: number; limit: number } }
export interface AdminFilters { q: string; status?: string; page: number }
export const adminApi = {
  dashboard: (signal?: AbortSignal) => api.get<{ data: DashboardData }>('/admin/dashboard', { signal }).then((r) => r.data.data),
  users: (params: AdminFilters, signal?: AbortSignal) => api.get<PageResult<AdminUser>>('/admin/users', { params, signal }).then((r) => r.data),
  user: (id: string, signal?: AbortSignal) => api.get<{ data: AdminUser }>(`/admin/users/${id}`, { signal }).then((r) => r.data.data),
  userStatus: (id: string, isActive: boolean, reason: string) => api.patch(`/admin/users/${id}/status`, { isActive, reason }),
  categories: (signal?: AbortSignal) => api.get<{ data: AdminCategory[] }>('/admin/categories', { signal }).then((r) => r.data.data),
  updateCategory: (code: Category, body: Pick<AdminCategory, 'name' | 'layerOrder' | 'defaultTempMin' | 'defaultTempMax'>) => api.patch(`/admin/categories/${code}`, body),
  outfits: (params: AdminFilters, signal?: AbortSignal) => api.get<PageResult<AdminOutfit>>('/admin/outfits', { params, signal }).then((r) => r.data),
  visibility: (id: string, isHidden: boolean, reason: string) => api.patch(`/admin/outfits/${id}/visibility`, { isHidden, reason }),
  logs: (params: AdminFilters, signal?: AbortSignal) => api.get<PageResult<AdminLogEntry>>('/admin/logs', { params, signal }).then((r) => r.data),
};
