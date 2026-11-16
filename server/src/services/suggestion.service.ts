import { createHash } from 'node:crypto';
import { IClothingItem } from '../models/ClothingItem.js';
import {
  Category, ColorGroup, ITEM_GENDER_NAMES_VI, ITEM_KIND_NAMES_VI, ItemGender, ItemKind, KIND_GENDER, KINDS_BY_CATEGORY,
  Occasion, Season, Style, kindFits,
} from '../types/index.js';
import { WeatherInfo } from './weather.service.js';

export interface ScoredItem {
  item: IClothingItem;
  score: number;
  reasons: string[];
  /** Loai do trai dip dang chon (vd quan short di tiec), ke ca khi user gan nhan dip do. */
  unsuitable?: boolean;
  /** Do nam / nu trai voi nguoi mac (vd giay tay nam cho nguoi mac nu). */
  wrongGender?: boolean;
}

export interface OutfitSuggestion {
  top?: IClothingItem;
  bottom?: IClothingItem;
  dress?: IClothingItem;
  set?: IClothingItem;
  outerwear?: IClothingItem;
  shoes?: IClothingItem;
  accessory?: IClothingItem;
  bag?: IClothingItem;
  /** Dinh danh bo do, client gui lai de xao tron khong lap. */
  key?: string;
  totalScore: number;
  reasons: string[];
  /** Bo co mon chinh trai dip (tu khong co mon hop hon), client danh dau "chua that su hop dip". */
  occasionMismatch?: boolean;
  /** Bo tron do nam + do nu, hoac co mon trai gioi tinh nguoi mac (tu khong co mon hop hon). */
  genderMismatch?: boolean;
  /** Diem 1-10 khi Stylist AI xem anh that cua cac mon (chi co khi AI da xem). */
  lookScore?: number;
  /** 1 cau nhan xet cua Stylist AI sau khi xem anh bo nay. */
  lookComment?: string;
  /** Ten phong cach + cach mac (so vin, xan tay...): bo do duoc "phoi", khong chi la ghep mon. */
  styling?: OutfitStyling;
}

export interface OutfitStyling {
  /** Ten ngan cua phong cach, vd "Smart casual đi làm". */
  title: string;
  /** 1-3 meo cach mac cu the. */
  tips: string[];
  /** ai = Stylist AI viet sau khi xem anh that; rule = theo quy tac. */
  source: 'ai' | 'rule';
}

export const SEASON_NAMES_VI: Record<Season, string> = {
  spring: 'mùa xuân',
  summer: 'mùa hè',
  autumn: 'mùa thu',
  winter: 'mùa đông',
};

export const OCCASION_NAMES_VI: Record<Occasion, string> = {
  daily: 'hằng ngày',
  work: 'đi làm',
  school: 'đi học',
  date: 'hẹn hò',
  party: 'tiệc tùng',
  sport: 'thể thao',
  travel: 'du lịch',
};

/**
 * Dai nhiet do (C) theo loai chi tiet. Dai luu tren mon chi la mac dinh cua danh muc
 * (moi ao deu 18-35) nen khong phan biet duoc ao ba lo voi ao len.
 */
const KIND_TEMP_RANGE: Partial<Record<ItemKind, { min: number; max: number }>> = {
  tank: { min: 25, max: 40 },
  tshirt: { min: 22, max: 38 },
  polo: { min: 21, max: 36 },
  blouse: { min: 19, max: 34 },
  shirt: { min: 17, max: 33 },
  sweatshirt: { min: 10, max: 22 },
  hoodie: { min: 8, max: 21 },
  cardigan: { min: 12, max: 23 },
  sweater: { min: 3, max: 20 },
  shorts: { min: 25, max: 40 },
  skirt: { min: 19, max: 35 },
  jeans: { min: 8, max: 30 },
  trousers: { min: 10, max: 30 },
  pants: { min: 10, max: 32 },
  joggers: { min: 8, max: 26 },
  leggings: { min: 5, max: 24 },
  jacket: { min: 8, max: 21 },
  denim_jacket: { min: 12, max: 23 },
  blazer: { min: 12, max: 25 },
  windbreaker: { min: 12, max: 24 },
  coat: { min: -5, max: 15 },
  puffer: { min: -10, max: 12 },
  dress: { min: 21, max: 36 },
  jumpsuit: { min: 20, max: 34 },
  sandals: { min: 23, max: 40 },
  slippers: { min: 22, max: 40 },
  flats: { min: 15, max: 34 },
  heels: { min: 12, max: 35 },
  sneakers: { min: 0, max: 38 },
  loafers: { min: 5, max: 32 },
  boots: { min: -10, max: 20 },
};

type KindSource = Pick<IClothingItem, 'kind' | 'detectedKind' | 'category'>;

/**
 * Loai dung de cham diem: loai da luu; chua co hoac "other" thi lay loai AI nhin thay trong anh
 * neu loai do hop nhom. Lech nhom -> undefined (mon bi xep sai nhom, xem isMisfiled).
 */
export function effectiveKind(item: KindSource): ItemKind | undefined {
  if (item.kind && item.kind !== 'other') return item.kind;
  const seen = item.detectedKind;
  return seen && seen !== 'other' && kindFits(item.category, seen) ? seen : undefined;
}

/**
 * Mon bi xep sai nhom: anh la loai thuoc nhom khac (vd quan short de o nhom Ao).
 * User tu chon loai hop nhom thi tin user, khong coi la sai.
 */
export function isMisfiled(item: KindSource): boolean {
  const seen = item.detectedKind;
  return Boolean(seen && seen !== 'other' && (!item.kind || item.kind === 'other') && !kindFits(item.category, seen));
}

/** Dai nhiet do thuc dung cho mon: theo loai neu da nhan dien, khong thi lay dai luu tren mon. */
export function tempRangeOf(item: KindSource & Pick<IClothingItem, 'tempRange'>): { min: number; max: number } {
  const kind = effectiveKind(item);
  return (kind && KIND_TEMP_RANGE[kind]) || item.tempRange;
}

/** Diem hop dip theo loai do tu moc nay tro xuong = khong hop dip (vd quan short di tiec). */
export const UNSUITABLE_FIT = -30;

/**
 * Do hop dip theo loai do, khong phu thuoc nhan user gan: am = trai dip (tru diem), duong = dung kieu.
 * Loai khong co trong bang = trung tinh. Dip hang ngay khong rang buoc gi.
 */
const KIND_OCCASION_FIT: Partial<Record<Occasion, Partial<Record<ItemKind, number>>>> = {
  party: {
    shorts: -40, joggers: -40, leggings: -40, hoodie: -40, sweatshirt: -40, windbreaker: -35, tank: -30,
    slippers: -40, sandals: -30, puffer: -20, sneakers: -10,
    dress: 15, jumpsuit: 15, blazer: 15, heels: 15, blouse: 10, shirt: 10, skirt: 10, trousers: 10, loafers: 10, flats: 5,
  },
  work: {
    shorts: -40, joggers: -40, leggings: -40, tank: -40, hoodie: -40, slippers: -40, sweatshirt: -35, sandals: -35,
    windbreaker: -20, sneakers: -10,
    shirt: 15, blouse: 15, trousers: 15, blazer: 15, loafers: 15, pants: 10, flats: 10, heels: 10, polo: 5, skirt: 5,
  },
  date: {
    joggers: -40, slippers: -40, leggings: -35, sweatshirt: -20, windbreaker: -20, hoodie: -10,
    dress: 15, blouse: 10, shirt: 10, skirt: 10, heels: 10, loafers: 5, flats: 5,
  },
  school: { tank: -30, slippers: -30, heels: -15 },
  sport: {
    shirt: -40, blouse: -40, blazer: -40, coat: -40, trousers: -40, jeans: -40, dress: -40, heels: -40, loafers: -40,
    skirt: -35, jumpsuit: -35, flats: -35, boots: -35, slippers: -30, sweater: -20, cardigan: -20,
    sneakers: 20, tank: 15, shorts: 15, joggers: 15, leggings: 15, tshirt: 10, windbreaker: 10, hoodie: 5, sweatshirt: 5,
  },
  travel: { heels: -30 },
};

/** Mon co the kem dac diem AI nhin tu anh. */
type VisualSource = KindSource & Partial<Pick<IClothingItem, 'visual'>>;

