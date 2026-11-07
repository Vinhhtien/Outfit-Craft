import { createHash } from 'node:crypto';
import { IClothingItem } from '../models/ClothingItem.js';
import { Category, ColorGroup, Occasion, Season, Style } from '../types/index.js';
import { WeatherInfo } from './weather.service.js';

export interface ScoredItem {
  item: IClothingItem;
  score: number;
  reasons: string[];
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
}

/** Mua hien tai theo thang (bac ban cau / khi hau VN). */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

const SEASON_NAMES_VI: Record<Season, string> = {
  spring: 'mùa xuân',
  summer: 'mùa hè',
  autumn: 'mùa thu',
  winter: 'mùa đông',
};

const OCCASION_NAMES_VI: Record<Occasion, string> = {
  daily: 'hằng ngày',
  work: 'đi làm',
  school: 'đi học',
  date: 'hẹn hò',
  party: 'tiệc tùng',
  sport: 'thể thao',
  travel: 'du lịch',
};

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
  const { min, max } = item.tempRange;
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

  // 2. Mua hien tai.
  const season = seasonOfMonth(new Date().getMonth() + 1);
  if (item.seasons.includes(season)) {
    score += 10;
    reasons.push(`Hợp ${SEASON_NAMES_VI[season] || season}`);
  }

  // 3. Ngu canh nguoi dung chon.
  if (occasion && item.occasions.includes(occasion)) {
    score += 15;
    reasons.push(`Phù hợp dịp ${OCCASION_NAMES_VI[occasion] || occasion}`);
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

  return { item, score: Math.min(100, Math.max(0, Math.round(score))), reasons };
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

export type ColorRelation = 'neutral' | 'analogous' | 'complementary' | 'clash' | 'other' | 'unknown';

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
  neutral: 90, analogous: 85, complementary: 75, other: 55, clash: 30, unknown: 60,
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

/** Nhu colorRelation nhung xet theo mon (de ap dung luat quan jeans). */
export function itemColorRelation(a: IClothingItem, b: IClothingItem): ColorRelation {
  const rel = colorRelation(a.colors[0], b.colors[0]);
  if (rel === 'unknown' || rel === 'neutral') return rel;
  return isNeutralItem(a) || isNeutralItem(b) ? 'neutral' : rel;
}

const isSmallPiece = (item: IClothingItem) => item.category === 'bag' || item.category === 'accessory';

const MAIN_PIECES: readonly Category[] = ['top', 'bottom', 'dress', 'set', 'outerwear'];
const isMainPiece = (category: Category) => MAIN_PIECES.includes(category);

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

  return Math.min(100, Math.max(0, Math.round(0.5 * avgItem + 0.3 * color + 0.2 * style)));
}

const CANDIDATES_PER_SLOT = 4;
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
  rng?: () => number;
}

