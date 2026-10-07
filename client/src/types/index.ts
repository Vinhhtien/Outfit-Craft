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
  shoes: 5, bottom: 10, dress: 20, top: 30,
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

// ===== NEW: Body Profile =====
// NEW: Body 3D - hang so dang nguoi nam o bodyConstants.ts (ban sao y het server).
export * from './bodyConstants';
import type {
  BodyGender, BodyShape, BodyMeasurements, UnitPreference,
} from './bodyConstants';

export const BODY_GENDER_LABELS: Record<BodyGender, string> = {
  female: 'Nữ', male: 'Nam', neutral: 'Trung tính',
};

export const BODY_SHAPE_LABELS: Record<BodyShape, string> = {
  rectangle: 'Chữ nhật',
  pear: 'Quả lê',
  apple: 'Quả táo',
  hourglass: 'Đồng hồ cát',
  inverted_triangle: 'Tam giác ngược',
};

/** Dáng dùng để vẽ mannequin (cũng là snapshot lưu trong outfit). */
export interface MannequinProfile {
  gender: BodyGender;
  shape: BodyShape;
  measurements?: BodyMeasurements;
}

export interface BodyProfile extends MannequinProfile {
  // ===== NEW: Body 3D =====
  /** Nhạy cảm: chỉ chủ sở hữu đọc được. */
  weightKg?: number;
  unitPreference?: UnitPreference;
  modelColorHue?: number;
  showBmi?: boolean;
  // ===== END NEW =====
  updatedAt?: string;
}
// ===== END NEW =====

// ===== NEW: Body 3D =====
/** Snapshot người mẫu 3D lúc phối (chủ outfit mới thấy). */
export interface Scene3DBodySnapshot extends MannequinProfile {
  weightKg?: number;
  modelColorHue?: number;
}

export type Vec3Tuple = [number, number, number];

/** 1 món đồ trong cảnh 3D - xem server/src/models/Outfit.ts (IScene3DItem). */
export interface Scene3DItem {
  itemId: string;
  anchor: string | null;
  offset: Vec3Tuple;
  scale: number;
  rotation: number;
  layer: number;
  aspect?: number;
  flipX?: boolean;
}

export interface Scene3D {
  version: 1;
  /** Người khác xem outfit công khai: server bỏ trường này. */
  bodySnapshot?: Scene3DBodySnapshot;
  showModel: boolean;
  items: Scene3DItem[];
  camera?: { position: Vec3Tuple; target: Vec3Tuple };
}
// ===== END NEW =====

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
  // ===== NEW: Body Profile =====
  anchorRef?: string | null;
  offset?: { x: number; y: number };
  // ===== END NEW =====
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
  // ===== NEW: Body Profile =====
  /** Snapshot dáng lúc phối; không có = outfit cũ, null = tắt mannequin. */
  mannequin?: MannequinProfile | null;
  // ===== END NEW =====
  // ===== NEW: Body 3D =====
  /** Có = outfit phối ở chế độ 3D (mở lại ở 3D). */
  scene3D?: Scene3D | null;
  // ===== END NEW =====
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
