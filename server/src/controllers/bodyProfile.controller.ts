// ===== NEW: Body Profile =====
import { z } from 'zod';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  BODY_GENDERS, BODY_SHAPES, BODY_MEASUREMENT_RANGES, BodyMeasurementKey,
  // NEW: Body 3D
  BODY_WEIGHT_RANGE, MODEL_HUE_RANGE, UNIT_PREFERENCES,
} from '../types/index.js';

const LABELS: Record<BodyMeasurementKey, string> = {
  heightCm: 'Chieu cao',
  shoulderCm: 'Ngang vai',
  bustCm: 'Vong nguc',
  waistCm: 'Vong eo',
  hipCm: 'Vong hong',
  inseamCm: 'Dai chan trong', // NEW: Body 3D
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
    inseamCm: measurement('inseamCm'), // NEW: Body 3D
  })
  .strict();

// ===== NEW: Body 3D =====
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

/** Truong mo rong cua ho so - deu tuy chon nen ho so cu thieu cac truong nay van hop le. */
const extendedFields = {
  weightKg: weightField.optional(),
  unitPreference: unitField.optional(),
  modelColorHue: hueField.optional(),
  showBmi: z.boolean({ invalid_type_error: 'showBmi phai la true/false' }).optional(),
};
// ===== END NEW =====

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

/** PUT thay the toan bo profile: field nao khong gui thi ve mac dinh / bi xoa. */
export const bodyProfileSchema = z
  .object({
    gender: genderField.default('neutral'),
    shape: shapeField.default('rectangle'),
    measurements: measurementsSchema.optional(),
    ...extendedFields, // NEW: Body 3D
  })
  .strict();

// ===== NEW: Body 3D =====
/** Snapshot dang nguoi trong Outfit.scene3D: dang + so do + can nang + mau (khong co tuy chon hien thi). */
export const bodySnapshotSchema = mannequinSchema
  .extend({ weightKg: weightField.optional(), modelColorHue: hueField.optional() })
  .strict();
// ===== END NEW =====

/** GET /api/users/me/body-profile - null neu user chua thiet lap. */
export const getBodyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.sub).select('+bodyProfile');
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  res.json({ success: true, data: user.bodyProfile ?? null });
});

/** PUT /api/users/me/body-profile */
export const updateBodyProfile = asyncHandler(async (req, res) => {
  const { gender, shape, measurements, ...extended } = req.body as z.infer<typeof bodyProfileSchema>;

  // Bo cac so do rong de khong luu object {} vo nghia.
  const cleaned = Object.fromEntries(
    Object.entries(measurements ?? {}).filter(([, v]) => v !== undefined)
  );

  const user = await User.findByIdAndUpdate(
    req.user!.sub,
    {
      $set: {
        bodyProfile: {
          gender,
          shape,
          ...(Object.keys(cleaned).length ? { measurements: cleaned } : {}),
          // NEW: Body 3D - PUT thay toan bo: truong khong gui thi khong luu (bi xoa).
          ...Object.fromEntries(Object.entries(extended).filter(([, v]) => v !== undefined)),
          updatedAt: new Date(),
        },
      },
    },
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