/** Dac diem nhin tu anh lam lech dip, cong don voi diem theo loai (ao dau bong da di tiec, jeans rach di lam). */
const SPORTSWEAR_FIT: Partial<Record<Occasion, number>> = { party: -40, work: -40, date: -40, school: -10, sport: 15 };
const DISTRESSED_FIT: Partial<Record<Occasion, number>> = { work: -35, party: -20, date: -10, school: -10 };
/** Dip can an mac chin chu: mon qua thoai mai (trang trong 0) bi tru. */
const DRESSY_OCCASIONS: readonly Occasion[] = ['party', 'work', 'date'];

function kindFitOf(item: KindSource, occasion: Occasion): number {
  const kind = effectiveKind(item);
  return kind ? KIND_OCCASION_FIT[occasion]?.[kind] ?? 0 : 0;
}

function visualFitOf(item: VisualSource, occasion: Occasion): number {
  const v = item.visual;
  if (!v) return 0;
  let fit = 0;
  if (v.sportswear) fit += SPORTSWEAR_FIT[occasion] ?? 0;
  if (v.distressed) fit += DISTRESSED_FIT[occasion] ?? 0;
  if (v.formality !== undefined) {
    if (DRESSY_OCCASIONS.includes(occasion) && v.formality === 0 && !v.sportswear) fit -= 35;
    else if (occasion === 'party' && v.formality === 3) fit += 10;
    else if (occasion === 'work' && v.formality >= 2) fit += 5;
    if (occasion === 'sport' && v.formality === 3) fit -= 30;
  }
  return fit;
}

/** Diem hop dip cua mon: theo loai do + dac diem nhin tu anh (0 = trung tinh hoac chua biet). */
export function occasionFitOf(item: VisualSource, occasion?: Occasion): number {
  if (!occasion) return 0;
  return kindFitOf(item, occasion) + visualFitOf(item, occasion);
}

/** Ten goi cai lam mon trai dip, de ly do noi dung van de (vd "Đồ thể thao", "Quần short"). */
function mismatchLabel(item: VisualSource, occasion: Occasion): string {
  const kind = effectiveKind(item);
  const kindName = kind ? capitalize(ITEM_KIND_NAMES_VI[kind]) : '';
  if (kind && kindFitOf(item, occasion) <= UNSUITABLE_FIT) return kindName;
  if (item.visual?.sportswear) return 'Đồ thể thao';
  if (item.visual?.distressed) return 'Đồ rách, wash bạc';
  if (item.visual?.formality === 0) return 'Món quá thoải mái';
  return kindName || 'Món này';
}

/** Cac loai nen sam cho 1 nhom o 1 dip, hop nhat truoc - dung khi tu chua co mon hop dip. */
export function recommendedKinds(category: Category, occasion: Occasion, count = 3): ItemKind[] {
  const fit = KIND_OCCASION_FIT[occasion] ?? {};
  return KINDS_BY_CATEGORY[category]
    .filter((k) => (fit[k] ?? 0) > 0)
    .sort((a, b) => (fit[b] ?? 0) - (fit[a] ?? 0))
    .slice(0, count);
}

/**
 * Do trang trong theo loai do: 0 = rat thoai mai (dep le, do the thao), 1 = thuong ngay,
 * 2 = lich su vua (smart casual), 3 = sang trong (vay tiec, giay cao got, blazer).
 * Quy tac stylist: cac mon trong 1 bo nen gan nhau ve do trang trong (vay tiec khong di dep suc).
 */
const KIND_FORMALITY: Partial<Record<ItemKind, number>> = {
  tank: 0, hoodie: 0, sweatshirt: 0, tshirt: 1, polo: 1, sweater: 1, cardigan: 2, shirt: 2, blouse: 2,
  joggers: 0, leggings: 0, shorts: 0, jeans: 1, pants: 1, skirt: 2, trousers: 2,
  dress: 2, jumpsuit: 2, set: 1,
  slippers: 0, sneakers: 1, sandals: 1, boots: 2, flats: 2, loafers: 2, heels: 3,
};
/** Mon gan phong cach nay duoc nang 1 bac trang trong (vd vay gan "du tiec" -> vay tiec). */
const DRESSY_STYLES: readonly Style[] = ['party', 'formal'];

/** Do trang trong cua mon: AI nhin anh thi lay theo do; khong thi doan theo loai. Chua biet -> undefined. */
export function formalityOf(item: VisualSource & Pick<IClothingItem, 'styles'>): number | undefined {
  if (item.visual?.formality !== undefined) return item.visual.formality;
  const kind = effectiveKind(item);
  const base = kind === undefined ? undefined : KIND_FORMALITY[kind];
  if (base === undefined) return undefined;
  return item.styles.some((s) => DRESSY_STYLES.includes(s)) ? Math.min(3, base + 1) : base;
}

/** Cac mon tinh do dong deu trang trong: mon chinh + giay. Ao khoac, tui, phu kien thuong duoc mix nen bo qua. */
const formalityPieces = (items: IClothingItem[]) =>
  items.filter((i) => i.category !== 'outerwear' && !isSmallPiece(i));

/** Do lech trang trong lon nhat trong 1 bo (0 = dong deu, 3 = vay tiec + dep le). */
export function formalityGap(items: IClothingItem[]): number {
  const levels = formalityPieces(items).map(formalityOf).filter((v): v is number => v !== undefined);
  return levels.length < 2 ? 0 : Math.max(...levels) - Math.min(...levels);
}

/** Diem tru theo do lech: lech 2 bac (jeans + cao got) van la mix chap nhan duoc, lech 3 bac thi khong. */
const FORMALITY_GAP_PENALTY = [0, 0, 6, 25];

/** So mon quan ao co hoa tiet (ke, caro, hoa, in graphic) trong bo; giay, tui, phu kien khong tinh. */
export function patternedCount(items: IClothingItem[]): number {
  return items.filter((i) => !isSmallPiece(i) && i.category !== 'shoes'
    && i.visual?.pattern !== undefined && i.visual.pattern !== 'plain' && i.visual.pattern !== 'other').length;
}
/** Tu 2 mon hoa tiet: tru nhe, van phoi duoc neu tu khong co lua chon hon. */
const PATTERN_CLASH_PENALTY = 8;

/* ---------- Do nam / do nu ---------- */

/** Nguoi mac (tu ho so dang nguoi). Khong khai / trung tinh -> chi giu bo do khong tron nam nu. */
export type Wearer = 'female' | 'male';

/** Do nam / nu cua mon: AI hoac user da noi -> theo do; chua co thi suy tu loai (vay -> nu); khong ro -> unisex. */
export function genderOf(item: KindSource & Pick<IClothingItem, 'gender'>): ItemGender {
  if (item.gender) return item.gender;
  const kind = effectiveKind(item);
  return (kind && KIND_GENDER[kind]) || 'unisex';
}

/** Mon do nam / nu trai voi nguoi mac (vd giay tay nam cho nguoi mac nu). */
const isWrongGender = (item: IClothingItem, wearer?: Wearer) => {
  const gender = genderOf(item);
  return Boolean(wearer && gender !== 'unisex' && gender !== wearer);
};

/** Bo do tron ca do nam lan do nu (vay + giay tay nam). Tui, phu kien khong tinh. */
export function mixesGenders(items: IClothingItem[]): boolean {
  const genders = new Set(items.filter((i) => !isSmallPiece(i)).map(genderOf));
  return genders.has('female') && genders.has('male');
}

/** Tron do nam + do nu trong 1 bo: tru nang, gan nhu khong bao gio duoc chon neu con lua chon khac. */
const MIXED_GENDER_PENALTY = 30;
/** Mon trai gioi tinh nguoi mac: tru diem tung mon. */
const WRONG_GENDER_PENALTY = 40;

/** Loai nen sam theo nhom cho nguoi mac nu / nam (khi khong co dip cu the). */
const GENDER_KIND_SUGGESTIONS: Record<Wearer, Partial<Record<Category, ItemKind[]>>> = {
  female: {
    top: ['blouse', 'shirt', 'tshirt'], bottom: ['skirt', 'trousers', 'jeans'], dress: ['dress', 'jumpsuit'],
    shoes: ['heels', 'flats', 'sandals'], outerwear: ['blazer', 'cardigan', 'jacket'],
  },
  male: {
    top: ['shirt', 'polo', 'tshirt'], bottom: ['trousers', 'jeans', 'pants'],
    shoes: ['loafers', 'sneakers', 'boots'], outerwear: ['blazer', 'jacket', 'coat'],
  },
};

