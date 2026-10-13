// ===== NEW: Body Profile =====
import { z } from 'zod';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  BODY_GENDERS, BODY_SHAPES, BODY_MEASUREMENT_RANGES, BodyMeasurementKey, BodyProfile,
  BODY_WEIGHT_RANGE, MODEL_HUE_RANGE, UNIT_PREFERENCES,
} from '../types/index.js';

const LABELS: Record<BodyMeasurementKey, string> = {
  heightCm: 'Chieu cao',
  shoulderCm: 'Ngang vai',
  bustCm: 'Vong nguc',
  waistCm: 'Vong eo',
  hipCm: 'Vong hong',
  inseamCm: 'Dai chan trong',
};

const measurement = (k: BodyMeasurementKey) => {
  const { min, max } = BODY_MEASUREMENT_RANGES[k];
  const msg = `${LABELS[k]} phai tu ${min} den ${max} cm`;
  return z
    .number({ invalid_type_error: `${LABELS[k]} phai la so` })
    .min(min, msg)
    .max(max, msg)
    .optional();
};

/** Dung chung cho PUT body-profile va snapshot mannequin trong outfit. */
export const measurementsSchema = z
  .object({
    heightCm: measurement('heightCm'),
    shoulderCm: measurement('shoulderCm'),
    bustCm: measurement('bustCm'),
    waistCm: measurement('waistCm'),
    hipCm: measurement('hipCm'),
    inseamCm: measurement('inseamCm'),
  })
  .strict();

const weightMsg = `Can nang phai tu ${BODY_WEIGHT_RANGE.min} den ${BODY_WEIGHT_RANGE.max} kg`;
export const weightField = z
  .number({ invalid_type_error: 'Can nang phai la so' })
  .min(BODY_WEIGHT_RANGE.min, weightMsg)
  .max(BODY_WEIGHT_RANGE.max, weightMsg);

const hueMsg = `Mau mo hinh phai tu ${MODEL_HUE_RANGE.min} den ${MODEL_HUE_RANGE.max}`;
export const hueField = z
  .number({ invalid_type_error: 'Mau mo hinh phai la so' })
  .min(MODEL_HUE_RANGE.min, hueMsg)
  .max(MODEL_HUE_RANGE.max, hueMsg);

const unitField = z.enum(UNIT_PREFERENCES, {
  errorMap: () => ({ message: `Don vi do phai la 1 trong: ${UNIT_PREFERENCES.join(', ')}` }),
});

/**
 * Truong mo rong cua ho so - deu tuy chon nen ho so cu thieu cac truong nay van hop le.
 * unitPreference / modelColorHue / showBmi: client hien tai khong gui nua (tuy chon cua giao dien cu),
 * server van nhan de khong lam hong client cu va giu nguyen du lieu da luu.
 */
const extendedFields = {
  weightKg: weightField.optional(),
  unitPreference: unitField.optional(),
  modelColorHue: hueField.optional(),
  showBmi: z.boolean({ invalid_type_error: 'showBmi phai la true/false' }).optional(),
};

const genderField = z.enum(BODY_GENDERS, {
  errorMap: () => ({ message: `Gioi tinh phai la 1 trong: ${BODY_GENDERS.join(', ')}` }),
});
const shapeField = z.enum(BODY_SHAPES, {
  errorMap: () => ({ message: `Dang nguoi phai la 1 trong: ${BODY_SHAPES.join(', ')}` }),
});

export const mannequinSchema = z
  .object({
    gender: genderField,
    shape: shapeField,
    measurements: measurementsSchema.optional(),
  })
  .strict();

/**
 * PUT gop (merge) vao ho so: field nao khong gui thi giu nguyen trong DB, ke ca tung so do
 * trong measurements. Khong co cach xoa 1 field qua PUT - muon xoa thi DELETE ca ho so.
 */
export const bodyProfileSchema = z
  .object({
    gender: genderField.optional(),
    shape: shapeField.optional(),
    measurements: measurementsSchema.optional(),
    ...extendedFields,
  })
  .strict();

export type BodyProfilePatch = z.infer<typeof bodyProfileSchema>;

const definedOnly = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * Gop ban va vao ho so hien tai (pure function). Khong bao gio lam mat field da luu:
 * field khong co trong patch giu nguyen; gender/shape mac dinh neutral/rectangle khi chua co ho so.
 */
export function mergeBodyProfile(
  current: Partial<BodyProfile> | null | undefined,
  patch: BodyProfilePatch,
  now: Date = new Date()
): BodyProfile {
  const { measurements: currentM, updatedAt: _old, ...currentRest } = current ?? {};
  const { measurements: patchM, gender, shape, ...patchRest } = patch;
  const measurements = { ...definedOnly(currentM ?? {}), ...definedOnly(patchM ?? {}) };

  return {
    ...definedOnly(currentRest),
    ...definedOnly(patchRest),
    gender: gender ?? current?.gender ?? 'neutral',
    shape: shape ?? current?.shape ?? 'rectangle',
    ...(Object.keys(measurements).length ? { measurements } : {}),
    updatedAt: now,
  };
}

/** GET /api/users/me/body-profile - null neu user chua thiet lap. */
export const getBodyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.sub).select('+bodyProfile');
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  res.json({ success: true, data: user.bodyProfile ?? null });
});

/** PUT /api/users/me/body-profile - gop vao ho so hien tai (xem mergeBodyProfile). */
export const updateBodyProfile = asyncHandler(async (req, res) => {
  const existing = await User.findById(req.user!.sub).select('+bodyProfile');
  if (!existing) throw ApiError.notFound('Khong tim thay nguoi dung');

  // toObject() khong qua transform cua toJSON (transform do xoa bodyProfile).
  const current = existing.toObject().bodyProfile as Partial<BodyProfile> | undefined;
  const merged = mergeBodyProfile(current, req.body as BodyProfilePatch);

  const user = await User.findByIdAndUpdate(
    req.user!.sub,
    { $set: { bodyProfile: merged } },
    { new: true, runValidators: true }
  ).select('+bodyProfile');
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  res.json({ success: true, message: 'Da luu dang nguoi', data: user.bodyProfile ?? null });
});

/** DELETE /api/users/me/body-profile - xoa toan bo du lieu dang nguoi. */
export const deleteBodyProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user!.sub, { $unset: { bodyProfile: 1 } });
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  res.json({ success: true, message: 'Da xoa du lieu dang nguoi' });
});
// ===== END NEW =====
