// ===== NEW: Body 3D =====
/**
 * Doi don vi do - pure function. Moi gia tri LUU TRU luon la cm / kg;
 * chi doi sang in / lb khi hien thi va doi nguoc ngay khi nguoi dung nhap.
 */

import type { BodySliderKey, UnitPreference } from '@/types';
import { BODY_SLIDER_RANGES } from '@/types';

export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

export type MetricKind = 'length' | 'mass';

export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export const metricKind = (key: BodySliderKey | 'shoulderCm'): MetricKind =>
  key === 'weightKg' ? 'mass' : 'length';

/** cm/kg -> don vi hien thi. */
export function toDisplay(value: number, kind: MetricKind, unit: UnitPreference): number {
  if (unit === 'metric') return value;
  return kind === 'length' ? cmToIn(value) : kgToLb(value);
}

/** Don vi hien thi -> cm/kg. */
export function fromDisplay(value: number, kind: MetricKind, unit: UnitPreference): number {
  if (unit === 'metric') return value;
  return kind === 'length' ? inToCm(value) : lbToKg(value);
}

export function unitLabel(kind: MetricKind, unit: UnitPreference): string {
  if (unit === 'metric') return kind === 'length' ? 'cm' : 'kg';
  return kind === 'length' ? 'in' : 'lb';
}

/** Buoc thanh truot theo don vi hien thi. */
export function sliderStep(kind: MetricKind, unit: UnitPreference): number {
  if (unit === 'metric') return 0.5;
  return kind === 'length' ? 0.25 : 0.5;
}

/** Khoang thanh truot da doi sang don vi hien thi. */
export function displayRange(key: BodySliderKey, unit: UnitPreference) {
  const { min, max } = BODY_SLIDER_RANGES[key];
  const kind = metricKind(key);
  return { min: toDisplay(min, kind, unit), max: toDisplay(max, kind, unit) };
}

export const roundTo = (v: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 170.25 -> "170,3" (dau phay thap phan, 1 chu so le). */
export const formatNumber = (v: number) => NUMBER_FORMAT.format(v);

/** "170,0 cm" / "66,9 in". */
export function formatMeasure(value: number, kind: MetricKind, unit: UnitPreference): string {
  return `${formatNumber(toDisplay(value, kind, unit))} ${unitLabel(kind, unit)}`;
}

/**
 * Doc so nguoi dung go: chap nhan ca "170,5" lan "170.5" (so do < 1000 nen khong co
 * dau phan cach hang nghin). Khong phai so -> NaN.
 */
export function parseLocaleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s)) return NaN;
  return Number(s);
}
// ===== END NEW =====
