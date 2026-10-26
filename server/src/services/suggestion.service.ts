import { IClothingItem } from '../models/ClothingItem.js';
import { Category, Occasion, Season } from '../types/index.js';
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
    reasons.push(`Phu hop nhiet do ${weather.temp}\u00b0C`);
  } else {
    // Cang lech xa khoang phu hop, tru cang nhieu (toi da -40).
    const gap = weather.temp < min ? min - weather.temp : weather.temp - max;
    score -= Math.min(gap * 3, 40);
    reasons.push(
      weather.temp < min ? 'Co the hoi mong so voi troi lanh' : 'Co the hoi nong'
    );
  }

  // 2. Mua hien tai.
  const season = seasonOfMonth(new Date().getMonth() + 1);
  if (item.seasons.includes(season)) {
    score += 10;
    reasons.push(`Hop mua ${season}`);
  }

  // 3. Ngu canh nguoi dung chon.
  if (occasion && item.occasions.includes(occasion)) {
    score += 15;
    reasons.push(`Hop dip ${occasion}`);
  }

  // 4. Troi mua - uu tien do toi mau, tru giay vai sang mau.
  if (weather.isRaining && item.category === 'shoes') {
    const light = item.colors.some((c) => isLightColor(c));
    if (light) {
      score -= 15;
      reasons.push('Troi mua, giay sang mau de ban');
    }
  }

  // 5. Uu tien nhe do it mac de tu do da dang hon.
  if (item.wearCount === 0) {
    score += 5;
    reasons.push('Chua mac lan nao');
  }

  return { item, score: Math.max(0, Math.round(score)), reasons };
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

  const reasons: string[] = [];
  if (weather.isRaining) reasons.push('Troi dang mua, nen mang theo ao mua/o');
  if (weather.temp < 18) reasons.push('Troi lanh, nen mac them ao khoac');
  if (weather.temp > 32) reasons.push('Troi nong, uu tien chat lieu thoang mat');

  return {
    top: useSet || useDress ? undefined : top?.item,
    bottom: useSet || useDress ? undefined : bottom?.item,
    dress: useDress ? dress?.item : undefined,
    set: useSet ? setItem?.item : undefined,
    outerwear: outerwear?.item,
    shoes: shoes?.item,
    accessory: accessory?.item,
    totalScore: picked.length
      ? Math.round(picked.reduce((s, p) => s + p.score, 0) / picked.length)
      : 0,
    reasons,
  };
}
