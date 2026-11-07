import type { AxiosProgressEvent } from 'axios';
import { api } from './api';
import type {
  ApiResponse, ClothingItem, Outfit, Weather, Suggestion, SuggestionAnchor, StylistChatResult,
  ScheduleEntry, User, Category, Occasion,
  BodyProfile, MannequinProfile, // NEW: Body Profile
  ItemFit, // NEW: Ghi nho fit
  WardrobeStatsData,
  DeclutterSuggestionsData,
  WishlistItem,
  WishlistResponseData,
  DuplicateCheckResult,
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
        timeout: 150000,
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
    'name' | 'category' | 'colors' | 'styles' | 'seasons' | 'occasions' | 'brand' | 'notes' | 'purchasePrice'
  >
>;
// ===== END NEW =====

export const itemApi = {
  createWithImages: (metadata: Partial<ClothingItem>, image: Blob, original: Blob, creationKey: string, onUploadProgress?: (event: AxiosProgressEvent) => void) => {
    const body = new FormData();
    body.append('metadata', JSON.stringify(metadata));
    body.append('creationKey', creationKey);
    body.append('image', image, 'cutout.png');
    body.append('original', original, original.type === 'image/png' ? 'original.png' : 'original.jpg');
    return api.post<ApiResponse<ClothingItem>>('/items/with-images', body, {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 150000, onUploadProgress,
    }).then((response) => response.data.data);
  },
  /** Day file len Cloudinary, tra ve { url, publicId }. */
  upload: (file: Blob, filename = 'item.png') => {
    const form = new FormData();
    form.append('image', file, filename);
    return api
      .post<ApiResponse<{ url: string; publicId: string }>>('/items/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 150000,
      })
      .then((r) => r.data.data);
  },

  list: (filters: ItemFilters = {}, signal?: AbortSignal) =>
    api.get<ApiResponse<ClothingItem[]>>('/items', { params: filters, signal }).then((r) => r.data),

  get: (id: string, signal?: AbortSignal) => api.get<ApiResponse<ClothingItem>>(`/items/${id}`, { signal }).then((r) => r.data.data),

  create: (body: Partial<ClothingItem>) =>
    api.post<ApiResponse<ClothingItem>>('/items', body).then((r) => r.data.data),

  // ===== NEW: Xem/Sua Item ===== (thu hep kieu body theo whitelist cua server)
  update: (id: string, body: UpdateItemPayload) =>
    api.patch<ApiResponse<ClothingItem>>(`/items/${id}`, body).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/items/${id}`).then((r) => r.data),

  // NEW: Ghi nho fit - vi tri + co da can tren nguoi mau (null = xoa).
  saveFit: (id: string, fit: ItemFit | null) =>
    api.put<ApiResponse<ClothingItem>>(`/items/${id}/fit`, { fit }).then((r) => r.data.data),

  stats: () => api.get<ApiResponse<WardrobeStatsData>>('/items/stats').then((r) => r.data.data),

  declutter: () =>
    api.get<ApiResponse<DeclutterSuggestionsData>>('/items/declutter').then((r) => r.data.data),

  markWorn: (id: string) =>
    api.post<ApiResponse<ClothingItem>>(`/items/${id}/wear`).then((r) => r.data),

  archive: (id: string) =>
    api.post<ApiResponse<ClothingItem>>(`/items/${id}/archive`).then((r) => r.data),
};

/* ---------------- Wishlist ---------------- */
export interface WishlistFilters {
  category?: string;
  priority?: string;
  purchased?: string;
}

export const wishlistApi = {
  list: (filters: WishlistFilters = {}, signal?: AbortSignal) =>
    api.get<ApiResponse<WishlistResponseData>>('/wishlist', { params: filters, signal }).then((r) => r.data.data),

  checkDuplicates: (body: { category: Category; name?: string; colors?: string[] }) =>
    api.post<ApiResponse<DuplicateCheckResult>>('/wishlist/check-duplicates', body).then((r) => r.data.data),

  create: (body: Partial<WishlistItem>) =>
    api.post<ApiResponse<WishlistItem>>('/wishlist', body).then((r) => r.data.data),

  update: (id: string, body: Partial<WishlistItem>) =>
    api.patch<ApiResponse<WishlistItem>>(`/wishlist/${id}`, body).then((r) => r.data.data),

  remove: (id: string) =>
    api.delete<ApiResponse<null>>(`/wishlist/${id}`).then((r) => r.data),

  moveToWardrobe: (id: string) =>
    api.post<ApiResponse<{ wishlistItem: WishlistItem; wardrobeItem: ClothingItem }>>(`/wishlist/${id}/move-to-wardrobe`).then((r) => r.data),
};

/* ---------------- Outfits ---------------- */
export interface SaveOutfitBody {
  creationKey?: string;
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
  list: (params: { page?: number; season?: string; occasion?: string } = {}, signal?: AbortSignal) =>
    api.get<ApiResponse<Outfit[]>>('/outfits', { params, signal }).then((r) => r.data),

  get: (id: string, signal?: AbortSignal) => api.get<ApiResponse<Outfit>>(`/outfits/${id}`, { signal }).then((r) => r.data.data),

  create: (body: SaveOutfitBody) =>
    api.post<ApiResponse<Outfit>>('/outfits', body, { timeout: 150000 }).then((r) => r.data.data),

  update: (id: string, body: Partial<SaveOutfitBody>) =>
    api.patch<ApiResponse<Outfit>>(`/outfits/${id}`, body, { timeout: 150000 }).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/outfits/${id}`).then((r) => r.data),

  markWorn: (id: string) => api.post<ApiResponse<null>>(`/outfits/${id}/wear`).then((r) => r.data),

  feed: (
    paramsOrPage: number | { page?: number; limit?: number; season?: string; occasion?: string; tag?: string; q?: string } = 1,
    signal?: AbortSignal
  ) => {
    const params = typeof paramsOrPage === 'number' ? { page: paramsOrPage } : paramsOrPage;
    return api.get<ApiResponse<Outfit[]>>('/outfits/feed', { params, signal }).then((r) => r.data);
  },

  toggleLike: (id: string) =>
    api
      .post<ApiResponse<{ isLiked: boolean; likeCount: number }>>(`/outfits/${id}/like`)
      .then((r) => r.data.data),
};