export interface BuildOutfitOptions {
  /** Mon co dinh, luon nam trong bo do ke ca khi khong khop bo loc. */
  anchor?: IClothingItem;
  filters?: SuggestionFilters;
  shuffle?: ShuffleOptions;
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
}

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
    } else if (rel === 'complementary') {
      reasons.push(`${name} có màu tương phản với ${baseName}, tạo điểm nhấn`);
    } else if (rel === 'clash') {
      reasons.push(`${name} và ${baseName} hơi chọi màu, có thể đổi sang phương án khác`);
    }
  }

  const shared = base.item.styles.find((st) =>
    others.filter((o) => o.item.styles.includes(st)).length >= Math.max(1, Math.ceil(others.length / 2))
  );
  if (shared) reasons.push(`Cùng phong cách ${STYLE_NAMES_VI[shared]}`);

  const { min, max } = base.item.tempRange;
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
  { anchor, filters = {}, shuffle }: BuildOutfitOptions = {}
): OutfitOptionsResult {
  const { seasons = [], colorGroups = [], styles = [] } = filters;
  const rng = shuffle ? shuffle.rng ?? Math.random : undefined;
  const scoreOf = (item: IClothingItem): ScoredItem => {
    const scored = scoreItem(item, weather, occasion);
    return styles.some((st) => item.styles.includes(st))
      ? { ...scored, score: Math.min(100, scored.score + STYLE_PREFERENCE_BONUS) }
      : scored;
  };
  const inSeason = (item: IClothingItem) =>
    seasons.length === 0 || item.seasons.length === 0 || item.seasons.some((s) => seasons.includes(s));

  const anchorId = anchor && String(anchor._id);
  const anchorScored = anchor && scoreOf(anchor);
  const scored = items.filter((i) => String(i._id) !== anchorId && inSeason(i)).map(scoreOf);

  const pickFrom = (list: ScoredItem[], n: number) => (rng ? shuffled(list, rng) : list).slice(0, n);
  const topOf = (cat: Category, n = CANDIDATES_PER_SLOT) => {
    const all = scored.filter((s) => s.item.category === cat).sort((a, b) => b.score - a.score);
    const pool = rng
      ? all.filter((s) => s.score >= all[0].score - SHUFFLE_ITEM_MARGIN).slice(0, SHUFFLE_POOL_PER_SLOT)
      : all;
    if (colorGroups.length === 0 || !isMainPiece(cat)) return pickFrom(pool, n);
    // Mon dung mau co the diem thap -> giu cho rieng, neu khong se bi loai truoc khi ghep bo.
    const colored = pickFrom(all.filter((s) => itemMatchesColor(s.item, colorGroups)), n - 1);
    return [...colored, ...pickFrom(pool.filter((s) => !colored.includes(s)), n - colored.length)];
  };

  const cat = anchor?.category;
  const missing: string[] = [];
  const lack = (what: string) =>
    seasons.length > 0 ? `Không có ${what} hợp mùa đã chọn` : `Tủ chưa có ${what} để phối cùng`;

  // Phan chinh: ao + quan, hoac vay / do bo.
  let mains: ScoredItem[][];
  if (anchorScored && (cat === 'dress' || cat === 'set')) {
    mains = [[anchorScored]];
  } else if (anchorScored && (cat === 'top' || cat === 'bottom')) {
    const partners = topOf(cat === 'top' ? 'bottom' : 'top');
    if (partners.length === 0) missing.push(lack(cat === 'top' ? 'quần' : 'áo'));
    mains = partners.length ? partners.map((p) => [anchorScored, p]) : [[anchorScored]];
  } else {
    const tops = topOf('top'), bottoms = topOf('bottom');
    mains = [
      ...tops.flatMap((t) => bottoms.map((b) => [t, b])),
      ...topOf('dress', 3).map((d) => [d]),
      ...topOf('set', 3).map((s) => [s]),
    ];
    if (mains.length === 0) {
      missing.push(lack('đủ áo + quần hoặc váy'));
      mains = [...tops, ...bottoms].map((p) => [p]);
      if (mains.length === 0) mains = [[]];
    }
  }

  // Cac vi tri phu. Ao khoac chi can khi lanh/mua, tru khi chinh mon ghim la ao khoac.
  const extraSlots: ScoredItem[][] = [];
  if (anchorScored && cat === 'outerwear') extraSlots.push([anchorScored]);
  else if (weather.temp < 20 || weather.isRaining) {
    const outer = topOf('outerwear');
    if (outer.length) extraSlots.push(outer);
  }
  for (const slot of ['shoes', 'bag', 'accessory'] as const) {
    if (anchorScored && cat === slot) {
      extraSlots.push([anchorScored]);
      continue;
    }
    const choices = topOf(slot);
    if (choices.length) extraSlots.push(choices);
    else if (slot === 'shoes') missing.push(lack('giày'));
  }

  let combos = mains;
  for (const choices of extraSlots) combos = combos.flatMap((c) => choices.map((x) => [...c, x]));
  let ranked = combos
    .map((picks) => ({ picks, score: scoreCombo(picks, anchorScored) }))
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

  if (rng) {
    const best = ranked[0]?.score ?? 0;
    const near = ranked.filter((r) => r.score >= best - SHUFFLE_COMBO_MARGIN);
    const seen = new Set(shuffle?.seen ?? []);
    const fresh = seen.size > 0 ? near.filter((r) => !seen.has(comboKey(r.picks))) : near;
    ranked = shuffled(fresh.length > 0 ? fresh : near, rng);
  }

  // Chon phuong an khac nhau: uu tien khac >= 2 mon, thieu thi chap nhan khac 1 mon.
  const ids = (picks: ScoredItem[]) => new Set(picks.map((p) => String(p.item._id)));
  const symDiff = (a: Set<string>, b: Set<string>) =>
    [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length;
  const chosen: { picks: ScoredItem[]; score: number; ids: Set<string> }[] = [];
  for (const minDiff of [4, 2]) {
    for (const combo of ranked) {
      if (chosen.length >= OPTION_COUNT) break;
      const comboIds = ids(combo.picks);
      if (chosen.every((c) => symDiff(c.ids, comboIds) >= minDiff)) chosen.push({ ...combo, ids: comboIds });
    }
  }
  chosen.sort((a, b) => b.score - a.score);

  const options: OutfitSuggestion[] = chosen.map(({ picks, score }) => {
    const slots: Partial<Record<Category, IClothingItem>> = {};
    for (const p of picks) slots[p.item.category] = p.item;
    const base = anchorScored ?? picks[0];
    return {
      ...slots,
      key: comboKey(picks),
      totalScore: score,
      reasons: base ? comboReasons(base, picks, weather) : weatherReasons(weather),
    };
  });

  let weatherWarning: string | undefined;
  if (anchor) {
    const { min, max } = anchor.tempRange;
    if (weather.temp > max + 3) {
      weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay ${weather.temp}°C, nên để dành khi trời mát hơn.`;
    } else if (weather.temp < min - 3) {
      weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay chỉ ${weather.temp}°C, nhớ mặc thêm lớp giữ ấm.`;
    }
  }

  return { options, weatherWarning, seasonWarning: seasonMismatch(seasons, weather), missing };
}
