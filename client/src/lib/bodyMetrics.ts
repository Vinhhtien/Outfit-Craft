// ===== NEW: Body 3D =====
/**
 * Bo so do cho nguoi mau 3D - pure function: gia tri mac dinh, preset theo dang,
 * che do "Tu can doi", BMI, doi qua lai voi BodyProfile luu tren server.
 * Don vi luon la cm / kg (doi don vi hien thi nam o units.ts).
 */

import type {
  BodyGender, BodyMeasurements, BodyProfile, BodyShape, BodySliderKey,
  MannequinProfile, Scene3DBodySnapshot, UnitPreference,
} from '@/types';
import { BODY_MEASUREMENT_RANGES, BODY_SLIDER_RANGES } from '@/types';
import { roundTo } from './units';

export type MetricKey = BodySliderKey;
export type BodyMetrics = Record<MetricKey, number>;

export const METRIC_KEYS: MetricKey[] = [
  'heightCm', 'weightKg', 'bustCm', 'waistCm', 'hipCm', 'inseamCm',
];

export const CIRCUMFERENCE_KEYS = ['bustCm', 'waistCm', 'hipCm'] as const;
type CircumferenceKey = (typeof CIRCUMFERENCE_KEYS)[number];

/** Trang thai day du cua nguoi mau (dung chung trang Ho so va Studio). */
export interface BodyState {
  gender: BodyGender;
  shape: BodyShape;
  metrics: BodyMetrics;
  /** Ngang vai (cm) tuy chon; khong co thi uoc luong tu vong nguc + gioi tinh. */
  shoulderCm?: number;
  /** Cac so do nguoi dung da nhap/chinh -> chi nhung so nay duoc luu vao ho so. */
  provided: MetricKey[];
  unit: UnitPreference;
  hue: number;
  showBmi: boolean;
}

export type SliderMode = 'single' | 'balance';

export const DEFAULT_HUE = 30;

/* ---------------- Mac dinh & preset ---------------- */

/** Trung voi DEFAULT_HEIGHT_CM trong mannequin.ts. */
const DEFAULT_HEIGHT: Record<BodyGender, number> = { female: 160, male: 172, neutral: 166 };
const DEFAULT_BMI: Record<BodyGender, number> = { female: 21.5, male: 22.5, neutral: 22 };
/** Dai chan trong / chieu cao. */
const INSEAM_RATIO: Record<BodyGender, number> = { female: 0.45, male: 0.455, neutral: 0.45 };

/** Chieu cao goc cua bang preset. */
const PRESET_HEIGHT = 165;

/**
 * Vong nguc/eo/hong (cm) mau cho moi dang o chieu cao 165 cm. Chon sao cho
 * classifyShape() tra dung dang voi khoang cach an toan (co test quet moi chieu cao).
 */
export const SHAPE_PRESET_CIRCUMFERENCES: Record<BodyShape, Record<CircumferenceKey, number>> = {
  rectangle: { bustCm: 89, waistCm: 75, hipCm: 91 },
  pear: { bustCm: 86, waistCm: 70, hipCm: 104 },
  apple: { bustCm: 98, waistCm: 92, hipCm: 96 },
  hourglass: { bustCm: 94, waistCm: 68, hipCm: 96 },
  inverted_triangle: { bustCm: 102, waistCm: 82, hipCm: 90 },
};

/** Nhan deu ca 3 vong -> giu nguyen ti le nen khong doi ket qua classifyShape. */
const GENDER_CIRCUMFERENCE_FACTOR: Record<BodyGender, number> = { female: 0.98, male: 1.05, neutral: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round05 = (v: number) => Math.round(v * 2) / 2;

export function clampMetric(key: MetricKey, v: number): number {
  const { min, max } = BODY_SLIDER_RANGES[key];
  return clamp(v, min, max);
}

export function clampMetrics(m: BodyMetrics): BodyMetrics {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, clampMetric(k, m[k])])) as BodyMetrics;
}

/** Bo so do mau cho dang `shape` o chieu cao hien tai (lam tron 0,5 cm). */
export function shapePresetMetrics(shape: BodyShape, gender: BodyGender, heightCm: number) {
  const base = SHAPE_PRESET_CIRCUMFERENCES[shape] ?? SHAPE_PRESET_CIRCUMFERENCES.rectangle;
  const k = (heightCm / PRESET_HEIGHT) * (GENDER_CIRCUMFERENCE_FACTOR[gender] ?? 1);
  return Object.fromEntries(
    CIRCUMFERENCE_KEYS.map((key) => [key, clampMetric(key, round05(base[key] * k))])
  ) as Record<CircumferenceKey, number>;
}

