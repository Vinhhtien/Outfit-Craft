/**
 * Domain enums & shared types.
 * Giu o mot noi de client co the copy sang dung chung.
 */

export const CATEGORIES = [
  'top',          // ao (t-shirt, so mi, hoodie...)
  'bottom',       // quan, chan vay
  'outerwear',    // ao khoac, blazer
  'dress',        // vay lien than / jumpsuit
  'set',          // set do, do bo, pijama, suit coord
  'shoes',
  'bag',
  'accessory',    // mu, kinh, that lung, trang suc
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Loai chi tiet cua mon (ao len, ao phong, chan vay...). AI tu nhan tu anh + ten,
 * user sua lai duoc. Dung de stylist hieu dung yeu cau kieu "bo do voi ao len".
 */
export const ITEM_KINDS = [
  'tshirt', 'shirt', 'polo', 'blouse', 'tank', 'sweater', 'cardigan', 'hoodie', 'sweatshirt',
  'jeans', 'trousers', 'pants', 'shorts', 'skirt', 'joggers', 'leggings',
  'jacket', 'denim_jacket', 'blazer', 'coat', 'puffer', 'windbreaker',
  'dress', 'jumpsuit', 'set',
  'sneakers', 'heels', 'flats', 'sandals', 'boots', 'loafers',
  'bag', 'accessory', 'other',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_NAMES_VI: Record<ItemKind, string> = {
  tshirt: 'áo phông/áo thun',
  shirt: 'áo sơ mi',
  polo: 'áo polo',
  blouse: 'áo kiểu',
  tank: 'áo ba lỗ/áo hai dây',
  sweater: 'áo len',
  cardigan: 'áo cardigan (áo len cài khuy)',
  hoodie: 'áo hoodie',
  sweatshirt: 'áo nỉ/sweatshirt',
  jeans: 'quần jeans',
  trousers: 'quần âu/quần tây',
  pants: 'quần dài vải/kaki',
  shorts: 'quần short',
  skirt: 'chân váy',
  joggers: 'quần jogger/quần thể thao',
  leggings: 'quần legging',
  jacket: 'áo khoác',
  denim_jacket: 'áo khoác jean',
  blazer: 'áo blazer/vest',
  coat: 'áo măng tô/áo dạ',
  puffer: 'áo phao',
  windbreaker: 'áo gió',
  dress: 'váy liền',
  jumpsuit: 'jumpsuit',
  set: 'đồ bộ',
  sneakers: 'giày thể thao',
  heels: 'giày cao gót',
  flats: 'giày bệt/búp bê',
  sandals: 'sandal/dép',
  boots: 'bốt',
  loafers: 'giày lười/giày da',
  bag: 'túi',
  accessory: 'phụ kiện',
  other: 'khác',
};

/** Layer mac dinh tren canvas: so lon = nam tren. */
export const CATEGORY_Z_INDEX: Record<Category, number> = {
  shoes: 5,
  bottom: 10,
  dress: 20,
  set: 25,
  top: 30,
  outerwear: 40,
  bag: 50,
  accessory: 60,
};

export const STYLES = [
  'casual', 'formal', 'sporty', 'streetwear',
  'vintage', 'minimal', 'party',
] as const;
export type Style = (typeof STYLES)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Nhom mau de loc goi y, tinh tu ma hex (xem colorGroupOf). */
export const COLOR_GROUPS = [
  'neutral', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown',
] as const;
export type ColorGroup = (typeof COLOR_GROUPS)[number];

/** Dai nhiet do (C) phu hop cho tung item - dung cho goi y theo thoi tiet. */
export interface TempRange {
  min: number;
  max: number;
}

export const OCCASIONS = [
  'daily', 'work', 'school', 'date',
  'party', 'sport', 'travel',
] as const;
export type Occasion = (typeof OCCASIONS)[number];

// ===== NEW: Admin role =====
export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];
// ===== END NEW =====

// ===== NEW: Body Profile =====
// Hang so dang nguoi nam o bodyConstants.ts (ban sao y het o client).
export * from './bodyConstants.js';
import type { BodyGender, BodyShape, BodyMeasurements, UnitPreference } from './bodyConstants.js';

export interface BodyProfile {
  gender: BodyGender;
  shape: BodyShape;
  measurements?: BodyMeasurements;
  /** Nhay cam: chi chu so huu doc duoc, khong bao gio gui cho Gemini. */
  weightKg?: number;
  /** Tuy chon cua giao dien cu - server van nhan/giu, client hien tai khong dung. */
  unitPreference?: UnitPreference;
  modelColorHue?: number;
  showBmi?: boolean;
  updatedAt?: Date;
}
// ===== END NEW =====

export interface JwtPayload {
  sub: string;   // userId
  email: string;
}
