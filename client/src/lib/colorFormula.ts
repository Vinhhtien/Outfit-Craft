/**
 * "Cong thuc phoi do da nang": moi hang la 1 mau chinh va 8 mau phoi duoc voi no.
 * Cap mau co hieu luc ca hai chieu. Server cham diem goi y bang cung bang nay
 * (COLOR_FORMULA trong server/src/services/suggestion.service.ts) - sua o day thi sua ca ben do.
 */
import { COLOR_GROUP_LABELS } from '@/types';
import type { ClothingItem, ColorGroup } from '@/types';

export type ChromaticGroup = Exclude<ColorGroup, 'neutral'>;

export interface Swatch {
  label: string;
  hex: string;
  /** Nhom mau dung de so khop voi tu do (den, trang, xam, navy -> trung tinh). */
  group: ColorGroup;
}

const S = {
  black: { label: 'Đen', hex: '#1c1c1c', group: 'neutral' },
  white: { label: 'Trắng', hex: '#ffffff', group: 'neutral' },
  gray: { label: 'Xám', hex: '#a3a3a3', group: 'neutral' },
  navy: { label: 'Xanh navy', hex: '#1f2a6b', group: 'neutral' },
  red: { label: 'Đỏ', hex: '#d32f2f', group: 'red' },
  orange: { label: 'Cam', hex: '#f5821f', group: 'orange' },
  yellow: { label: 'Vàng', hex: '#fbd743', group: 'yellow' },
  green: { label: 'Xanh lá', hex: '#2e9e57', group: 'green' },
  olive: { label: 'Xanh rêu', hex: '#8a9a1b', group: 'green' },
  lime: { label: 'Xanh nõn chuối', hex: '#b8d433', group: 'green' },
  blue: { label: 'Xanh dương', hex: '#2f78c4', group: 'blue' },
  lightBlue: { label: 'Xanh da trời', hex: '#6aa8e6', group: 'blue' },
  purple: { label: 'Tím', hex: '#a98fd0', group: 'purple' },
  pink: { label: 'Hồng', hex: '#f8b4cf', group: 'pink' },
  brown: { label: 'Nâu', hex: '#7b4f2c', group: 'brown' },
} satisfies Record<string, Swatch>;

export interface FormulaRow {
  group: ChromaticGroup;
  /** Ten hang = ten nhom mau (o bo loc trang Goi y cung dung ten nay). */
  name: string;
  base: Swatch;
  partners: Swatch[];
}

const row = (group: ChromaticGroup, base: Swatch, partners: Swatch[]): FormulaRow =>
  ({ group, name: COLOR_GROUP_LABELS[group], base, partners });

/** Dung thu tu hang va cot cua bang goc. */
export const COLOR_FORMULA: FormulaRow[] = [
  row('red', S.red, [S.black, S.yellow, S.pink, S.navy, S.white, S.green, S.blue, S.brown]),
  row('orange', S.orange, [S.green, S.blue, S.black, S.white, S.olive, S.lightBlue, S.yellow, S.brown]),
  row('yellow', S.yellow, [S.black, S.olive, S.blue, S.white, S.pink, S.red, S.green, S.orange]),
  row('green', S.green, [S.blue, S.orange, S.purple, S.brown, S.black, S.pink, S.yellow, S.lime]),
  row('blue', S.lightBlue, [S.black, S.pink, S.green, S.purple, S.yellow, S.white, S.gray, S.red]),
  row('purple', S.purple, [S.pink, S.gray, S.black, S.blue, S.brown, S.green, S.white, S.yellow]),
  row('pink', S.pink, [S.brown, S.blue, S.lime, S.purple, S.yellow, S.white, S.black, S.gray]),
  row('brown', S.brown, [S.yellow, S.green, S.blue, S.pink, S.purple, S.gray, S.black, S.red]),
];

export const formulaRowOf = (group: ColorGroup | null) => COLOR_FORMULA.find((row) => row.group === group) ?? null;

/** 2 nhom mau ruc (khac nhau) co nam trong bang khong, xet ca hai chieu. */
export function isFormulaPair(a: ColorGroup | null, b: ColorGroup | null): boolean {
  if (!a || !b || a === b || a === 'neutral' || b === 'neutral') return false;
  const listed = (x: ColorGroup, y: ColorGroup) => Boolean(formulaRowOf(x)?.partners.some((p) => p.group === y));
  return listed(a, b) || listed(b, a);
}

/* ===== Xep ma mau vao nhom: giong colorGroupOf / isNeutralColor o server ===== */

function toHsl(hex?: string) {
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

function isNeutralColor(hex?: string): boolean {
  const c = toHsl(hex);
  if (!c) return false;
  if (c.s < 0.15 || c.l > 0.9 || c.l < 0.12) return true;
  if (c.h >= 20 && c.h <= 50 && c.s < 0.6 && c.l > 0.6) return true; // be, kem, kaki nhat
  if (c.h >= 200 && c.h <= 250 && c.l < 0.3) return true; // xanh navy
  return false;
}

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

/** Quan jeans xanh cung tinh la trung tinh (phoi duoc voi hau het moi mau), nhu o server. */
function isDenimBottom(item: Pick<ClothingItem, 'category' | 'colors'>): boolean {
  const c = toHsl(item.colors[0]);
  return item.category === 'bottom' && Boolean(c && c.h >= 200 && c.h <= 230 && c.s < 0.5 && c.l >= 0.2 && c.l <= 0.8);
}

export const itemColorGroup = (item: Pick<ClothingItem, 'category' | 'colors'>): ColorGroup | null =>
  isDenimBottom(item) ? 'neutral' : colorGroupOf(item.colors[0]);

/** Mon nay di voi mau dang chon: cung nhom, trung tinh, hoac co trong bang cong thuc. */
export function goesWith(selected: ColorGroup, item: Pick<ClothingItem, 'category' | 'colors'>): boolean {
  const group = itemColorGroup(item);
  if (!group) return false;
  return group === 'neutral' || group === selected || isFormulaPair(selected, group);
}