export function defaultMetrics(gender: BodyGender, shape: BodyShape = 'rectangle', heightCm?: number): BodyMetrics {
  const h = clampMetric('heightCm', heightCm ?? DEFAULT_HEIGHT[gender] ?? DEFAULT_HEIGHT.neutral);
  return clampMetrics({
    heightCm: h,
    weightKg: round05(DEFAULT_BMI[gender] * (h / 100) ** 2),
    ...shapePresetMetrics(shape, gender, h),
    inseamCm: round05(h * INSEAM_RATIO[gender]),
  });
}

/* ---------------- Che do chinh ---------------- */

const avgCircumference = (m: BodyMetrics) => (m.bustCm + m.waistCm + m.hipCm) / 3;

/**
 * "Tu can doi" - UOC LUONG heuristic de mo hinh trong tu nhien, KHONG phai cong thuc y khoa:
 *  - can nang doi ti le r -> 3 vong nhan sqrt(r);
 *  - chieu cao doi, giu can nang -> 3 vong nhan sqrt(h_cu / h_moi), dai chan trong nhan h_moi / h_cu;
 *  - 1 vong doi -> can nang ~ chieu cao x (trung binh 3 vong)^2, hang so ti le lay tu trang thai hien tai;
 *  - dai chan trong doi -> chi doi chinh no.
 * Moi gia tri bi kep trong khoang thanh truot.
 */
export function autoBalance(prev: BodyMetrics, key: MetricKey, rawValue: number): BodyMetrics {
  const value = clampMetric(key, rawValue);
  const next: BodyMetrics = { ...prev, [key]: value };

  if (key === 'weightKg') {
    const s = Math.sqrt(value / prev.weightKg);
    for (const c of CIRCUMFERENCE_KEYS) next[c] = prev[c] * s;
  } else if (key === 'heightCm') {
    const s = Math.sqrt(prev.heightCm / value);
    for (const c of CIRCUMFERENCE_KEYS) next[c] = prev[c] * s;
    next.inseamCm = prev.inseamCm * (value / prev.heightCm);
  } else if ((CIRCUMFERENCE_KEYS as readonly string[]).includes(key)) {
    const k = prev.weightKg / (prev.heightCm * avgCircumference(prev) ** 2);
    next.weightKg = k * next.heightCm * avgCircumference(next) ** 2;
  }

  // Lam tron 0,1 de so tren UI gon, roi kep (gia tri vua keo giu nguyen).
  const out = clampMetrics(
    Object.fromEntries(METRIC_KEYS.map((k) => [k, roundTo(next[k], 1)])) as BodyMetrics
  );
  out[key] = value;
  return out;
}

/** Ket qua khi keo 1 thanh. Tra ve ca danh sach so do bi doi (de danh dau "da nhap"). */
export function applyMetricChange(prev: BodyMetrics, key: MetricKey, value: number, mode: SliderMode) {
  const metrics = mode === 'balance' ? autoBalance(prev, key, value) : { ...prev, [key]: clampMetric(key, value) };
  const changed = METRIC_KEYS.filter((k) => k === key || metrics[k] !== prev[k]);
  return { metrics, changed };
}

/* ---------------- BMI ---------------- */

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const BMI_THRESHOLDS = { underweight: 18.5, overweight: 25, obese: 30 } as const;
/** Khoang hien thi tren thanh mau BMI. */
export const BMI_SCALE = { min: 15, max: 40 } as const;

/** Nhan trung tinh (khong phan xet) - xem BodyControlsPanel. */
export const BMI_LABELS: Record<BmiCategory, string> = {
  underweight: 'Thiếu cân',
  normal: 'Bình thường',
  overweight: 'Thừa cân',
  obese: 'Béo phì',
};

export const bmi = (heightCm: number, weightKg: number) => weightKg / (heightCm / 100) ** 2;

export function bmiCategory(value: number): BmiCategory {
  if (value < BMI_THRESHOLDS.underweight) return 'underweight';
  if (value < BMI_THRESHOLDS.overweight) return 'normal';
  if (value < BMI_THRESHOLDS.obese) return 'overweight';
  return 'obese';
}

