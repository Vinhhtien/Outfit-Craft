/** Domain types - giu dong bo voi server/src/types/index.ts */

export const CATEGORIES = [
  'top', 'bottom', 'outerwear', 'dress', 'shoes', 'bag', 'accessory',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Áo',
  bottom: 'Quần / Chân váy',
  outerwear: 'Áo khoác',
  dress: 'Váy liền',
  shoes: 'Giày',
  bag: 'Túi',
  accessory: 'Phụ kiện',
};

/** Layer mặc định trên canvas: số lớn = nằm trên. */
export const CATEGORY_Z_INDEX: Record<Category, number> = {
  bottom: 10, shoes: 15, dress: 20, top: 30,
  outerwear: 40, bag: 50, accessory: 60,
};

export const STYLES = [
  'casual', 'formal', 'sporty', 'streetwear', 'vintage', 'minimal', 'party',
] as const;
export type Style = (typeof STYLES)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Xuân', summer: 'Hè', autumn: 'Thu', winter: 'Đông',
};

export const OCCASIONS = [
  'daily', 'work', 'school', 'date', 'party', 'sport', 'travel',
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  daily: 'Hằng ngày', work: 'Đi làm', school: 'Đi học', date: 'Hẹn hò',
  party: 'Tiệc', sport: 'Thể thao', travel: 'Du lịch',
};

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  defaultCity: string;
}

export interface ClothingItem {
  _id: string;
  owner: string;
  name: string;
  category: Category;
  originalImageUrl: string;
  imageUrl: string;
  imagePublicId?: string;
  colors: string[];
  styles: Style[];
  seasons: Season[];
  occasions: Occasion[];
  tempRange: { min: number; max: number };
  brand?: string;
  notes?: string;
  wearCount: number;
  lastWornAt?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitItem {
  item: ClothingItem | string;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  zIndex: number;
  flipX?: boolean;
}

export interface Outfit {
  _id: string;
  owner: string;
  name: string;
  items: OutfitItem[];
  canvasJSON: Record<string, unknown>;
  thumbnailUrl?: string;
  seasons: Season[];
  occasions: Occasion[];
  tags: string[];
  isPublic: boolean;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Weather {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  condition: string;
  description: string;
  icon: string;
  isRaining: boolean;
}

export interface Suggestion {
  top?: ClothingItem;
  bottom?: ClothingItem;
  dress?: ClothingItem;
  outerwear?: ClothingItem;
  shoes?: ClothingItem;
  accessory?: ClothingItem;
  totalScore: number;
  reasons: string[];
}

export interface ScheduleEntry {
  _id: string;
  owner: string;
  outfit: Outfit;
  date: string;
  note?: string;
  isWorn: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: { page: number; limit: number; total: number; pages: number };
}