/** Loai nen sam cho 1 nhom, hop gioi tinh nguoi mac va (neu co) hop dip. */
function kindsToAdd(category: Category, target: Wearer, occasion?: Occasion): ItemKind[] {
  const fitsTarget = (k: ItemKind) => !KIND_GENDER[k] || KIND_GENDER[k] === target;
  const byOccasion = occasion ? recommendedKinds(category, occasion, 6).filter(fitsTarget).slice(0, 3) : [];
  return byOccasion.length > 0 ? byOccasion : GENDER_KIND_SUGGESTIONS[target][category] ?? [];
}

/** Cac mua hop voi 1 nhiet do (de so voi mua user gan cho mon). */
function seasonsForTemp(temp: number): Season[] {
  if (temp < 16) return ['winter'];
  if (temp < 22) return ['autumn', 'winter', 'spring'];
  if (temp <= 27) return ['spring', 'summer', 'autumn'];
  return ['summer'];
}

/**
 * Cham diem 1 item theo thoi tiet + ngu canh.
 * Thang diem ~0-100, cong don tung tieu chi.
 */
export function scoreItem(
  item: IClothingItem,
  weather: WeatherInfo,
  occasion?: Occasion
): ScoredItem {
  let score = 50; // diem nen
  const reasons: string[] = [];

  // 1. Nhiet do - tieu chi nang nhat.
  const { min, max } = tempRangeOf(item);
  if (weather.temp >= min && weather.temp <= max) {
    score += 30;
    reasons.push(`Phù hợp nhiệt độ ${weather.temp}°C`);
  } else {
    // Cang lech xa khoang phu hop, tru cang nhieu (toi da -40).
    const gap = weather.temp < min ? min - weather.temp : weather.temp - max;
    score -= Math.min(gap * 3, 40);
    reasons.push(
      weather.temp < min ? 'Có thể hơi mỏng so với tiết trời lạnh' : 'Có thể hơi nóng'
    );
  }

  // 2. Mua user gan cho mon so voi nhiet do can mac (khong theo lich: 20 do thang 11 van can do mua dong).
  const fitting = seasonsForTemp(weather.temp);
  const matched = item.seasons.find((s) => fitting.includes(s));
  if (matched) {
    score += 10;
    reasons.push(`Hợp ${SEASON_NAMES_VI[matched]}`);
  } else if (item.seasons.length > 0) {
    score -= 10;
    reasons.push(`Là đồ ${item.seasons.map((s) => SEASON_NAMES_VI[s]).join(', ')}`);
  }

  // 3. Ngu canh nguoi dung chon. Loai do quyet dinh truoc: quan short gan nhan "tiec" van khong hop di tiec,
  // nhan user gan chi duoc cong khi loai do khong trai dip.
  const fit = occasionFitOf(item, occasion);
  const unsuitable = fit <= UNSUITABLE_FIT;
  if (occasion) {
    const occasionName = OCCASION_NAMES_VI[occasion] || occasion;
    const kind = effectiveKind(item);
    const kindName = kind ? capitalize(ITEM_KIND_NAMES_VI[kind]) : '';
    const tagged = item.occasions.includes(occasion);
    if (tagged && !unsuitable) {
      score += 15;
      reasons.push(`Phù hợp dịp ${occasionName}`);
    }
    score += fit;
    if (unsuitable) reasons.push(`${mismatchLabel(item, occasion)} thường không hợp dịp ${occasionName}`);
    else if (fit > 0 && !tagged) reasons.push(`${kindName || 'Món này'} hợp dịp ${occasionName}`);
  }

  // 3b. Anh la loai thuoc nhom khac (vd quan short xep vao nhom Ao): khong dung vao vi tri do.
  if (isMisfiled(item)) {
    score -= 50;
    reasons.push(`Ảnh trông giống ${ITEM_KIND_NAMES_VI[item.detectedKind!]}, có thể đang xếp nhầm nhóm`);
  }

  // 4. Troi mua - uu tien do toi mau, tru giay vai sang mau.
  if (weather.isRaining && item.category === 'shoes') {
    const light = item.colors.some((c) => isLightColor(c));
    if (light) {
      score -= 15;
      reasons.push('Trời mưa, giày sáng màu dễ bám bẩn');
    }
  }

  // 5. Uu tien nhe do it mac de tu do da dang hon.
  if (item.wearCount === 0) {
    score += 5;
    reasons.push('Chưa mặc lần nào');
  }

  return {
    item, score: Math.min(100, Math.max(0, Math.round(score))), reasons, ...(unsuitable ? { unsuitable: true } : {}),
  };
}

/** Do sang cam nhan (luma) de biet mau sang hay toi. */
export function isLightColor(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
}

/** Loi nhac chung theo thoi tiet, dung cho ca goi y thuong va goi y quanh 1 mon. */
function weatherReasons(weather: WeatherInfo): string[] {
  const reasons: string[] = [];
  if (weather.isRaining) reasons.push('Trời đang mưa, bạn nên mang theo ô dù hoặc áo mưa.');
  if (weather.temp < 18) reasons.push('Thời tiết se lạnh, nên khoác thêm áo ngoài.');
  if (weather.temp > 32) reasons.push('Thời tiết ấm nóng, ưu tiên chất liệu thoáng mát.');
  return reasons;
}

/* ================= Phoi quanh 1 mon (anchor) ================= */

export const CATEGORY_NAMES_VI: Record<Category, string> = {
  top: 'áo',
  bottom: 'quần',
  outerwear: 'áo khoác',
  dress: 'váy',
  set: 'đồ bộ',
  shoes: 'giày',
  bag: 'túi',
  accessory: 'phụ kiện',
};

/** Ten loai chi tiet (ao len, ao phong...). Chua nhan dien hoac "other" -> ten nhom. */
export function kindLabel(item: Pick<IClothingItem, 'kind' | 'category'>): string {
  return item.kind && item.kind !== 'other' ? ITEM_KIND_NAMES_VI[item.kind] : CATEGORY_NAMES_VI[item.category];
}

export const STYLE_NAMES_VI: Record<Style, string> = {
  casual: 'thường ngày',
  formal: 'lịch sự',
  sporty: 'thể thao',
  streetwear: 'đường phố',
  vintage: 'cổ điển',
  minimal: 'tối giản',
  party: 'dự tiệc',
};

interface Hsl { h: number; s: number; l: number }

