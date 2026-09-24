/**
 * Domain enums & shared types.
 * Giu o mot noi de client co the copy sang dung chung.
 */

export const CATEGORIES = [
  'top',          // ao (t-shirt, so mi, hoodie...)
  'bottom',       // quan, chan vay
  'outerwear',    // ao khoac, blazer
  'dress',        // vay lien than / jumpsuit
  'shoes',
  'bag',
  'accessory',    // mu, kinh, that lung, trang suc
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Layer mac dinh tren canvas: so lon = nam tren. */
export const CATEGORY_Z_INDEX: Record<Category, number> = {
  bottom: 10,
  dress: 20,
  top: 30,
  outerwear: 40,
  shoes: 15,
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

export interface JwtPayload {
  sub: string;   // userId
  email: string;
}
