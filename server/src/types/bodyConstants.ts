// ===== NEW: Body 3D =====
/**
 * Hang so dang nguoi dung chung client/server - NGUON DUY NHAT.
 * client/src/types/bodyConstants.ts la ban sao y het: sua 1 ben thi copy sang
 * ben kia (khong co test tu dong doi chieu).
 * File nay khong duoc import gi de client import chung duoc.
 */

export const BODY_GENDERS = ['female', 'male', 'neutral'] as const;
export type BodyGender = (typeof BODY_GENDERS)[number];

export const BODY_SHAPES = [
  'rectangle', 'pear', 'apple', 'hourglass', 'inverted_triangle',
] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

/**
 * Khoang LUU TRU hop le (cm) - zod + mongoose dung khoang nay.
 * Cac so do cu giu khoang rong nhu truoc de ho so/outfit da luu van hop le.
 */
export const BODY_MEASUREMENT_RANGES = {
  heightCm: { min: 120, max: 220 },
  shoulderCm: { min: 25, max: 70 },
  bustCm: { min: 60, max: 160 },
  waistCm: { min: 45, max: 160 },
  hipCm: { min: 60, max: 170 },
  inseamCm: { min: 60, max: 100 },
} as const;
export type BodyMeasurementKey = keyof typeof BODY_MEASUREMENT_RANGES;
export type BodyMeasurements = Partial<Record<BodyMeasurementKey, number>>;

/** Can nang (kg) - du lieu nhay cam, nam ngoai measurements. */
export const BODY_WEIGHT_RANGE = { min: 35, max: 150 } as const;

/**
 * Khoang THANH TRUOT o bang chinh thong so 3D. Luon nam trong khoang luu tru o tren,
 * nen moi gia tri keo ra tu slider deu qua duoc zod.
 */
export const BODY_SLIDER_RANGES = {
  heightCm: { min: 140, max: 210 },
  weightKg: { min: 35, max: 150 },
  bustCm: { min: 70, max: 140 },
  waistCm: { min: 55, max: 140 },
  hipCm: { min: 75, max: 150 },
  inseamCm: { min: 60, max: 100 },
} as const;
export type BodySliderKey = keyof typeof BODY_SLIDER_RANGES;

export const UNIT_PREFERENCES = ['metric', 'imperial'] as const;
export type UnitPreference = (typeof UNIT_PREFERENCES)[number];

/** Mau mo hinh luu bang hue (do). */
export const MODEL_HUE_RANGE = { min: 0, max: 360 } as const;

/** Phien ban dinh dang Outfit.scene3D. */
export const SCENE3D_VERSION = 1;
/** Toi da so mon trong 1 canh 3D. */
export const SCENE3D_MAX_ITEMS = 50;
// ===== END NEW =====