function toHsl(hex?: string): Hsl | null {
  const m = hex ? /^#([0-9a-f]{6})$/i.exec(hex) : null;
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Mau trung tinh (den, trang, xam, be/kem, xanh navy) - phoi duoc voi moi mau. */
export function isNeutralColor(hex?: string): boolean {
  const c = toHsl(hex);
  if (!c) return false;
  if (c.s < 0.15 || c.l > 0.9 || c.l < 0.12) return true;
  if (c.h >= 20 && c.h <= 50 && c.s < 0.6 && c.l > 0.6) return true; // be, kem, kaki nhat
  if (c.h >= 200 && c.h <= 250 && c.l < 0.3) return true; // xanh navy
  return false;
}

export type ColorRelation = 'neutral' | 'analogous' | 'formula' | 'complementary' | 'clash' | 'other' | 'unknown';

/** Quan he 2 mau tren vong mau: cung tong (<=30 do), bo tuc (>=150 do), choi nhau (60-120 do). */
export function colorRelation(a?: string, b?: string): ColorRelation {
  const ca = toHsl(a), cb = toHsl(b);
  if (!ca || !cb) return 'unknown';
  if (isNeutralColor(a) || isNeutralColor(b)) return 'neutral';
  const diff = Math.abs(ca.h - cb.h);
  const d = Math.min(diff, 360 - diff);
  if (d <= 30) return 'analogous';
  if (d >= 150) return 'complementary';
  if (d >= 60 && d <= 120) return 'clash';
  return 'other';
}

const COLOR_RELATION_SCORE: Record<ColorRelation, number> = {
  neutral: 90, analogous: 85, formula: 80, complementary: 75, other: 55, clash: 30, unknown: 60,
};

/** Diem hop mau 0-100 giua 2 mau chinh. Thieu mau -> diem trung binh. */
export function colorHarmony(a?: string, b?: string): number {
  return COLOR_RELATION_SCORE[colorRelation(a, b)];
}

/** Xanh denim (xanh lam nhat/vua, it bao hoa) - mau cua quan jeans. */
function isDenimBlue(hex?: string): boolean {
  const c = toHsl(hex);
  return Boolean(c && c.h >= 200 && c.h <= 230 && c.s < 0.5 && c.l >= 0.2 && c.l <= 0.8);
}

/** Mon co mau trung tinh. Quan jeans cung tinh la trung tinh vi phoi duoc voi hau het moi mau. */
export function isNeutralItem(item: IClothingItem): boolean {
  const hex = item.colors[0];
  return isNeutralColor(hex) || (item.category === 'bottom' && isDenimBlue(hex));
}

/**
 * "Cong thuc phoi do da nang": moi mau chinh di kem cac nhom mau trong bang (mau trung tinh
 * den, trang, xam, navy trong bang da duoc tinh la 'neutral' nen khong liet ke). Cap mau
 * co hieu luc ca hai chieu. Client giu ban hien thi day du o client/src/lib/colorFormula.ts.
 */
export const COLOR_FORMULA: Record<Exclude<ColorGroup, 'neutral'>, ColorGroup[]> = {
  red: ['yellow', 'pink', 'green', 'blue', 'brown'],
  orange: ['green', 'blue', 'yellow', 'brown'],
  yellow: ['green', 'blue', 'pink', 'red', 'orange'],
  green: ['blue', 'orange', 'purple', 'brown', 'pink', 'yellow'],
  blue: ['pink', 'green', 'purple', 'yellow', 'red'],
  purple: ['pink', 'blue', 'brown', 'green', 'yellow'],
  pink: ['brown', 'blue', 'green', 'purple', 'yellow'],
  brown: ['yellow', 'green', 'blue', 'pink', 'purple', 'red'],
};

/** 2 nhom mau ruc (khac nhau) co nam trong bang cong thuc khong. */
export function isFormulaPair(a: ColorGroup | null, b: ColorGroup | null): boolean {
  if (!a || !b || a === b || a === 'neutral' || b === 'neutral') return false;
  return COLOR_FORMULA[a].includes(b) || COLOR_FORMULA[b].includes(a);
}

/** Nhu colorRelation nhung xet theo mon (luat quan jeans, cong thuc phoi mau). */
export function itemColorRelation(a: IClothingItem, b: IClothingItem): ColorRelation {
  const rel = colorRelation(a.colors[0], b.colors[0]);
  if (rel === 'unknown' || rel === 'neutral') return rel;
  if (isNeutralItem(a) || isNeutralItem(b)) return 'neutral';
  if (rel === 'analogous') return rel;
  return isFormulaPair(colorGroupOf(a.colors[0]), colorGroupOf(b.colors[0])) ? 'formula' : rel;
}

const isSmallPiece = (item: IClothingItem) => item.category === 'bag' || item.category === 'accessory';

const MAIN_PIECES: readonly Category[] = ['top', 'bottom', 'dress', 'set', 'outerwear'];
const isMainPiece = (category: Category) => MAIN_PIECES.includes(category);
/** Mon quyet dinh bo do co hop dip khong: mon chinh + giay (tui, phu kien khong tinh). */
const isOccasionPiece = (category: Category) => isMainPiece(category) || category === 'shoes';

export const COLOR_NAMES_VI: Record<ColorGroup, string> = {
  neutral: 'trung tính',
  red: 'đỏ',
  orange: 'cam',
  yellow: 'vàng',
  green: 'xanh lá',
  blue: 'xanh dương',
  purple: 'tím',
  pink: 'hồng',
  brown: 'nâu',
};

/** Xep ma mau vao nhom de loc. Ma mau khong hop le -> null. */
export function colorGroupOf(hex?: string): ColorGroup | null {
  const c = toHsl(hex);
  if (!c) return null;
  if (isNeutralColor(hex)) return 'neutral';
  const { h, l } = c;
  if (h < 15 || h >= 345) return l > 0.75 ? 'pink' : 'red';
  if (h < 45) return l < 0.4 ? 'brown' : 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

/** Xet mau chinh cua mon. Quan jeans khop ca nhom xanh duong lan trung tinh. */
export function itemMatchesColor(item: IClothingItem, groups: ColorGroup[]): boolean {
  const group = colorGroupOf(item.colors[0]);
  return (group !== null && groups.includes(group)) || (groups.includes('neutral') && isNeutralItem(item));
}

/** Cac phong cach mac chung duoc voi nhau (bang doi xung). */
const STYLE_COMPAT: Record<Style, Style[]> = {
  casual: ['streetwear', 'minimal', 'vintage', 'sporty'],
  streetwear: ['casual', 'sporty', 'vintage'],
  minimal: ['casual', 'formal', 'vintage', 'party'],
  vintage: ['casual', 'minimal', 'streetwear'],
  formal: ['minimal', 'party'],
  sporty: ['casual', 'streetwear'],
  party: ['formal', 'minimal'],
};

/** Diem dong bo phong cach 0-100: chung style 100, hop nhau 75, lech 25, chua gan style 60. */
export function styleCompat(a: Style[], b: Style[]): number {
  if (a.length === 0 || b.length === 0) return 60;
  if (a.some((s) => b.includes(s))) return 100;
  if (a.some((s) => STYLE_COMPAT[s].some((t) => b.includes(t)))) return 75;
  return 25;
}

/** So nhom mau ruc khac nhau (cach nhau > 30 do) tren cac mon chinh (bo qua tui, phu kien). */
function countVividHues(items: IClothingItem[]): number {
  const hues: number[] = [];
  for (const item of items) {
    const c = toHsl(item.colors[0]);
    if (!c || isSmallPiece(item) || isNeutralItem(item)) continue;
    const near = hues.some((h) => Math.min(Math.abs(h - c.h), 360 - Math.abs(h - c.h)) <= 30);
    if (!near) hues.push(c.h);
  }
  return hues.length;
}

/**
 * Diem ca bo = 0.5 x diem thoi tiet/dip + 0.3 x hop mau + 0.2 x dong bo phong cach.
 * Hop mau va phong cach lay trung binh co trong so tren moi cap mon: cap co tui/phu kien
 * chi tinh nua trong so, tru khi cap do chua mon dang ghim (anchor).
 */
export function scoreCombo(picks: ScoredItem[], anchor?: ScoredItem): number {
  if (picks.length === 0) return 0;
  const avgItem = picks.reduce((s, p) => s + p.score, 0) / picks.length;
  if (picks.length === 1) return Math.round(avgItem);

  let color = 0, style = 0, weights = 0;
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i], b = picks[j];
      const weight = a === anchor || b === anchor || (!isSmallPiece(a.item) && !isSmallPiece(b.item)) ? 1 : 0.5;
      color += weight * COLOR_RELATION_SCORE[itemColorRelation(a.item, b.item)];
      style += weight * styleCompat(a.item.styles, b.item.styles);
      weights += weight;
    }
  }
  color /= weights;
  style /= weights;
  // Tu 3 mau ruc tro len trong 1 bo de bi roi mat.
  if (countVividHues(picks.map((p) => p.item)) >= 3) color -= 15;

  // Mon trong bo phai dong deu do trang trong: vay tiec + dep suc bi tru nang du hop mau, hop nhan phong cach.
  const formalityPenalty = FORMALITY_GAP_PENALTY.at(formalityGap(picks.map((p) => p.item))) ?? 0;
  // Vay nu + giay tay nam: bo do khong ai mac duoc nhu vay.
  const genderPenalty = mixesGenders(picks.map((p) => p.item)) ? MIXED_GENDER_PENALTY : 0;
  // Tu 2 mon hoa tiet tro len (ao graphic + quan caro...) de roi mat.
  const patternPenalty = patternedCount(picks.map((p) => p.item)) >= 2 ? PATTERN_CLASH_PENALTY : 0;

  return Math.min(100, Math.max(0, Math.round(0.5 * avgItem + 0.3 * color + 0.2 * style - formalityPenalty - genderPenalty - patternPenalty)));
}

const CANDIDATES_PER_SLOT = 4;
/** Bo khong co giay trong khi tu co giay (vi khong doi nao hop): xep sau bo du giay. */
const MISSING_SHOES_PENALTY = 10;
const OPTION_COUNT = 3;
/** Xao tron: moi vi tri lay tu cac mon gan diem mon tot nhat, roi giu cac bo gan diem bo tot nhat. */
const SHUFFLE_POOL_PER_SLOT = 8;
const SHUFFLE_ITEM_MARGIN = 20;
const SHUFFLE_COMBO_MARGIN = 10;
/** Diem cong cho mon dung phong cach user yeu cau (phong cach la uu tien, khong loai han). */
const STYLE_PREFERENCE_BONUS = 15;

