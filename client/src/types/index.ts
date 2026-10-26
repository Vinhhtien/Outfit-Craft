/** Domain types - giu dong bo voi server/src/types/index.ts */

export const CATEGORIES = [
  'top', 'bottom', 'outerwear', 'dress', 'set', 'shoes', 'bag', 'accessory',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Áo',
  bottom: 'Quần / Chân váy',
  outerwear: 'Áo khoác',
  dress: 'Váy liền',
  set: 'Set / Đồ bộ',
  shoes: 'Giày',
  bag: 'Túi',
  accessory: 'Phụ kiện',
};

/** Layer mặc định trên canvas: số lớn = nằm trên. */
export const CATEGORY_Z_INDEX: Record<Category, number> = {
  shoes: 5, bottom: 10, dress: 20, set: 25, top: 30,
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
// Hang so dang nguoi nam o bodyConstants.ts (ban sao y het server).
export * from './bodyConstants';
import type { BodyGender, BodyShape, BodyMeasurements } from './bodyConstants';

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
  /** Nhạy cảm: chỉ chủ sở hữu đọc được, không bao giờ gửi cho AI gợi ý. */
  weightKg?: number;
  updatedAt?: string;
}
// ===== END NEW =====

/**
 * Dữ liệu CŨ (chỉ đọc) của outfit từng phối ở chế độ 3D đã bỏ. Server không nhận dữ liệu này nữa;
 * client chỉ dùng để dựng lại outfit trên canvas 2D. Xem server/src/models/Outfit.ts (IScene3D).
 */
export interface LegacyScene3DItem {
  itemId: string;
  /** Tên anchor (trùng tên anchor 2D) hoặc null = đặt tự do. */
  anchor: string | null;
  /** Mét, trục y hướng lên. Có anchor: điểm bám - anchor; không: vị trí tuyệt đối (gốc ở giữa hai bàn chân). */
  offset: [number, number, number];
  /** Bề rộng món đồ / bề rộng chuẩn của nhóm đồ trên cơ thể lúc phối. */
  scale: number;
  /** Radian, ngược chiều kim đồng hồ khi nhìn chính diện. */
  rotation: number;
  /** Thứ tự lớp: số lớn = nằm ngoài. */
  layer: number;
  /** Tỉ lệ cao/rộng của ảnh. */
  aspect?: number;
  flipX?: boolean;
}

export interface LegacyScene3D {
  version: number;
  /** Người khác xem outfit công khai: server bỏ trường này. */
  bodySnapshot?: MannequinProfile;
  showModel: boolean;
  items: LegacyScene3DItem[];
}

export interface User {
  role?: 'user' | 'admin';
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  defaultCity: string;
}

// ===== NEW: Ghi nho fit =====
/**
 * Vị trí + cỡ user đã căn trên người mẫu, lưu dạng tỉ lệ theo cơ thể (xem fitFromBox trong
 * lib/outfitPlacement.ts) -> lần sau thêm món này tự đặt đúng, với mọi số đo.
 */
export interface ItemFit {
  /** Danh mục lúc căn - đổi danh mục thì bỏ qua fit cũ. */
  category: Category;
  anchorRef: string;
  /** Độ lệch điểm tham chiếu so với anchor / bề rộng, chiều cao chuẩn của nhóm đồ. */
  offsetX: number;
  offsetY: number;
  /** Bề rộng, chiều cao món đồ / bề rộng, chiều cao chuẩn của nhóm đồ. */
  width: number;
  height: number;
}
// ===== END NEW =====

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
  purchasePrice?: number | null;
  costPerWear?: number | null;
  wearCount: number;
  lastWornAt?: string;
  isArchived: boolean;
  fit?: ItemFit | null; // NEW: Ghi nho fit
  createdAt: string;
  updatedAt: string;
}

export interface WardrobeStatsData {
  total: number;
  byCategory: { _id: Category; count: number }[];
  mostWorn: ClothingItem[];
  neverWorn: number;
  neverWornItems?: ClothingItem[];
  financial?: {
    totalValue: number;
    pricedCount: number;
    avgPrice: number;
  };
  bestValueItems?: (ClothingItem & { costPerWear?: number })[];
  wastefulItems?: ClothingItem[];
}

export interface DormantItemInfo {
  item: ClothingItem;
  daysInactive: number;
  tier: 'warning' | 'danger';
  reason: string;
}

export interface DeclutterSuggestionsData {
  totalDormant: number;
  totalDormantValue: number;
  countWarning: number;
  countDanger: number;
  warningList: DormantItemInfo[];
  dangerList: DormantItemInfo[];
  allDormant: DormantItemInfo[];
}

export const WISHLIST_PRIORITIES = ['low', 'medium', 'high'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export interface WishlistItem {
  _id: string;
  owner: string;
  name: string;
  category: Category;
  imageUrl?: string;
  productUrl?: string;
  price?: number;
  colors: string[];
  brand?: string;
  notes?: string;
  priority: WishlistPriority;
  isPurchased: boolean;
  purchasedAt?: string;
  createdAt: string;
  updatedAt: string;
  duplicates?: ClothingItem[];
  hasDuplicate?: boolean;
  duplicateCount?: number;
}

export interface WishlistResponseData {
  items: WishlistItem[];
  stats: {
    totalItems: number;
    unpurchasedCount: number;
    totalEstimatedBudget: number;
    duplicateWarningCount: number;
  };
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicates: ClothingItem[];
  count: number;
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
  /** Chỉ có ở outfit cũ phối ở chế độ 3D (đã bỏ) - chỉ đọc, xem LegacyScene3D. */
  scene3D?: LegacyScene3D | null;
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
