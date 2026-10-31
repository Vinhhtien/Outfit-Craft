import { IClothingItem } from '../models/ClothingItem.js';
import { Category, Occasion, Season, Style } from '../types/index.js';
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

/**
 * Ghep 1 bo do hoan chinh: chon item diem cao nhat cho tung vi tri.
 * Neu vay lien than thang diem ca top+bottom thi dung vay.
 */
export function buildSuggestion(
  items: IClothingItem[],
  weather: WeatherInfo,
  occasion?: Occasion
): OutfitSuggestion {
  const scored = items.map((i) => scoreItem(i, weather, occasion));
  const bestOf = (cat: Category): ScoredItem | undefined =>
    scored
      .filter((s) => s.item.category === cat)
      .sort((a, b) => b.score - a.score)[0];

  const top = bestOf('top');
  const bottom = bestOf('bottom');
  const dress = bestOf('dress');
  const setItem = bestOf('set');
  const shoes = bestOf('shoes');
  const accessory = bestOf('accessory');

  // Troi lanh (<20C) moi can ao khoac.
  const outerwear = weather.temp < 20 ? bestOf('outerwear') : undefined;

  const comboScore = (top?.score ?? 0) + (bottom?.score ?? 0);
  const dressScore = dress ? dress.score * 2 : 0;
  const setScore = setItem ? setItem.score * 2 : 0;

  const useSet = Boolean(setItem && setScore > comboScore && setScore >= dressScore);
  const useDress = Boolean(!useSet && dress && dressScore > comboScore);

  const picked = [
    useSet ? setItem : (useDress ? dress : top),
    useSet || useDress ? undefined : bottom,
    outerwear,
    shoes,
    accessory,
  ].filter(Boolean) as ScoredItem[];

  const reasons = weatherReasons(weather);

  return {
    top: useSet || useDress ? undefined : top?.item,
    bottom: useSet || useDress ? undefined : bottom?.item,
    dress: useDress ? dress?.item : undefined,
    set: useSet ? setItem?.item : undefined,
    outerwear: outerwear?.item,
    shoes: shoes?.item,
    accessory: accessory?.item,
    totalScore: picked.length
      ? Math.min(100, Math.max(0, Math.round(picked.reduce((s, p) => s + p.score, 0) / picked.length)))
      : 0,
    reasons,
  };
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

const CATEGORY_NAMES_VI: Record<Category, string> = {
  top: 'áo',
  bottom: 'quần',
  outerwear: 'áo khoác',
  dress: 'váy',
  set: 'đồ bộ',
  shoes: 'giày',
  bag: 'túi',
  accessory: 'phụ kiện',
};

const STYLE_NAMES_VI: Record<Style, string> = {
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

/** So nhom mau ruc khac nhau (cach nhau > 30 do) trong 1 bo. */
function countVividHues(items: IClothingItem[]): number {
  const hues: number[] = [];
  for (const item of items) {
    const c = toHsl(item.colors[0]);
    if (!c || isNeutralColor(item.colors[0])) continue;
    const near = hues.some((h) => Math.min(Math.abs(h - c.h), 360 - Math.abs(h - c.h)) <= 30);
    if (!near) hues.push(c.h);
  }
  return hues.length;
}

/**
 * Diem ca bo = 0.5 x diem thoi tiet/dip + 0.3 x hop mau + 0.2 x dong bo phong cach.
 * Hop mau va phong cach lay trung binh tren moi cap mon trong bo.
 */
export function scoreCombo(picks: ScoredItem[]): number {
  if (picks.length === 0) return 0;
  const avgItem = picks.reduce((s, p) => s + p.score, 0) / picks.length;
  if (picks.length === 1) return Math.round(avgItem);

  let color = 0, style = 0, pairs = 0;
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      color += colorHarmony(picks[i].item.colors[0], picks[j].item.colors[0]);
      style += styleCompat(picks[i].item.styles, picks[j].item.styles);
      pairs++;
    }
  }
  color /= pairs;
  style /= pairs;
  // Tu 3 mau ruc tro len trong 1 bo de bi roi mat.
  if (countVividHues(picks.map((p) => p.item)) >= 3) color -= 15;

  return Math.min(100, Math.max(0, Math.round(0.5 * avgItem + 0.3 * color + 0.2 * style)));
}

const CANDIDATES_PER_SLOT = 4;
const OPTION_COUNT = 3;

