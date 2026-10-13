/**
 * Trang thai bang chinh so do (dung chung trang Ho so va Studio) - pure function.
 * Don vi luon la cm / kg. Hinh ve lay tu bodyStateToMannequin() -> mannequin.ts.
 *
 * Quy tac quan trong:
 *  - `provided` = so do nguoi dung da co (trong ho so) hoac da chinh -> chi nhung so nay duoc luu.
 *    So do chua co thi lay tu preset (bodyPresets.ts) va di theo chieu cao / gioi tinh / dang.
 *  - Gia tri da luu KHONG bi kep ve khoang slider: nguoi dung khong chinh field do thi luu lai y nguyen.
 */

import type { BodyGender, BodyMeasurements, BodyProfile, BodyShape, MannequinProfile } from '@/types';
import { BODY_MEASUREMENT_RANGES, BODY_SLIDER_RANGES, BODY_WEIGHT_RANGE } from '@/types';
import { visualRange } from './mannequin';
import { defaultWeightKg, fillMeasurements, shapePresetMeasurements, PRESET_KEYS } from './bodyPresets';

export type MetricKey = 'heightCm' | 'weightKg' | 'inseamCm' | 'shoulderCm' | 'bustCm' | 'waistCm' | 'hipCm';
export type BodyMetrics = Record<MetricKey, number>;

/** Thu tu hien thi tren bang. */
export const METRIC_KEYS: MetricKey[] = [
  'heightCm', 'weightKg', 'inseamCm', 'shoulderCm', 'bustCm', 'waistCm', 'hipCm',
];

type MeasurementKey = Exclude<MetricKey, 'weightKg'>;
const MEASUREMENT_KEYS = METRIC_KEYS.filter((k): k is MeasurementKey => k !== 'weightKg');

/** Cac so do bi kep theo chieu cao khi ve (xem visualRange). */
const HEIGHT_DEPENDENT: MeasurementKey[] = ['inseamCm', 'shoulderCm', 'bustCm', 'waistCm', 'hipCm'];

