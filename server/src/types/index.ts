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
