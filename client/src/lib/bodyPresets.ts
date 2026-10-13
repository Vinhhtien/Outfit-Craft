/**
 * Bo so do mac dinh / preset theo dang - NGUON DUY NHAT cho ca hinh ve (mannequin.ts) lan
 * bang chinh so do (bodyMetrics.ts). Pure function, don vi cm / kg.
 *
 * Mannequin thieu so do nao thi dien tu day, nen "chua nhap gi" va "bam Ve mac dinh" ra
 * cung mot hinh.
 */

import type { BodyGender, BodyMeasurementKey, BodyShape } from '@/types';
import { BODY_MEASUREMENT_RANGES, BODY_WEIGHT_RANGE } from '@/types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Gia tri MAC DINH luon nam trong khoang luu tru (o chieu cao rat thap/cao preset co the vuot). */
const clampStored = (k: BodyMeasurementKey, v: number) =>
  clamp(v, BODY_MEASUREMENT_RANGES[k].min, BODY_MEASUREMENT_RANGES[k].max);

export const DEFAULT_HEIGHT_CM: Record<BodyGender, number> = { female: 160, male: 172, neutral: 166 };
const DEFAULT_BMI: Record<BodyGender, number> = { female: 21.5, male: 22.5, neutral: 22 };
/** Dai chan trong / chieu cao. */
export const DEFAULT_INSEAM_RATIO: Record<BodyGender, number> = { female: 0.45, male: 0.455, neutral: 0.45 };

/** Chieu cao goc cua bang preset. */
export const PRESET_HEIGHT_CM = 165;

export type PresetKey = 'shoulderCm' | 'bustCm' | 'waistCm' | 'hipCm';
export const PRESET_KEYS: PresetKey[] = ['shoulderCm', 'bustCm', 'waistCm', 'hipCm'];

/**
 * Ngang vai + vong nguc/eo/hong (cm) mau cho moi dang o chieu cao 165 cm, gioi tinh trung tinh.
 * Chon sao cho classifyShape() tra dung dang o moi chieu cao / gioi tinh.
 */
export const SHAPE_PRESETS_CM: Record<BodyShape, Record<PresetKey, number>> = {
  rectangle: { shoulderCm: 36, bustCm: 89, waistCm: 75, hipCm: 91 },
  pear: { shoulderCm: 34.5, bustCm: 86, waistCm: 70, hipCm: 104 },
  apple: { shoulderCm: 36.5, bustCm: 98, waistCm: 92, hipCm: 96 },
  hourglass: { shoulderCm: 37, bustCm: 94, waistCm: 68, hipCm: 96 },
  inverted_triangle: { shoulderCm: 42, bustCm: 102, waistCm: 82, hipCm: 90 },
};

/**
 * He so theo gioi tinh: `size` nhan deu 3 vong (nam to hon), con lai chinh nhe tung vung
 * (nu: hong/nguc nhinh hon vai; nam: vai rong hon). Du nhe de khong doi ket qua classifyShape.
 */
const GENDER_FACTORS: Record<BodyGender, Record<PresetKey, number> & { size: number }> = {
  female: { size: 0.98, shoulderCm: 0.97, bustCm: 1.01, waistCm: 0.99, hipCm: 1.015 },
  male: { size: 1.05, shoulderCm: 1.04, bustCm: 0.995, waistCm: 1.01, hipCm: 0.985 },
  neutral: { size: 1, shoulderCm: 1, bustCm: 1, waistCm: 1, hipCm: 1 },
};

/** Lam tron 0,5 cm. */
export const round05 = (v: number) => Math.round(v * 2) / 2;

/** Ngang vai + 3 vong mau cho dang `shape` o chieu cao `heightCm` (lam tron 0,5 cm, trong khoang luu tru). */
export function shapePresetMeasurements(
  shape: BodyShape,
  gender: BodyGender,
  heightCm: number
): Record<PresetKey, number> {
  const base = SHAPE_PRESETS_CM[shape] ?? SHAPE_PRESETS_CM.rectangle;
  const g = GENDER_FACTORS[gender] ?? GENDER_FACTORS.neutral;
  const k = heightCm / PRESET_HEIGHT_CM;
  return {
    // Vai la be ngang (khong phai vong) -> khong nhan he so "size" cua vong.
    shoulderCm: clampStored('shoulderCm', round05(base.shoulderCm * k * g.shoulderCm)),
    bustCm: clampStored('bustCm', round05(base.bustCm * k * g.size * g.bustCm)),
    waistCm: clampStored('waistCm', round05(base.waistCm * k * g.size * g.waistCm)),
    hipCm: clampStored('hipCm', round05(base.hipCm * k * g.size * g.hipCm)),
  };
}

export const defaultHeightCm = (gender: BodyGender) => DEFAULT_HEIGHT_CM[gender] ?? DEFAULT_HEIGHT_CM.neutral;
export const defaultInseamCm = (gender: BodyGender, heightCm: number) =>
  clampStored('inseamCm', round05(heightCm * (DEFAULT_INSEAM_RATIO[gender] ?? DEFAULT_INSEAM_RATIO.neutral)));
export const defaultWeightKg = (gender: BodyGender, heightCm: number) =>
  clamp(
    round05((DEFAULT_BMI[gender] ?? DEFAULT_BMI.neutral) * (heightCm / 100) ** 2),
    BODY_WEIGHT_RANGE.min,
    BODY_WEIGHT_RANGE.max
  );

export type FullMeasurements = Record<BodyMeasurementKey, number>;

/**
 * Dien moi so do con thieu tu preset cua dang (theo chieu cao da co, khong co thi chieu cao
 * mac dinh cua gioi tinh). So do da co giu NGUYEN (khong kep).
 */
export function fillMeasurements(
  gender: BodyGender,
  shape: BodyShape,
  m: Partial<Record<BodyMeasurementKey, number>> = {}
): FullMeasurements {
  const heightCm = m.heightCm ?? defaultHeightCm(gender);
  const preset = shapePresetMeasurements(shape, gender, heightCm);
  const pick = (k: BodyMeasurementKey, fallback: number) => (typeof m[k] === 'number' ? m[k]! : fallback);
  return {
    heightCm,
    shoulderCm: pick('shoulderCm', preset.shoulderCm),
    bustCm: pick('bustCm', preset.bustCm),
    waistCm: pick('waistCm', preset.waistCm),
    hipCm: pick('hipCm', preset.hipCm),
    inseamCm: pick('inseamCm', defaultInseamCm(gender, heightCm)),
  };
}
