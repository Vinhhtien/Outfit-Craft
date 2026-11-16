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
  'sneakers', 'heels', 'flats', 'sandals', 'slippers', 'boots', 'loafers',
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
  sandals: 'sandal có quai',
  slippers: 'dép lê/dép sục/dép tổ ong',
  boots: 'bốt',
  loafers: 'giày lười/giày da',
  bag: 'túi',
  accessory: 'phụ kiện',
  other: 'khác',
};

/** Cac loai hop le cho tung nhom; AI tra loai khong hop nhom -> "other". */
export const KINDS_BY_CATEGORY: Record<Category, readonly ItemKind[]> = {
  top: ['tshirt', 'shirt', 'polo', 'blouse', 'tank', 'sweater', 'cardigan', 'hoodie', 'sweatshirt'],
  bottom: ['jeans', 'trousers', 'pants', 'shorts', 'skirt', 'joggers', 'leggings'],
  outerwear: ['jacket', 'denim_jacket', 'blazer', 'coat', 'puffer', 'windbreaker', 'cardigan', 'hoodie'],
  dress: ['dress', 'jumpsuit'],
  set: ['set'],
  shoes: ['sneakers', 'heels', 'flats', 'sandals', 'slippers', 'boots', 'loafers'],
  bag: ['bag'],
  accessory: ['accessory'],
};

/** Loai co thuoc nhom nay khong ("other" hop moi nhom). */
export const kindFits = (category: Category, kind: ItemKind) =>
  kind === 'other' || KINDS_BY_CATEGORY[category].includes(kind);

/** Mon danh cho nu, nam hay ca hai. Khong ro -> coi nhu unisex. */
export const ITEM_GENDERS = ['female', 'male', 'unisex'] as const;
export type ItemGender = (typeof ITEM_GENDERS)[number];

export const ITEM_GENDER_NAMES_VI: Record<ItemGender, string> = {
  female: 'đồ nữ',
  male: 'đồ nam',
  unisex: 'unisex',
};

/** Tay ao AI nhin thay: dai, ngan, khong tay (hoac khong phai ao). */
export const ITEM_SLEEVES = ['long', 'short', 'none'] as const;
export type ItemSleeve = (typeof ITEM_SLEEVES)[number];

/** Hoa tiet AI nhin thay tren mon. */
export const ITEM_PATTERNS = ['plain', 'striped', 'checked', 'floral', 'graphic', 'other'] as const;
export type ItemPattern = (typeof ITEM_PATTERNS)[number];

/**
 * Dac diem chi nhin anh moi biet (AI xem 1 lan luc them / nhan dien mon, luu lai de goi y dung mai).
 * Co object nay = da phan tich, du AI khong noi duoc het tung truong.
 */
export interface VisualTraits {
  /** Do trang trong nhin tu anh: 0 = rat thoai mai / do the thao ... 3 = du tiec, sang trong. */
  formality?: number;
  /** Do the thao, ao dau bong da, do tap, dong phuc the thao. */
  sportswear?: boolean;
  pattern?: ItemPattern;
  /** Rach, mai, wash bac ro. */
  distressed?: boolean;
  /** Tay ao (de khong khuyen "xan tay ao" cho ao ngan tay). */
  sleeve?: ItemSleeve;
  analyzedAt?: Date;
}

/** Loai ma ban than la do nu (vay, chan vay...). Dung khi AI chua noi gioi tinh cua mon. */
export const KIND_GENDER: Partial<Record<ItemKind, ItemGender>> = {
  dress: 'female', skirt: 'female', blouse: 'female', heels: 'female',
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
