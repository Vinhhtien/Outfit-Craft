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

/** Loại chi tiết (áo len, áo phông...). AI tự nhận diện từ ảnh, người dùng sửa lại được. */
export const ITEM_KINDS = [
  'tshirt', 'shirt', 'polo', 'blouse', 'tank', 'sweater', 'cardigan', 'hoodie', 'sweatshirt',
  'jeans', 'trousers', 'pants', 'shorts', 'skirt', 'joggers', 'leggings',
  'jacket', 'denim_jacket', 'blazer', 'coat', 'puffer', 'windbreaker',
  'dress', 'jumpsuit', 'set',
  'sneakers', 'heels', 'flats', 'sandals', 'boots', 'loafers',
  'bag', 'accessory', 'other',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  tshirt: 'Áo phông / áo thun', shirt: 'Áo sơ mi', polo: 'Áo polo', blouse: 'Áo kiểu',
  tank: 'Áo ba lỗ / hai dây', sweater: 'Áo len', cardigan: 'Áo cardigan', hoodie: 'Áo hoodie',
  sweatshirt: 'Áo nỉ / sweatshirt',
  jeans: 'Quần jeans', trousers: 'Quần âu / quần tây', pants: 'Quần dài vải / kaki', shorts: 'Quần short',
  skirt: 'Chân váy', joggers: 'Quần jogger', leggings: 'Quần legging',
  jacket: 'Áo khoác', denim_jacket: 'Áo khoác jean', blazer: 'Áo blazer / vest', coat: 'Áo măng tô / áo dạ',
  puffer: 'Áo phao', windbreaker: 'Áo gió',
  dress: 'Váy liền', jumpsuit: 'Jumpsuit', set: 'Đồ bộ',
  sneakers: 'Giày thể thao', heels: 'Giày cao gót', flats: 'Giày bệt / búp bê', sandals: 'Sandal / dép',
  boots: 'Bốt', loafers: 'Giày lười / giày da',
  bag: 'Túi', accessory: 'Phụ kiện', other: 'Khác',
};

/** Các loại hợp lệ cho từng danh mục - giống KINDS_BY_CATEGORY ở server (itemKind.service.ts). */
export const KINDS_BY_CATEGORY: Record<Category, readonly ItemKind[]> = {
  top: ['tshirt', 'shirt', 'polo', 'blouse', 'tank', 'sweater', 'cardigan', 'hoodie', 'sweatshirt'],
  bottom: ['jeans', 'trousers', 'pants', 'shorts', 'skirt', 'joggers', 'leggings'],
  outerwear: ['jacket', 'denim_jacket', 'blazer', 'coat', 'puffer', 'windbreaker', 'cardigan', 'hoodie'],
  dress: ['dress', 'jumpsuit'],
  set: ['set'],
  shoes: ['sneakers', 'heels', 'flats', 'sandals', 'boots', 'loafers'],
  bag: ['bag'],
  accessory: ['accessory'],
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

export const COLOR_GROUPS = [
  'neutral', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown',
] as const;
export type ColorGroup = (typeof COLOR_GROUPS)[number];

export const COLOR_GROUP_LABELS: Record<ColorGroup, string> = {
  neutral: 'Trung tính', red: 'Đỏ', orange: 'Cam', yellow: 'Vàng', green: 'Xanh lá',
  blue: 'Xanh dương', purple: 'Tím', pink: 'Hồng', brown: 'Nâu',
};

/** Mau cham tron tren nut loc. */
export const COLOR_GROUP_SWATCHES: Record<ColorGroup, string> = {
  neutral: '#d6d3cb', red: '#d64545', orange: '#ef8f3a', yellow: '#f2c94c', green: '#4f9d69',
  blue: '#4a7fc1', purple: '#8e6bbf', pink: '#f2a7c3', brown: '#8b5e3c',
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
  /** Chưa có = AI chưa nhận diện xong. */
  kind?: ItemKind | null;
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
  set?: ClothingItem;
  outerwear?: ClothingItem;
  shoes?: ClothingItem;
  bag?: ClothingItem;
  accessory?: ClothingItem;
  /** Dinh danh bo do, gui lai de xao tron khong lap. */
  key?: string;
  totalScore: number;
  reasons: string[];
}

/** 1 doan chat tren thanh lich su. */
export interface StylistConversation {
  _id: string;
  title: string;
  lastMessageAt: string;
}

/** 1 tin trong doan chat. Hoi dap thuong thi khong co items. */
export interface StylistChatMessage {
  _id: string;
  role: 'user' | 'stylist';
  text: string;
  items: ClothingItem[];
  occasion?: Occasion;
  weather?: Weather;
  notes: string[];
  source?: 'ai' | 'rule';
}

/** AI goi y khi them do moi. */
export interface ItemTagSuggestion {
  styles: Style[];
  seasons: Season[];
  occasions: Occasion[];
  category?: Category;
  /** Luôn hợp với category nếu có. */
  kind?: ItemKind;
  /** Tên ngắn gợi ý, chỉ dùng khi người dùng chưa tự đặt tên. */
  name?: string;
}

/** Mon dang ghim khi goi y "Phoi voi mon nay". */
export interface SuggestionAnchor {
  item: ClothingItem;
  daysInactive: number;
  /** Lau chua mac (>= 180 ngay, cung moc voi man Don tu). */
  isDormant: boolean;
  weatherWarning?: string;
  missing: string[];
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

// ===== NEW: Thu do truc tiep =====
export interface TryOnQuota {
  /** false = backend chưa đặt DECART_API_KEY. */
  configured: boolean;
  dailySeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  maxSessionSeconds: number;
}

export interface TryOnSessionInfo {
  sessionId: string;
  maxSeconds: number;
}

export interface TryOnHeartbeat {
  active: boolean;
  usedSeconds: number;
  remainingSeconds: number;
}

export interface TryOnSnapshot {
  _id: string;
  item?: string;
  itemName?: string;
  imageUrl: string;
  createdAt: string;
}
// ===== END NEW =====
