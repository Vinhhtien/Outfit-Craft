import { api } from './api';
import type {
  ApiResponse, ClothingItem, Outfit, Weather, Suggestion,
  ScheduleEntry, User, Category, Occasion,
  BodyProfile, MannequinProfile, // NEW: Body Profile
} from '@/types';

/* ---------------- Auth ---------------- */
export const authApi = {
  // ===== NEW: Register OTP =====
  /** Buoc 1: tao tai khoan cho xac thuc + gui OTP. Goi lai voi cung du lieu = "Gui lai ma OTP". */
  register: (body: { email: string; password: string; displayName: string; defaultCity?: string }) =>
    api.post<ApiResponse<{ email: string }>>('/auth/register', body).then((r) => r.data),

  /** Buoc 2: xac thuc OTP, server tra token + user giong login. */
  verifyRegistration: (email: string, otp: string) =>
    api
      .post<ApiResponse<{ token: string; user: User }>>('/auth/verify-registration', { email, otp })
      .then((r) => r.data.data),
  // ===== END NEW =====

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

  // ===== NEW: Update Profile =====
  /** Ho so hien tai - server dung chung GET /auth/me (tra document co _id). */
  getProfile: () =>
    api.get<ApiResponse<User & { _id?: string }>>('/auth/me').then((r) => {
      const u = r.data.data;
      return { ...u, id: u.id ?? u._id ?? '' } as User;
    }),

  /** FormData gom: displayName, defaultCity va (tuy chon) file 'avatar'. */
  updateProfile: (formData: FormData) =>
    api
      .put<ApiResponse<User>>('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data),
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

// ===== NEW: Xem/Sua Item =====
/** Cac field PATCH /items/:id chap nhan (server dung .strict(), gui field khac se 400). */
export type UpdateItemPayload = Partial<
  Pick<
    ClothingItem,
    'name' | 'category' | 'colors' | 'styles' | 'seasons' | 'occasions' | 'brand' | 'notes'
  >
>;
// ===== END NEW =====

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

  // ===== NEW: Xem/Sua Item ===== (thu hep kieu body theo whitelist cua server)
  update: (id: string, body: UpdateItemPayload) =>
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
    // ===== NEW: Body Profile =====
    anchorRef?: string | null;
    offset?: { x: number; y: number };
    // ===== END NEW =====
  }[];
  canvasJSON: Record<string, unknown>;
  thumbnailDataUrl?: string;
  seasons?: string[];
  occasions?: string[];
  tags?: string[];
  isPublic?: boolean;
  // ===== NEW: Body Profile =====
  mannequin?: MannequinProfile | null;
  // ===== END NEW =====
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

// ===== NEW: Body Profile =====
/* ---------------- Body Profile ---------------- */
export const bodyProfileApi = {
  /** null neu user chua thiet lap dang nguoi. */
  get: () =>
    api.get<ApiResponse<BodyProfile | null>>('/users/me/body-profile').then((r) => r.data.data),

  /** PUT gop vao ho so: field khong gui thi server giu nguyen. */
  save: (body: Partial<Omit<BodyProfile, 'updatedAt'>>) =>
    api.put<ApiResponse<BodyProfile>>('/users/me/body-profile', body).then((r) => r.data.data),

  remove: () => api.delete<ApiResponse<null>>('/users/me/body-profile').then((r) => r.data),
};
// ===== END NEW =====

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