export interface SuggestionFilters {
  seasons?: Season[];
  /** Bo do phai co it nhat 1 mon chinh thuoc 1 trong cac nhom mau nay. */
  colorGroups?: ColorGroup[];
  styles?: Style[];
}

export interface ShuffleOptions {
  /** key cac bo vua hien, tranh lap lai. */
  seen?: string[];
  /** Mon cua bo vua hien: "doi bo khac" uu tien bo trung it mon chinh nhat voi bo nay. */
  avoid?: string[];
  rng?: () => number;
}

export interface BuildOutfitOptions {
  /** Mon co dinh, luon nam trong bo do ke ca khi khong khop bo loc. */
  anchor?: IClothingItem;
  /**
   * Mon user muon mac (vd moi ao len trong tu). Khong co anchor thi 1 mon trong nhom nay
   * duoc ghim; cac loai do co trong nhom chi chon trong nhom.
   */
  include?: string[];
  /** Mon user khong muon mac, khong bao gio duoc chon. */
  exclude?: string[];
  filters?: SuggestionFilters;
  shuffle?: ShuffleOptions;
  /** Nguoi mac nu / nam (ho so dang nguoi). Bo trong -> chi tranh tron do nam nu trong 1 bo. */
  wearer?: Wearer;
  /** So phuong an toi da (mac dinh 3). Lay nhieu hon khi AI se xem anh roi chon lai. */
  optionCount?: number;
}

export interface OutfitOptionsResult {
  /** Toi da 3 phuong an, diem cao nhat truoc. */
  options: OutfitSuggestion[];
  /** Mon dang ghim lech nhiet do hom nay. */
  weatherWarning?: string;
  /** Mua dang loc lech thoi tiet hom nay. */
  seasonWarning?: string;
  /** Vi tri tu do chua co mon de ghep. */
  missing: string[];
  /** Mon thuc su duoc ghim (anchor, hoac mon chon tu include). */
  pinned?: IClothingItem;
  /** Mon chinh cua phuong an dau lech nhiet do ro rang (tu khong co lua chon hop hon). */
  weatherFit: string[];
  /** Mon cua phuong an dau trai dip dang chon (tu khong co mon hop hon) + loai nen sam them. */
  occasionFit: string[];
  /** Mon bi xep sai nhom (vd quan short o nhom Ao) nen khong duoc dung, nhac user sua. */
  misfiled: string[];
  /** Bo dau tron do nam nu / trai gioi tinh nguoi mac vi tu chua co mon hop + loai nen sam. */
  genderFit: string[];
  /**
   * Khong phoi bo nao vi mon ghim / mon user muon mac trai gioi tinh nguoi mac. Co gia tri thi options rong,
   * client hien thong bao nay thay cho bo do.
   */
  blocked?: string;
}

/** Chi nhac vai mon xep sai nhom moi lan, tranh danh sach dai. */
const MAX_MISFILED_NOTES = 2;

/** Lech qua chung nay do so voi dai cua mon thi bao cho user. */
const WEATHER_FIT_TOLERANCE = 3;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ly do cho 1 phuong an: mau tung mon so voi mon lam moc, phong cach chung, thoi tiet. */
function comboReasons(base: ScoredItem, picks: ScoredItem[], weather: WeatherInfo): string[] {
  const baseName = CATEGORY_NAMES_VI[base.item.category];
  const others = picks.filter((p) => p !== base);
  const reasons: string[] = [];

  for (const p of others) {
    if (isSmallPiece(p.item)) continue;
    const name = capitalize(CATEGORY_NAMES_VI[p.item.category]);
    const rel = itemColorRelation(p.item, base.item);
    if (rel === 'neutral') {
      reasons.push(isNeutralItem(p.item)
        ? `${name} màu trung tính, dễ đi với ${baseName} của bạn`
        : `${name} nổi bật trên nền ${baseName} màu trung tính`);
    } else if (rel === 'analogous') {
      reasons.push(`${name} cùng tông màu với ${baseName}, tạo cảm giác hài hoà`);
    } else if (rel === 'formula') {
      const own = colorGroupOf(p.item.colors[0]), other = colorGroupOf(base.item.colors[0]);
      reasons.push(own && other
        ? `${name} ${COLOR_NAMES_VI[own]} đi với ${baseName} ${COLOR_NAMES_VI[other]} theo công thức phối màu`
        : `${name} và ${baseName} hợp màu theo công thức phối màu`);
    } else if (rel === 'complementary') {
      reasons.push(`${name} có màu tương phản với ${baseName}, tạo điểm nhấn`);
    } else if (rel === 'clash') {
      reasons.push(`${name} và ${baseName} hơi chọi màu, có thể đổi sang phương án khác`);
    }
  }

  // Bo van lech trang trong (tu khong co lua chon hon): noi thang nhu stylist, khong im lang.
  const levels = formalityPieces(picks.map((p) => p.item))
    .flatMap((item) => {
      const level = formalityOf(item);
      return level === undefined ? [] : [{ item, level }];
    })
    .sort((a, b) => a.level - b.level);
  const low = levels.at(0), high = levels.at(-1);
  if (low && high && high.level - low.level >= 3) {
    reasons.push(
      `${capitalize(CATEGORY_NAMES_VI[low.item.category])} "${low.item.name}" hơi xuề xòa so với ${CATEGORY_NAMES_VI[high.item.category]} "${high.item.name}", nên đổi sang món trang trọng hơn nếu có`
    );
  }

  const shared = base.item.styles.find((st) =>
    others.filter((o) => o.item.styles.includes(st)).length >= Math.max(1, Math.ceil(others.length / 2))
  );
  if (shared) reasons.push(`Cùng phong cách ${STYLE_NAMES_VI[shared]}`);

  const { min, max } = tempRangeOf(base.item);
  if (weather.temp >= min && weather.temp <= max) reasons.push(`Phù hợp nhiệt độ ${weather.temp}°C`);

  return [...reasons, ...weatherReasons(weather)];
}

function shuffled<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Dinh danh 1 bo do, khong phu thuoc thu tu mon. */
function comboKey(picks: ScoredItem[]): string {
  const ids = picks.map((p) => String(p.item._id)).sort().join(',');
  return createHash('sha1').update(ids).digest('hex').slice(0, 10);
}

function seasonMismatch(seasons: Season[], weather: WeatherInfo): string | undefined {
  const fitting: Season[] = weather.temp < 18 ? ['winter'] : weather.temp <= 25 ? ['spring', 'autumn'] : ['summer'];
  if (seasons.length === 0 || seasons.some((s) => fitting.includes(s))) return undefined;
  const names = seasons.map((s) => SEASON_NAMES_VI[s]).join(', ');
  return `Bạn đang lọc đồ ${names}, nhưng hôm nay ${weather.temp}°C nên có thể chưa hợp thời tiết.`;
}

/**
 * Ghep bo do: moi vi tri lay vai ung vien diem cao, thu moi to hop, cham diem ca bo (scoreCombo)
 * roi tra ve cac phuong an khac nhau. Co anchor thi moi bo deu chua mon do.
 * Xao tron: boc ngau nhien ung vien va phuong an, nhung chi trong nhom diem cao.
 */
