import { api } from './api';
import type {
  ApiResponse, ClothingItem, Outfit, Weather, Suggestion,
  ScheduleEntry, User, Category, Occasion,
} from '@/types';

/* ---------------- Auth ---------------- */
export const authApi = {
  register: (body: { email: string; password: string; displayName: string; defaultCity?: string }) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/auth/register', body).then((r) => r.data.data),

  login: (body: { email: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', body).then((r) => r.data.data),

  me: () => api.get<ApiResponse<User>>('/auth/me').then((r) => r.data.data),

  // ===== NEW: Forgot / Reset / Change Password =====
  forgotPassword: (email: string) =>
    api.post<ApiResponse<null>>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api
      .put<ApiResponse<null>>(`/auth/reset-password/${encodeURIComponent(token)}`, { newPassword })
      .then((r) => r.data),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.put<ApiResponse<null>>('/auth/change-password', { oldPassword, newPassword }).then((r) => r.data),
  // ===== END NEW =====
};

/* ---------------- Wardrobe ---------------- */
export interface ItemFilters {
  category?: Category;
  style?: string;
  season?: string;
  occasion?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const itemApi = {
  /** Day file len Cloudinary, tra ve { url, publicId }. */
  upload: (file: Blob, filename = 'item.png') => {
    const form = new FormData();
    form.append('image', file, filename);
    return api
      .post<ApiResponse<{ url: string; publicId: string }>>('/items/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  list: (filters: ItemFilters = {}) =>
    api.get<ApiResponse<ClothingItem[]>>('/items', { params: filters }).then((r) => r.data),

  get: (id: string) => api.get<ApiResponse<ClothingItem>>(`/items/${id}`).then((r) => r.data.data),

  create: (body: Partial<ClothingItem>) =>
    api.post<ApiResponse<ClothingItem>>('/items', body).then((r) => r.data.data),

  update: (id: string, body: Partial<ClothingItem>) =>
    api.patch<ApiResponse<ClothingItem>>(`/items/${id}`, body).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/items/${id}`).then((r) => r.data),

  stats: () => api.get<ApiResponse<{
    total: number;
    byCategory: { _id: Category; count: number }[];
    mostWorn: ClothingItem[];
    neverWorn: number;
  }>>('/items/stats').then((r) => r.data.data),
};

/* ---------------- Outfits ---------------- */
export interface SaveOutfitBody {
  name: string;
  items: {
    item: string; left: number; top: number;
    scaleX: number; scaleY: number; angle: number; zIndex: number; flipX?: boolean;
  }[];
  canvasJSON: Record<string, unknown>;
  thumbnailDataUrl?: string;
  seasons?: string[];
  occasions?: string[];
  tags?: string[];
  isPublic?: boolean;
}

export const outfitApi = {
  list: (params: { page?: number; season?: string; occasion?: string } = {}) =>
    api.get<ApiResponse<Outfit[]>>('/outfits', { params }).then((r) => r.data),

  get: (id: string) => api.get<ApiResponse<Outfit>>(`/outfits/${id}`).then((r) => r.data.data),

  create: (body: SaveOutfitBody) =>
    api.post<ApiResponse<Outfit>>('/outfits', body).then((r) => r.data.data),

  update: (id: string, body: Partial<SaveOutfitBody>) =>
    api.patch<ApiResponse<Outfit>>(`/outfits/${id}`, body).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/outfits/${id}`).then((r) => r.data),

  markWorn: (id: string) => api.post<ApiResponse<null>>(`/outfits/${id}/wear`).then((r) => r.data),

  feed: (page = 1) =>
    api.get<ApiResponse<Outfit[]>>('/outfits/feed', { params: { page } }).then((r) => r.data),
};

/* ---------------- Suggestions ---------------- */
export const suggestionApi = {
  weather: (city?: string) =>
    api.get<ApiResponse<Weather>>('/suggestions/weather', { params: { city } }).then((r) => r.data.data),

  get: (params: { city?: string; occasion?: Occasion } = {}) =>
    api.get<ApiResponse<{
      weather: Weather; suggestion: Suggestion; advice: string; adviceSource: 'ai' | 'rule';
    }>>('/suggestions', { params }).then((r) => r.data.data),

  ranked: (params: { city?: string; occasion?: Occasion; category?: Category } = {}) =>
    api.get<ApiResponse<{
      weather: Weather;
      items: { item: ClothingItem; score: number; reasons: string[] }[];
    }>>('/suggestions/ranked', { params }).then((r) => r.data.data),
};

/* ---------------- Schedule ---------------- */
export const scheduleApi = {
  list: (from?: string, to?: string) =>
    api.get<ApiResponse<ScheduleEntry[]>>('/schedule', { params: { from, to } }).then((r) => r.data.data),

  set: (body: { outfit: string; date: string; note?: string }) =>
    api.post<ApiResponse<ScheduleEntry>>('/schedule', body).then((r) => r.data.data),

  markWorn: (id: string) =>
    api.patch<ApiResponse<ScheduleEntry>>(`/schedule/${id}/worn`).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/schedule/${id}`).then((r) => r.data),
};