export interface AnchoredSuggestionResult {
  /** Toi da 3 phuong an, diem cao nhat truoc. */
  options: OutfitSuggestion[];
  /** Mon dang ghim lech nhiet do hom nay. */
  weatherWarning?: string;
  /** Vi tri tu do chua co mon de ghep. */
  missing: string[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ly do cho 1 phuong an: mau tung mon so voi mon ghim, phong cach chung, thoi tiet. */
function anchorReasons(anchor: ScoredItem, picks: ScoredItem[], weather: WeatherInfo): string[] {
  const anchorName = CATEGORY_NAMES_VI[anchor.item.category];
  const others = picks.filter((p) => p !== anchor);
  const reasons: string[] = [];

  for (const p of others) {
    if (p.item.category === 'bag' || p.item.category === 'accessory') continue;
    const name = capitalize(CATEGORY_NAMES_VI[p.item.category]);
    const rel = colorRelation(p.item.colors[0], anchor.item.colors[0]);
    if (rel === 'neutral') {
      reasons.push(isNeutralColor(p.item.colors[0])
        ? `${name} màu trung tính, dễ đi với ${anchorName} của bạn`
        : `${name} nổi bật trên nền ${anchorName} màu trung tính`);
    } else if (rel === 'analogous') {
      reasons.push(`${name} cùng tông màu với ${anchorName}, tạo cảm giác hài hoà`);
    } else if (rel === 'complementary') {
      reasons.push(`${name} có màu tương phản với ${anchorName}, tạo điểm nhấn`);
    } else if (rel === 'clash') {
      reasons.push(`${name} và ${anchorName} hơi chọi màu, có thể đổi sang phương án khác`);
    }
  }

  const shared = anchor.item.styles.find((st) =>
    others.filter((o) => o.item.styles.includes(st)).length >= Math.max(1, Math.ceil(others.length / 2))
  );
  if (shared) reasons.push(`Cùng phong cách ${STYLE_NAMES_VI[shared]}`);

  const { min, max } = anchor.item.tempRange;
  if (weather.temp >= min && weather.temp <= max) reasons.push(`Phù hợp nhiệt độ ${weather.temp}°C`);

  return [...reasons, ...weatherReasons(weather)];
}

/**
 * Ghep bo do quanh 1 mon co dinh (anchor): moi vi tri con lai lay vai ung vien diem cao,
 * thu moi to hop, cham diem ca bo (scoreCombo) roi tra ve cac phuong an khac nhau.
 */
export function buildAnchoredSuggestions(
  anchor: IClothingItem,
  items: IClothingItem[],
  weather: WeatherInfo,
  occasion?: Occasion
): AnchoredSuggestionResult {
  const anchorId = String(anchor._id);
  const anchorScored = scoreItem(anchor, weather, occasion);
  const scored = items
    .filter((i) => String(i._id) !== anchorId)
    .map((i) => scoreItem(i, weather, occasion));
  const topOf = (cat: Category, n = CANDIDATES_PER_SLOT) =>
    scored.filter((s) => s.item.category === cat).sort((a, b) => b.score - a.score).slice(0, n);

  const cat = anchor.category;
  const missing: string[] = [];

  // Phan chinh: ao + quan, hoac vay / do bo.
  let mains: ScoredItem[][];
  if (cat === 'dress' || cat === 'set') {
    mains = [[anchorScored]];
  } else if (cat === 'top' || cat === 'bottom') {
    const partners = topOf(cat === 'top' ? 'bottom' : 'top');
    if (partners.length === 0) missing.push(`Tủ chưa có ${cat === 'top' ? 'quần' : 'áo'} để phối cùng`);
    mains = partners.length ? partners.map((p) => [anchorScored, p]) : [[anchorScored]];
  } else {
    const tops = topOf('top'), bottoms = topOf('bottom');
    mains = [
      ...tops.flatMap((t) => bottoms.map((b) => [t, b])),
      ...topOf('dress', 3).map((d) => [d]),
      ...topOf('set', 3).map((s) => [s]),
    ];
    if (mains.length === 0) {
      missing.push('Tủ chưa có đủ áo + quần hoặc váy để phối cùng');
      mains = [...tops, ...bottoms].map((p) => [p]);
      if (mains.length === 0) mains = [[]];
    }
  }

  // Cac vi tri phu. Ao khoac chi can khi lanh/mua, tru khi chinh mon ghim la ao khoac.
  const extraSlots: ScoredItem[][] = [];
  if (cat === 'outerwear') extraSlots.push([anchorScored]);
  else if (weather.temp < 20 || weather.isRaining) {
    const outer = topOf('outerwear');
    if (outer.length) extraSlots.push(outer);
  }
  for (const slot of ['shoes', 'bag', 'accessory'] as const) {
    if (cat === slot) {
      extraSlots.push([anchorScored]);
      continue;
    }
    const choices = topOf(slot);
    if (choices.length) extraSlots.push(choices);
    else if (slot === 'shoes') missing.push('Tủ chưa có giày để phối cùng');
  }

  let combos = mains;
  for (const choices of extraSlots) combos = combos.flatMap((c) => choices.map((x) => [...c, x]));
  const ranked = combos
    .map((picks) => ({ picks, score: scoreCombo(picks) }))
    .sort((a, b) => b.score - a.score);

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
    return { ...slots, totalScore: score, reasons: anchorReasons(anchorScored, picks, weather) };
  });

  const { min, max } = anchor.tempRange;
  let weatherWarning: string | undefined;
  if (weather.temp > max + 3) {
    weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay ${weather.temp}°C, nên để dành khi trời mát hơn.`;
  } else if (weather.temp < min - 3) {
    weatherWarning = `Món này hợp ${min}–${max}°C, hôm nay chỉ ${weather.temp}°C, nhớ mặc thêm lớp giữ ấm.`;
  }

  return { options, weatherWarning, missing };
}