export interface BodyState {
  gender: BodyGender;
  shape: BodyShape;
  metrics: BodyMetrics;
  provided: MetricKey[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sortKeys = (keys: MetricKey[]) => METRIC_KEYS.filter((k) => keys.includes(k));
/** Lam tron vao trong theo buoc 0,5 cua slider. */
const ceil05 = (v: number) => Math.ceil(v * 2) / 2;
const floor05 = (v: number) => Math.floor(v * 2) / 2;

/* ---------------- Khoang hop le ---------------- */

/** Khoang LUU TRU (schema server) cua tung so do. */
export function storageRange(key: MetricKey): { min: number; max: number } {
  return key === 'weightKg' ? BODY_WEIGHT_RANGE : BODY_MEASUREMENT_RANGES[key];
}

/**
 * Khoang slider o chieu cao heightCm: khoang slider tinh ∩ khoang lam hinh thay doi (visualRange)
 * -> keo toi dau nao hinh cung doi, khong co doan "chet".
 */
export function sliderRange(key: MetricKey, heightCm: number): { min: number; max: number } {
  const base = BODY_SLIDER_RANGES[key];
  const visual = visualRange(key, heightCm);
  if (!visual) return { min: base.min, max: base.max };
  const min = ceil05(Math.max(base.min, visual.min));
  const max = floor05(Math.min(base.max, visual.max));
  return min < max ? { min, max } : { min: base.min, max: base.max };
}

/** Kiem tra so do nguoi dung nhap (cung khoang voi zod o server). null = hop le. */
export function validateMetric(key: MetricKey, value: number): string | null {
  const { min, max } = storageRange(key);
  const unit = key === 'weightKg' ? 'kg' : 'cm';
  if (!Number.isFinite(value)) return 'Vui lòng nhập một số.';
  if (value < min || value > max) return `Giá trị hợp lệ từ ${min} đến ${max} ${unit}.`;
  return null;
}

/* ---------------- Mac dinh ---------------- */

export function defaultMetrics(gender: BodyGender, shape: BodyShape = 'rectangle', heightCm?: number): BodyMetrics {
  const m = fillMeasurements(gender, shape, heightCm === undefined ? {} : { heightCm });
  return { ...m, weightKg: defaultWeightKg(gender, m.heightCm) };
}

/** Dien lai so do CHUA co (theo gioi tinh / dang / chieu cao hien tai), giu nguyen so da co. */
function refill(s: BodyState): BodyState {
  const own = Object.fromEntries(s.provided.map((k) => [k, s.metrics[k]])) as Partial<BodyMetrics>;
  const filled = fillMeasurements(s.gender, s.shape, own);
  return {
    ...s,
    metrics: { ...filled, weightKg: own.weightKg ?? defaultWeightKg(s.gender, filled.heightCm) },
  };
}

/* ---------------- Thao tac tren bang ---------------- */

/**
 * Keo can nang W0 -> W1: moi vong nhan (W1/W0)^p. Eo bien doi nhieu nhat, nguc it nhat.
 * Day la uoc luong de hinh trong tu nhien, khong phai cong thuc y khoa.
 */
export const WEIGHT_EXPONENTS = { bustCm: 0.45, waistCm: 0.6, hipCm: 0.5 } as const;
const CIRCUMFERENCE_KEYS = Object.keys(WEIGHT_EXPONENTS) as (keyof typeof WEIGHT_EXPONENTS)[];
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Doi can nang va tu co gian 3 vong theo WEIGHT_EXPONENTS. `base` = trang thai luc BAT DAU keo
 * slider: moi buoc deu tinh tu base nen khong bi sai so lam tron / kep don lai (keo qua lai
 * ve dung so cu). Vong sau khi co gian tinh la da nhap, kep vao khoang hinh ve duoc va khoang
 * luu tru. Vai, chieu cao, dai chan trong giu nguyen. Chinh rieng tung vong sau do khong doi can nang.
 */
export function setWeight(s: BodyState, weightKg: number, base: BodyState = s): BodyState {
  const ratio = weightKg / base.metrics.weightKg;
  const metrics = { ...s.metrics, weightKg };
  for (const k of CIRCUMFERENCE_KEYS) {
    const visual = visualRange(k, metrics.heightCm)!;
    const stored = BODY_MEASUREMENT_RANGES[k];
    const lo = Math.max(ceil05(visual.min), stored.min);
    const hi = Math.min(floor05(visual.max), stored.max);
    metrics[k] = clamp(round1(base.metrics[k] * ratio ** WEIGHT_EXPONENTS[k]), lo, hi);
  }
  return { ...s, metrics, provided: sortKeys([...s.provided, 'weightKg', ...CIRCUMFERENCE_KEYS]) };
}

/**
 * Doi 1 so do (tu slider / o nhap, da hop le). Can nang -> setWeight (co gian 3 vong). Doi chieu cao:
 *  - so do chua co di theo preset o chieu cao moi;
 *  - so do da co ma nam ngoai khoang hinh ve duoc o chieu cao moi (vd vai khi giam chieu cao)
 *    bi kep vao khoang do.
 */
export function setMetric(s: BodyState, key: MetricKey, value: number): BodyState {
  if (key === 'weightKg') return setWeight(s, value);
  const next = refill({ ...s, metrics: { ...s.metrics, [key]: value }, provided: sortKeys([...s.provided, key]) });
  if (key !== 'heightCm') return next;

  const metrics = { ...next.metrics };
  for (const k of HEIGHT_DEPENDENT) {
    if (!next.provided.includes(k)) continue;
    const r = visualRange(k, value)!;
    metrics[k] = clamp(metrics[k], ceil05(r.min), floor05(r.max));
  }
  return { ...next, metrics };
}

/** Doi gioi tinh: giu so do da co, so do chua co lay theo mac dinh cua gioi tinh moi. */
export const setGender = (s: BodyState, gender: BodyGender): BodyState => refill({ ...s, gender });

/** Chi doi nhan dang (vd "Dung dang nay" tu goi y): giu so do da co. */
export const setShapeLabel = (s: BodyState, shape: BodyShape): BodyState => refill({ ...s, shape });

/** Bam 1 dang mau: dien ngang vai + 3 vong mau cua dang o chieu cao hien tai. */
export function applyShapePreset(s: BodyState, shape: BodyShape): BodyState {
  const preset = shapePresetMeasurements(shape, s.gender, s.metrics.heightCm);
  return refill({
    ...s,
    shape,
    metrics: { ...s.metrics, ...preset },
    provided: sortKeys([...s.provided, ...PRESET_KEYS]),
  });
}

/**
 * "Dat lai mac dinh": giu chieu cao; ngang vai + 3 vong ve preset cua dang dang chon,
 * dai chan trong + can nang ve mac dinh theo chieu cao. Tat ca tinh la da chinh (luu thi ghi de).
 */
export function resetToDefaults(s: BodyState): BodyState {
  return { ...s, metrics: defaultMetrics(s.gender, s.shape, s.metrics.heightCm), provided: [...METRIC_KEYS] };
}

/* ---------------- Doi qua lai voi ho so ---------------- */

/**
 * Ho so (co the thieu bat ky truong nao) -> trang thai day du. Gia tri da luu giu NGUYEN
 * (khong kep ve khoang slider); truong thieu dien tu preset va khong nam trong `provided`.
 */
export function bodyStateFromProfile(profile?: Partial<BodyProfile> | null): BodyState {
  const gender = profile?.gender ?? 'neutral';
  const shape = profile?.shape ?? 'rectangle';
  const m: BodyMeasurements = profile?.measurements ?? {};
  const filled = fillMeasurements(gender, shape, m);
  const hasWeight = typeof profile?.weightKg === 'number';
  const provided: MetricKey[] = [
    ...MEASUREMENT_KEYS.filter((k) => typeof m[k] === 'number'),
    ...(hasWeight ? (['weightKg'] as const) : []),
  ];
  return {
    gender,
    shape,
    metrics: { ...filled, weightKg: hasWeight ? profile!.weightKg! : defaultWeightKg(gender, filled.heightCm) },
    provided: sortKeys(provided),
  };
}

/** Trang thai -> body PUT /users/me/body-profile (gop). Chi gui so do da co / da chinh. */
export function bodyStateToProfile(s: BodyState): Pick<BodyProfile, 'gender' | 'shape' | 'measurements' | 'weightKg'> {
  const measurements: BodyMeasurements = {};
  for (const k of MEASUREMENT_KEYS) if (s.provided.includes(k)) measurements[k] = s.metrics[k];
  return {
    gender: s.gender,
    shape: s.shape,
    ...(Object.keys(measurements).length ? { measurements } : {}),
    ...(s.provided.includes('weightKg') ? { weightKg: s.metrics.weightKg } : {}),
  };
}

/** Dang 2D de ve (va snapshot luu cung outfit): du bo so do dang hien thi, khong co can nang. */
export function bodyStateToMannequin(s: BodyState): MannequinProfile {
  const measurements: BodyMeasurements = {};
  for (const k of MEASUREMENT_KEYS) measurements[k] = s.metrics[k];
  return { gender: s.gender, shape: s.shape, measurements };
}

export const sameBodyState = (a: BodyState, b: BodyState) => JSON.stringify(a) === JSON.stringify(b);