/** Vi tri (0..1) cua BMI tren thanh mau. */
export const bmiPosition = (value: number) =>
  clamp((value - BMI_SCALE.min) / (BMI_SCALE.max - BMI_SCALE.min), 0, 1);

/* ---------------- Doi qua lai voi ho so ---------------- */

const METRIC_IN_MEASUREMENTS: Exclude<MetricKey, 'weightKg'>[] = [
  'heightCm', 'bustCm', 'waistCm', 'hipCm', 'inseamCm',
];

/**
 * Ho so (co the thieu bat ky truong nao, ke ca ho so cu) -> trang thai day du.
 * Truong thieu duoc dien tu mac dinh theo gioi tinh + dang, nhung KHONG nam trong `provided`.
 */
export function bodyStateFromProfile(
  profile?: Partial<BodyProfile> | null,
  defaults: { showBmi: boolean } = { showBmi: true }
): BodyState {
  const gender = profile?.gender ?? 'neutral';
  const shape = profile?.shape ?? 'rectangle';
  const m = profile?.measurements ?? {};
  const base = defaultMetrics(gender, shape, m.heightCm);

  const metrics = { ...base };
  const provided: MetricKey[] = [];
  for (const k of METRIC_IN_MEASUREMENTS) {
    if (typeof m[k] === 'number') {
      metrics[k] = clampMetric(k, m[k]!);
      provided.push(k);
    }
  }
  if (typeof profile?.weightKg === 'number') {
    metrics.weightKg = clampMetric('weightKg', profile.weightKg);
    provided.push('weightKg');
  }

  return {
    gender,
    shape,
    metrics,
    ...(m.shoulderCm ? { shoulderCm: m.shoulderCm } : {}),
    provided: METRIC_KEYS.filter((k) => provided.includes(k)),
    unit: profile?.unitPreference ?? 'metric',
    hue: profile?.modelColorHue ?? DEFAULT_HUE,
    showBmi: profile?.showBmi ?? defaults.showBmi,
  };
}

/** Trang thai -> body PUT /users/me/body-profile. Chi gui so do nguoi dung da nhap. */
export function bodyStateToProfile(s: BodyState): Omit<BodyProfile, 'updatedAt'> {
  const measurements: BodyMeasurements = {};
  for (const k of METRIC_IN_MEASUREMENTS) {
    if (s.provided.includes(k)) measurements[k] = roundTo(s.metrics[k], 1);
  }
  const { min, max } = BODY_MEASUREMENT_RANGES.shoulderCm;
  if (s.shoulderCm && s.shoulderCm >= min && s.shoulderCm <= max) measurements.shoulderCm = s.shoulderCm;

  return {
    gender: s.gender,
    shape: s.shape,
    ...(Object.keys(measurements).length ? { measurements } : {}),
    ...(s.provided.includes('weightKg') ? { weightKg: roundTo(s.metrics.weightKg, 1) } : {}),
    unitPreference: s.unit,
    modelColorHue: Math.round(s.hue),
    showBmi: s.showBmi,
  };
}

/** Dang 2D (mannequin SVG / snapshot outfit) tuong ung voi trang thai 3D. */
export function bodyStateToMannequin(s: BodyState): MannequinProfile {
  const p = bodyStateToProfile({ ...s, provided: METRIC_KEYS });
  return { gender: p.gender, shape: p.shape, ...(p.measurements ? { measurements: p.measurements } : {}) };
}

/** Snapshot luu trong Outfit.scene3D: du so do de dung lai dung nguoi mau luc phoi. */
export function bodyStateToSnapshot(s: BodyState): Scene3DBodySnapshot {
  const p = bodyStateToProfile({ ...s, provided: METRIC_KEYS });
  return {
    gender: p.gender,
    shape: p.shape,
    measurements: p.measurements,
    weightKg: p.weightKg,
    modelColorHue: p.modelColorHue,
  };
}

/** Snapshot (outfit da luu) -> trang thai; tuy chon hien thi lay tu ho so hien tai. */
export function bodyStateFromSnapshot(snap: Scene3DBodySnapshot, current: BodyState): BodyState {
  const s = bodyStateFromProfile({ ...snap, unitPreference: current.unit, showBmi: current.showBmi });
  return { ...s, hue: snap.modelColorHue ?? current.hue };
}

export const sameBodyState = (a: BodyState, b: BodyState) => JSON.stringify(a) === JSON.stringify(b);
// ===== END NEW =====