export function buildOutfitOptions(
  items: IClothingItem[],
  weather: WeatherInfo,
  occasion?: Occasion,
  { anchor: fixedAnchor, include = [], exclude = [], filters = {}, shuffle, wearer, optionCount = OPTION_COUNT }: BuildOutfitOptions = {}
): OutfitOptionsResult {
  const { seasons = [], colorGroups = [], styles = [] } = filters;
  const rng = shuffle ? shuffle.rng ?? Math.random : undefined;
  const idOf = (item: IClothingItem) => String(item._id);
  const excluded = new Set(exclude);
  const excludedCats = new Set(items.filter((i) => excluded.has(idOf(i))).map((i) => i.category));
  const wardrobe = items.filter((i) => !excluded.has(idOf(i)));
  const avoid = new Set(rng ? shuffle?.avoid ?? [] : []);
  const isAvoided = (s: ScoredItem) => avoid.has(idOf(s.item));
  const scoreOf = (item: IClothingItem): ScoredItem => {
    const scored = scoreItem(item, weather, occasion);
    const bonus = styles.some((st) => item.styles.includes(st)) ? STYLE_PREFERENCE_BONUS : 0;
    const wrongGender = isWrongGender(item, wearer);
    return {
      ...scored,
      score: Math.min(100, Math.max(0, scored.score + bonus - (wrongGender ? WRONG_GENDER_PENALTY : 0))),
      ...(wrongGender ? { wrongGender: true } : {}),
    };
  };
  const inSeason = (item: IClothingItem) =>
    seasons.length === 0 || item.seasons.length === 0 || item.seasons.some((s) => seasons.includes(s));

  // Mon xep sai nhom (anh la quan short nhung de nhom Ao...) khong duoc dua vao vi tri sai, tru khi user ghim chinh no.
  const misfiledItems = wardrobe.filter((i) => isMisfiled(i) && (!fixedAnchor || idOf(i) !== idOf(fixedAnchor)));
  const misfiledIds = new Set(misfiledItems.map(idOf));
  const misfiled = misfiledItems.slice(0, MAX_MISFILED_NOTES).map((i) =>
    `"${i.name}" đang ở nhóm ${CATEGORY_NAMES_VI[i.category]} nhưng ảnh trông giống ${ITEM_KIND_NAMES_VI[i.detectedKind!]}, nên chưa được dùng để phối. Hãy sửa nhóm của món này trong Tủ đồ.`
  );

  // Biet nguoi mac nam / nu (ho so dang nguoi): do khac gioi tinh khong bao gio vao bo, khong chi tru diem.
  const wearerName = wearer === 'female' ? 'nữ' : 'nam';
  const blocked = (message: string): OutfitOptionsResult => ({
    options: [], missing: [], pinned: fixedAnchor, weatherFit: [], occasionFit: [], misfiled: [], genderFit: [],
    blocked: message,
  });
  if (fixedAnchor && isWrongGender(fixedAnchor, wearer)) {
    return blocked(
      `"${fixedAnchor.name}" là ${ITEM_GENDER_NAMES_VI[genderOf(fixedAnchor)]}, không hợp với người mặc ${wearerName} theo hồ sơ dáng người, nên chưa phối bộ nào. Hãy bỏ ghim để chọn món khác, hoặc sửa giới tính trong hồ sơ nếu bạn phối cho người khác.`
    );
  }
  const genderExcluded = wardrobe.filter((i) => isWrongGender(i, wearer));
  const genderExcludedIds = new Set(genderExcluded.map(idOf));
  const genderExcludedCats = new Set(genderExcluded.map((i) => i.category));

  // Mon user yeu cau: ghim 1 mon (uu tien mon chinh), cac loai do co yeu cau chi chon trong nhom.
  const wanted = wardrobe.filter((i) => include.includes(idOf(i)) && !misfiledIds.has(idOf(i)));
  const requested = wanted.filter((i) => !genderExcludedIds.has(idOf(i)));
  if (wanted.length > 0 && requested.length === 0) {
    const names = wanted.slice(0, 2).map((i) => `"${i.name}"`).join(', ');
    return blocked(
      `Món bạn muốn mặc (${names}) là ${ITEM_GENDER_NAMES_VI[genderOf(wanted[0])]}, không hợp với người mặc ${wearerName} theo hồ sơ dáng người, nên chưa phối bộ nào.`
    );
  }
  const requestedCats = new Set(requested.map((i) => i.category));
  let anchor = fixedAnchor;
  if (!anchor && requested.length > 0) {
    const mains = requested.filter((i) => isMainPiece(i.category));
    const candidates = mains.length > 0 ? mains : requested;
    const fresh = candidates.filter((i) => !avoid.has(idOf(i)));
    const pool = fresh.length > 0 ? fresh : candidates;
    anchor = rng
      ? pool[Math.floor(rng() * pool.length)]
      : pool.map(scoreOf).sort((a, b) => b.score - a.score)[0].item;
  }
  const isAllowed = (item: IClothingItem) =>
    requestedCats.has(item.category) ? include.includes(idOf(item)) : inSeason(item);

  const anchorId = anchor && idOf(anchor);
  const anchorScored = anchor && scoreOf(anchor);
  const scored = wardrobe
    .filter((i) => idOf(i) !== anchorId && !misfiledIds.has(idOf(i)) && !genderExcludedIds.has(idOf(i)) && isAllowed(i))
    .map(scoreOf);

  const pickFrom = (list: ScoredItem[], n: number) => {
    if (!rng) return list.slice(0, n);
    const mixed = shuffled(list, rng);
    // Doi bo khac: mon chua co trong bo vua hien duoc boc truoc.
    return [...mixed.filter((s) => !isAvoided(s)), ...mixed.filter(isAvoided)].slice(0, n);
  };
  const topOf = (cat: Category, n = CANDIDATES_PER_SLOT) => {
    // Chi lay mon hop dip (do khac gioi tinh nguoi mac da bi loai tu dau). Khong co mon hop thi de trong
    // va noi ro con thieu gi, khong ghep bua mon trai dip cho du bo.
    const all = scored
      .filter((s) => s.item.category === cat && !s.unsuitable && !s.wrongGender)
      .sort((a, b) => b.score - a.score);
    if (all.length === 0) return [];
    let pool = rng
      ? all.filter((s) => s.score >= all[0].score - SHUFFLE_ITEM_MARGIN).slice(0, SHUFFLE_POOL_PER_SLOT)
      : all;
    if (avoid.size > 0 && pool.every(isAvoided)) {
      // Nhom diem cao toan mon vua hien: them mon khac tot nhat (khong qua kem) de bo do thuc su doi.
      const other = all.find((s) => !isAvoided(s) && s.score >= all[0].score - 2 * SHUFFLE_ITEM_MARGIN);
      if (other) pool = [...pool, other];
    }
    if (colorGroups.length === 0 || !isMainPiece(cat)) return pickFrom(pool, n);
    // Mon dung mau co the diem thap -> giu cho rieng, neu khong se bi loai truoc khi ghep bo.
    const colored = pickFrom(all.filter((s) => itemMatchesColor(s.item, colorGroups)), n - 1);
    return [...colored, ...pickFrom(pool.filter((s) => !colored.includes(s)), n - colored.length)];
  };

  const cat = anchor?.category;
  const missing: string[] = [];
  const occasionName = occasion ? OCCASION_NAMES_VI[occasion] : undefined;
  const lack = (what: string, cats: Category[]) =>
    seasons.length > 0 ? `Không có ${what} hợp mùa đã chọn`
      : cats.some((c) => excludedCats.has(c)) ? `Ngoài món bạn đã bỏ, tủ chưa có ${what} khác để phối cùng`
        : cats.some((c) => genderExcludedCats.has(c)) ? `Tủ chưa có ${what} hợp với người mặc ${wearerName}`
        : `Tủ chưa có ${what} để phối cùng`;
  // Nguoi mac: theo ho so, khong co thi theo mon ghim (vay -> nu). Dung de goi y loai nen sam.
  const anchorGender = anchor ? genderOf(anchor) : 'unisex';
  const target: Wearer | undefined = wearer ?? (anchorGender === 'unisex' ? undefined : anchorGender);
  const kindsFor = (slot: Category, who = target): ItemKind[] =>
    who ? kindsToAdd(slot, who, occasion) : occasion ? recommendedKinds(slot, occasion) : [];
  const addLine = (slot: Category, who = target) => {
    const kinds = kindsFor(slot, who).map((k) => ITEM_KIND_NAMES_VI[k]);
    return kinds.length ? `. Nên bổ sung: ${kinds.join(', ')}` : '';
  };
  /** Nhom co mon nhung khong mon nao hop dip -> noi dung ly do + loai nen sam; khong thi nhu lack. */
  const lackFor = (what: string, slot: Category) => {
    const hasUnfit = scored.some((s) => s.item.category === slot && s.unsuitable);
    return hasUnfit && occasionName ? `Tủ chưa có ${what} hợp dịp ${occasionName}${addLine(slot)}` : lack(what, [slot]);
  };

  // Phan chinh: ao + quan, hoac vay / do bo.
  let mains: ScoredItem[][];
  if (anchorScored && (cat === 'dress' || cat === 'set')) {
    mains = [[anchorScored]];
  } else if (anchorScored && (cat === 'top' || cat === 'bottom')) {
    const partners = topOf(cat === 'top' ? 'bottom' : 'top');
    if (partners.length === 0) missing.push(cat === 'top' ? lackFor('quần', 'bottom') : lackFor('áo', 'top'));
    mains = partners.length ? partners.map((p) => [anchorScored, p]) : [[anchorScored]];
  } else {
    const tops = topOf('top'), bottoms = topOf('bottom');
    mains = [
      ...tops.flatMap((t) => bottoms.map((b) => [t, b])),
      ...topOf('dress', 3).map((d) => [d]),
      ...topOf('set', 3).map((s) => [s]),
    ];
    if (mains.length === 0) {
      const gaps = [
        ...(tops.length === 0 ? [lackFor('áo', 'top')] : []),
        ...(bottoms.length === 0 ? [lackFor('quần', 'bottom')] : []),
      ].filter((m) => m.includes('hợp dịp'));
      missing.push(...(gaps.length ? gaps : [lack('đủ áo + quần hoặc váy', ['top', 'bottom', 'dress', 'set'])]));
      mains = [...tops, ...bottoms].map((p) => [p]);
      if (mains.length === 0) mains = [[]];
    }
  }

  // Cac vi tri phu. Ao khoac chi can khi lanh/mua, tru khi chinh mon ghim la ao khoac.
  interface ExtraSlot { cat: Category; choices: ScoredItem[]; fixed?: boolean }
  const extraSlots: ExtraSlot[] = [];
  if (anchorScored && cat === 'outerwear') extraSlots.push({ cat: 'outerwear', choices: [anchorScored], fixed: true });
  else if (weather.temp < 22 || weather.isRaining) {
    const outer = topOf('outerwear');
    if (outer.length) extraSlots.push({ cat: 'outerwear', choices: outer });
  }
  for (const slot of ['shoes', 'bag', 'accessory'] as const) {
    if (anchorScored && cat === slot) {
      extraSlots.push({ cat: slot, choices: [anchorScored], fixed: true });
      continue;
    }
    const choices = topOf(slot);
    if (choices.length) extraSlots.push({ cat: slot, choices });
    else if (slot === 'shoes') missing.push(lackFor('giày', 'shoes'));
  }

  // Mon phu phai hop voi phan chinh cua tung bo: khong lan do nam nu, khong lech 3 bac trang trong
  // (vay tiec + dep suc). Khong co mon hop -> bo do de trong vi tri do, roi noi ro con thieu gi.
  const fitsWith = (base: ScoredItem[], extra: ScoredItem) => {
    const pieces = [...base, extra].map((p) => p.item);
    return !mixesGenders(pieces) && formalityGap(pieces) < 3;
  };
  let combos = mains;
  for (const slot of extraSlots) {
    combos = combos.flatMap((c) => {
      const ok = slot.fixed ? slot.choices : slot.choices.filter((x) => fitsWith(c, x));
      return ok.length > 0 ? ok.map((x) => [...c, x]) : [c];
    });
  }
  const shoesInWardrobe = extraSlots.some((s) => s.cat === 'shoes');
  const hasShoes = (picks: ScoredItem[]) => picks.some((p) => p.item.category === 'shoes');
  let ranked = combos
    .map((picks) => ({
      picks,
      // Bo thieu giay vi tu khong co doi hop: van xep duoc nhung sau bo du giay.
      score: scoreCombo(picks, anchorScored) - (shoesInWardrobe && !hasShoes(picks) ? MISSING_SHOES_PENALTY : 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (colorGroups.length > 0) {
    const matched = ranked.filter(({ picks }) =>
      picks.some((p) => isMainPiece(p.item.category) && itemMatchesColor(p.item, colorGroups))
    );
    if (matched.length > 0) ranked = matched;
    else {
      const names = colorGroups.map((g) => COLOR_NAMES_VI[g]).join(', ');
      missing.push(`Chưa có món chính màu ${names} để phối, đây là bộ gần nhất`);
    }
  }

  // Stylist khong dua ra bo lan do nam nu chi de du 3 phuong an: con bo khong lan thi chi giu bo khong lan.
  const genderClean = ranked.filter(({ picks }) =>
    !mixesGenders(picks.map((p) => p.item)) && !picks.some((p) => p !== anchorScored && p.wrongGender)
  );
  if (genderClean.length > 0) ranked = genderClean;

  if (rng) {
    const seen = new Set(shuffle?.seen ?? []);
    let pool: typeof ranked;
    if (avoid.size > 0) {
      // "Doi bo khac": truoc het it trung mon chinh voi bo vua hien nhat, sau do moi xet diem.
      const unseen = ranked.filter((r) => !seen.has(comboKey(r.picks)));
      const base = unseen.length > 0 ? unseen : ranked;
      const overlap = (picks: ScoredItem[]) =>
        picks.filter((p) => p !== anchorScored && isMainPiece(p.item.category) && isAvoided(p)).length;
      const least = Math.min(...base.map((r) => overlap(r.picks)));
      const group = base.filter((r) => overlap(r.picks) === least);
      pool = group.filter((r) => r.score >= (group[0]?.score ?? 0) - SHUFFLE_COMBO_MARGIN);
    } else {
      const best = ranked[0]?.score ?? 0;
      const near = ranked.filter((r) => r.score >= best - SHUFFLE_COMBO_MARGIN);
      const fresh = seen.size > 0 ? near.filter((r) => !seen.has(comboKey(r.picks))) : near;
      pool = fresh.length > 0 ? fresh : near;
    }
    ranked = shuffled(pool, rng);
  }

  // Chon phuong an khac nhau: uu tien khac >= 2 mon, thieu thi chap nhan khac 1 mon.
  const ids = (picks: ScoredItem[]) => new Set(picks.map((p) => String(p.item._id)));
  const symDiff = (a: Set<string>, b: Set<string>) =>
    [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length;
  const chosen: { picks: ScoredItem[]; score: number; ids: Set<string> }[] = [];
  for (const minDiff of [4, 2]) {
    for (const combo of ranked) {
      if (chosen.length >= optionCount) break;
      const comboIds = ids(combo.picks);
      if (chosen.every((c) => symDiff(c.ids, comboIds) >= minDiff)) chosen.push({ ...combo, ids: comboIds });
    }
  }
  chosen.sort((a, b) => b.score - a.score);

  const options: OutfitSuggestion[] = chosen.map(({ picks, score }) => {
    const slots: Partial<Record<Category, IClothingItem>> = {};
    for (const p of picks) slots[p.item.category] = p.item;
    const base = anchorScored ?? picks[0];
    const mismatch = picks.some((p) => p !== anchorScored && p.unsuitable && isOccasionPiece(p.item.category));
    return {
      ...slots,
      key: comboKey(picks),
      totalScore: score,
      reasons: base ? comboReasons(base, picks, weather) : weatherReasons(weather),
      ...(mismatch ? { occasionMismatch: true } : {}),
      ...(mixesGenders(picks.map((p) => p.item)) || picks.some((p) => p !== anchorScored && p.wrongGender)
        ? { genderMismatch: true } : {}),
      styling: styleOutfit(slots, weather, occasion),
    };
  });

  // Bo dau khong co giay vi tu khong co doi nao hop phan chinh (vd vay tiec ma chi co dep suc / giay nam).
  const firstOption = options[0];
  if (firstOption && shoesInWardrobe && !firstOption.shoes) {
    const main = anchor ?? firstOption.dress ?? firstOption.set ?? firstOption.top ?? firstOption.bottom;
    // Chua biet nguoi mac thi suy tu mon chinh (vay -> nu) de goi y dung loai giay.
    const mainGender = main ? genderOf(main) : 'unisex';
    const who = target ?? (mainGender === 'unisex' ? undefined : mainGender);
    if (main) missing.push(`Tủ chưa có giày hợp với "${main.name}"${addLine('shoes', who)}`);
  }

  let weatherWarning: string | undefined;
  if (anchor) {
    const { min, max } = tempRangeOf(anchor);
    if (weather.temp > max + 3) {
      weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay ${weather.temp}°C, nên để dành khi trời mát hơn.`;
    } else if (weather.temp < min - 3) {
      weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay chỉ ${weather.temp}°C, nhớ mặc thêm lớp giữ ấm.`;
    }
  }

  const { weatherFit, occasionFit, genderFit } = explainFit(options[0], { weather, occasion, wearer, anchor });

  return {
    options, weatherWarning, seasonWarning: seasonMismatch(seasons, weather), missing, pinned: anchor, weatherFit,
    occasionFit, misfiled, genderFit,
  };
}

export interface FitContext {
  weather: WeatherInfo;
  occasion?: Occasion;
  wearer?: Wearer;
  /** Mon dang ghim: khong bi bao loi (user tu chon), chi nhac neu chinh no trai dip / gioi tinh. */
  anchor?: IClothingItem;
}

/**
 * Loi nhac khi bo do co mon chua hop thoi tiet / dip / gioi tinh vi tu chua co lua chon hon,
 * kem loai nen sam them. Goi lai duoc sau khi AI xem anh xep lai thu tu cac bo.
 */
export function explainFit(
  option: OutfitSuggestion | undefined,
  { weather, occasion, wearer, anchor }: FitContext
): { weatherFit: string[]; occasionFit: string[]; genderFit: string[] } {
  const isAnchor = (piece: IClothingItem) => Boolean(anchor) && String(piece._id) === String(anchor!._id);
  // Noi that khi bo tot nhat van khong hop nhiet do, de loi tu van khong khen sai.
  const weatherFit: string[] = [];
  for (const piece of option ? [option.top, option.bottom, option.dress, option.set, option.outerwear] : []) {
    if (!piece || isAnchor(piece)) continue;
    const { min, max } = tempRangeOf(piece);
    if (weather.temp < min - WEATHER_FIT_TOLERANCE) {
      weatherFit.push(`Tủ chưa có ${CATEGORY_NAMES_VI[piece.category]} ấm hơn cho ${weather.temp}°C, "${piece.name}" có thể hơi mỏng`);
    } else if (weather.temp > max + WEATHER_FIT_TOLERANCE) {
      weatherFit.push(`Tủ chưa có ${CATEGORY_NAMES_VI[piece.category]} mát hơn cho ${weather.temp}°C, "${piece.name}" có thể hơi nóng`);
    }
  }

  // Noi that khi tu khong co mon hop dip: chi ro mon chua hop va loai nen sam them, khong khen sai.
  const occasionFit: string[] = [];
  if (occasion) {
    const occasionName = OCCASION_NAMES_VI[occasion];
    if (anchor && occasionFitOf(anchor, occasion) <= UNSUITABLE_FIT) {
      occasionFit.push(`"${anchor.name}" thường không hợp dịp ${occasionName}, bộ đồ đã cố phối cho cân đối`);
    }
    for (const piece of option ? [option.top, option.bottom, option.dress, option.set, option.outerwear, option.shoes] : []) {
      if (!piece || isAnchor(piece) || occasionFitOf(piece, occasion) > UNSUITABLE_FIT) continue;
      const kinds = recommendedKinds(piece.category, occasion).map((k) => ITEM_KIND_NAMES_VI[k]);
      occasionFit.push(
        `Tủ chưa có ${CATEGORY_NAMES_VI[piece.category]} hợp dịp ${occasionName}, "${piece.name}" chưa thật sự phù hợp`
        + (kinds.length ? `. Nên bổ sung: ${kinds.join(', ')}` : '')
      );
    }
  }

  // Bo dau van tron do nam nu / trai gioi tinh nguoi mac (tu khong co lua chon hon): noi ro thieu mon gi.
  const genderFit: string[] = [];
  const firstPieces = option
    ? [option.dress, option.set, option.top, option.bottom, option.outerwear, option.shoes]
      .filter((p): p is IClothingItem => Boolean(p))
    : [];
  const gendered = firstPieces.flatMap((piece) => {
    const gender = genderOf(piece);
    return gender === 'unisex' ? [] : [{ piece, gender }];
  });
  // Nguoi mac: theo ho so; khong co thi theo mon ghim, roi theo mon chinh dau tien co gioi tinh (vay -> nu).
  const anchorGender = anchor ? genderOf(anchor) : 'unisex';
  const target: Wearer | undefined = wearer
    ?? (anchorGender !== 'unisex' ? anchorGender : gendered.at(0)?.gender as Wearer | undefined);
  if (target) {
    const targetName = target === 'female' ? 'nữ' : 'nam';
    if (anchor && isWrongGender(anchor, wearer)) {
      genderFit.push(`"${anchor.name}" là ${ITEM_GENDER_NAMES_VI[anchorGender]}, chưa hợp với người mặc ${targetName}`);
    }
    for (const { piece, gender } of gendered) {
      if (isAnchor(piece) || gender === target) continue;
      const kinds = kindsToAdd(piece.category, target, occasion).map((k) => ITEM_KIND_NAMES_VI[k]);
      genderFit.push(
        `Tủ chưa có ${CATEGORY_NAMES_VI[piece.category]} ${targetName} phù hợp để phối cùng, "${piece.name}" là ${ITEM_GENDER_NAMES_VI[gender]}`
        + (kinds.length ? `. Nên bổ sung: ${kinds.join(', ')}` : '')
      );
    }
  }


  return { weatherFit, occasionFit, genderFit };
}

/* ---------- Cach mac: bien "ghep mon" thanh bo do duoc phoi ---------- */

type OutfitSlots = Partial<Record<Category, IClothingItem>>;
const kindIn = (item: IClothingItem | undefined, kinds: readonly ItemKind[]) => {
  const kind = item && effectiveKind(item);
  return Boolean(kind && kinds.includes(kind));
};
const MAX_TIPS = 3;

/** Ten phong cach theo dip + do trang trong trung binh cua bo. */
function styleTitle(slots: OutfitSlots, occasion?: Occasion): string {
  const levels = formalityPieces(Object.values(slots).filter((i): i is IClothingItem => Boolean(i)))
    .map(formalityOf).filter((v): v is number => v !== undefined);
  const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1;
  const dressy = avg >= 2;
  switch (occasion) {
    case 'party': return dressy ? 'Thanh lịch dự tiệc' : 'Dự tiệc phá cách';
    case 'work': return dressy ? 'Công sở lịch sự' : 'Smart casual đi làm';
    case 'date': return dressy ? 'Hẹn hò thanh lịch' : 'Hẹn hò nhẹ nhàng';
    case 'school': return 'Đi học gọn gàng';
    case 'sport': return 'Năng động thể thao';
    case 'travel': return 'Du lịch thoải mái';
    default: {
      if (dressy) return 'Smart casual';
      const styles = Object.values(slots).flatMap((i) => i?.styles ?? []);
      return styles.includes('streetwear') ? 'Đường phố năng động' : 'Thường ngày tối giản';
    }
  }
}

/** Meo cach mac theo quy tac stylist (so vin, xan tay, khoac ho, xan gau...). Toi da 3 meo. */
function styleTips(slots: OutfitSlots, weather: WeatherInfo): string[] {
  const { top, bottom, outerwear, dress, shoes, bag, accessory } = slots;
  const tips: string[] = [];
  const bottomName = kindIn(bottom, ['skirt']) ? 'chân váy' : 'quần';
  if (top && bottom) {
    if (kindIn(top, ['shirt', 'blouse'])) tips.push(`Sơ vin áo vào ${bottomName} để gọn dáng và tôn eo`);
    else if (kindIn(top, ['tshirt', 'polo', 'sweater'])) tips.push('Sơ vin hờ vạt trước (half-tuck) cho dáng tự nhiên, không bị nuốt chân');
  }
  if (kindIn(top, ['shirt']) && weather.temp >= 28) tips.push('Xắn tay áo sơ mi 2 gấp cho mát và trẻ trung');
  if (outerwear) {
    if (weather.temp >= 24) tips.push('Khoác hờ áo khoác, không cài khuy; vào phòng máy lạnh thì mặc vào');
    else if (weather.temp < 18) tips.push('Cài khuy áo khoác và dựng cổ áo cho ấm');
    else tips.push('Mở khuy áo khoác để lộ áo bên trong, tạo lớp lang cho bộ đồ');
  }
  if (dress && !outerwear && weather.temp < 22) tips.push('Trời se lạnh, khoác thêm blazer hoặc cardigan mỏng bên ngoài váy');
  if (kindIn(bottom, ['jeans', 'trousers', 'pants']) && kindIn(shoes, ['loafers', 'heels', 'flats', 'sandals'])) {
    tips.push('Xắn gấu quần một gấp nhỏ để lộ cổ chân, giày nổi bật hơn');
  }
  if (tips.length < MAX_TIPS && (bag || accessory)) tips.push('Chọn túi và phụ kiện cùng tông với giày cho tổng thể liền mạch');
  if (tips.length === 0) tips.push('Giữ phụ kiện tối giản để các món chính nổi bật');
  return tips.slice(0, MAX_TIPS);
}

/** Ten phong cach + cach mac theo quy tac. Stylist AI xem anh se viet de len (lookStylist.service). */
export function styleOutfit(slots: OutfitSlots, weather: WeatherInfo, occasion?: Occasion): OutfitStyling {
  return { title: styleTitle(slots, occasion), tips: styleTips(slots, weather), source: 'rule' };
}