/* ---------------- Comments ---------------- */
export interface CommentItem {
  _id: string;
  user: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  outfit: string;
  content: string;
  createdAt: string;
}

export const commentApi = {
  list: (outfitId: string, signal?: AbortSignal) =>
    api.get<ApiResponse<CommentItem[]>>(`/outfits/${outfitId}/comments`, { signal }).then((r) => r.data.data),

  create: (outfitId: string, content: string) =>
    api.post<ApiResponse<CommentItem>>(`/outfits/${outfitId}/comments`, { content }).then((r) => r.data.data),

  remove: (outfitId: string, commentId: string) =>
    api.delete<ApiResponse<null>>(`/outfits/${outfitId}/comments/${commentId}`).then((r) => r.data),
};

/* ---------------- User Public Profile ---------------- */
export interface PublicUserProfileData {
  user: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
    createdAt: string;
  };
  stats: {
    publicOutfitCount: number;
    totalLikesReceived: number;
  };
  outfits: Outfit[];
}

export const userApi = {
  getPublicProfile: (id: string, signal?: AbortSignal) =>
    api.get<ApiResponse<PublicUserProfileData>>(`/users/${id}`, { signal }).then((r) => r.data.data),
};

// ===== NEW: Body Profile =====
/* ---------------- Body Profile ---------------- */
export const bodyProfileApi = {
  /** null neu user chua thiet lap dang nguoi. */
  get: (signal?: AbortSignal) =>
    api.get<ApiResponse<BodyProfile | null>>('/users/me/body-profile', { signal }).then((r) => r.data.data),

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

  /**
   * anchor: id mon co dinh. seasons, colorGroups: danh sach cach nhau boi dau phay.
   * shuffle: 1 -> boc ngau nhien trong nhom diem cao; seen: key cac bo vua hien.
   */
  get: (
    params: {
      city?: string; occasion?: Occasion; anchor?: string;
      seasons?: string; colorGroups?: string; shuffle?: 1; seen?: string;
    } = {},
    signal?: AbortSignal
  ) =>
    api.get<ApiResponse<{
      weather: Weather; suggestion: Suggestion; advice: string; adviceSource: 'ai' | 'rule';
      options?: Suggestion[]; anchor?: SuggestionAnchor; seasonWarning?: string; missing?: string[];
    }>>('/suggestions', { params, signal, timeout: 45000 }).then((r) => r.data.data),

  chat: (
    body: {
      message: string;
      history: { role: 'user' | 'stylist'; text: string }[];
      city?: string;
      occasion?: Occasion;
      seen: string[];
    },
    signal?: AbortSignal
  ) =>
    api.post<ApiResponse<StylistChatResult>>('/suggestions/chat', body, { signal, timeout: 45000 }).then((r) => r.data.data),

  ranked: (params: { city?: string; occasion?: Occasion; category?: Category } = {}) =>
    api.get<ApiResponse<{
      weather: Weather;
      items: { item: ClothingItem; score: number; reasons: string[] }[];
    }>>('/suggestions/ranked', { params }).then((r) => r.data.data),
};

/* ---------------- Schedule ---------------- */
export const scheduleApi = {
  list: (from?: string, to?: string, signal?: AbortSignal) =>
    api.get<ApiResponse<ScheduleEntry[]>>('/schedule', { params: { from, to }, signal }).then((r) => r.data.data),

  set: (body: { outfit: string; date: string; note?: string }) =>
    api.post<ApiResponse<ScheduleEntry>>('/schedule', body).then((r) => r.data.data),

  markWorn: (id: string) =>
    api.patch<ApiResponse<ScheduleEntry>>(`/schedule/${id}/worn`).then((r) => r.data.data),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/schedule/${id}`).then((r) => r.data),
};
