import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
// ===== NEW: Admin role =====
import { ROLES, Role } from '../types/index.js';
// ===== END NEW =====
// ===== NEW: Body Profile =====
import {
  BODY_GENDERS, BODY_SHAPES, BODY_MEASUREMENT_RANGES, BodyProfile,
  BODY_WEIGHT_RANGE, MODEL_HUE_RANGE, UNIT_PREFERENCES,
} from '../types/index.js';
// ===== END NEW =====
// ===== NEW: Forgot Password =====
import crypto from 'crypto';

/** Thoi han link dat lai mat khau. */
export const RESET_PASSWORD_TTL_MS = 15 * 60 * 1000;

/** Bam reset token truoc khi luu/tim trong DB - dung chung cho model va controller. */
export const hashResetToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');
// ===== END NEW =====

// ===== NEW: Register OTP =====
/** Thoi han ma OTP dang ky. */
export const REGISTRATION_OTP_TTL_MS = 10 * 60 * 1000;
/** Nhap sai qua so lan nay thi ma OTP bi huy, phai gui lai ma moi (chong brute-force 6 so). */
export const REGISTRATION_OTP_MAX_ATTEMPTS = 5;
// ===== END NEW =====

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  displayName: string;
  avatarUrl?: string;
  // ===== NEW: Update Profile =====
  /** publicId tren Cloudinary cua avatar hien tai - de xoa anh cu khi doi avatar. */
  avatarPublicId?: string;
  // ===== END NEW =====
  /** Thanh pho mac dinh de goi OpenWeatherMap khi vao trang Suggest. */
  defaultCity: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(plain: string): Promise<boolean>;
  // ===== NEW: Forgot Password =====
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  /** Tao token moi, luu ban hash vao document (chua save), tra ve token goc de gui email. */
  createPasswordResetToken(): string;
  // ===== END NEW =====
  // ===== NEW: Register OTP =====
  isVerified: boolean;
  registrationOtp?: string;
  registrationOtpExpire?: Date;
  registrationOtpAttempts?: number;
  /** Sinh OTP 6 so moi, luu ban hash vao document (chua save), tra ve OTP goc de gui email. */
  createRegistrationOtp(): string;
  // ===== END NEW =====
  // ===== NEW: Admin role =====
  role: Role;
  /** false = bi admin khoa tai khoan. */
  isActive: boolean;
  lockReason?: string;
  // ===== END NEW =====
  // ===== NEW: Body Profile =====
  /** Dang nguoi (tuy chon) - chi dung cho mannequin va goi y, KHONG bao gio tra ra API public. */
  bodyProfile?: BodyProfile;
  // ===== END NEW =====
}

// ===== NEW: Body Profile =====
const range = (k: keyof typeof BODY_MEASUREMENT_RANGES) => ({
  type: Number,
  min: BODY_MEASUREMENT_RANGES[k].min,
  max: BODY_MEASUREMENT_RANGES[k].max,
});

const bodyProfileSchema = new Schema<BodyProfile>(
  {
    gender: { type: String, enum: BODY_GENDERS, default: 'neutral' },
    shape: { type: String, enum: BODY_SHAPES, default: 'rectangle' },
    measurements: {
      heightCm: range('heightCm'),
      shoulderCm: range('shoulderCm'),
      bustCm: range('bustCm'),
      waistCm: range('waistCm'),
      hipCm: range('hipCm'),
      inseamCm: range('inseamCm'),
    },
    // Khong dat default -> ho so cu doc ra khong tu "co" can nang hay tuy chon hien thi.
    // unitPreference / modelColorHue / showBmi: tuy chon cua giao dien cu, client hien tai
    // khong doc/ghi nua nhung van giu nguyen trong DB.
    weightKg: { type: Number, min: BODY_WEIGHT_RANGE.min, max: BODY_WEIGHT_RANGE.max },
    unitPreference: { type: String, enum: UNIT_PREFERENCES },
    modelColorHue: { type: Number, min: MODEL_HUE_RANGE.min, max: MODEL_HUE_RANGE.max },
    showBmi: { type: Boolean },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);
// ===== END NEW =====

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select:false -> khong bao gio lo hash ra API response neu quen .select()
    password: { type: String, required: true, minlength: 6, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    avatarUrl: { type: String },
    // ===== NEW: Update Profile =====
    avatarPublicId: { type: String, select: false },
    // ===== END NEW =====
    defaultCity: { type: String, default: 'Hanoi' },
    // ===== NEW: Forgot Password =====
    // select:false -> /auth/me tra ca document nen khong duoc lo hash token.
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    // ===== END NEW =====
    // ===== NEW: Register OTP =====
    // Tai khoan cu (tao truoc khi co OTP) khong co field nay trong DB. Khi query dung
    // { isVerified: false } de chi bat tai khoan dang cho xac thuc, khong dinh tai khoan cu.
    isVerified: { type: Boolean, default: false },
    registrationOtp: { type: String, select: false },
    registrationOtpExpire: { type: Date, select: false },
    registrationOtpAttempts: { type: Number, select: false },
    // ===== END NEW =====
    // ===== NEW: Admin role =====
    // Co default -> tai khoan cu trong DB tu nhan role 'user', isActive true khi doc ra.
    // Register/updateProfile validate bang Zod nen client khong tu gan role duoc.
    role: { type: String, enum: ROLES, default: 'user' },
    isActive: { type: Boolean, default: true },
    lockReason: { type: String, maxlength: 500 },
    // ===== END NEW =====
    // ===== NEW: Body Profile =====
    // select:false -> /auth/me va moi populate('owner') deu khong keo theo; chi
    // /users/me/body-profile select tuong minh '+bodyProfile'.
    bodyProfile: { type: bodyProfileSchema, select: false },
    // ===== END NEW =====
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    // ===== NEW: Body Profile =====
    // Lop bao ve thu 2: du lo select('+bodyProfile') o dau do, res.json(user) van khong lo ra.
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.bodyProfile;
        return ret;
      },
    },
    // ===== END NEW =====
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain: string) {
  return bcrypt.compare(plain, this.password);
};

// ===== NEW: Forgot Password =====
userSchema.methods.createPasswordResetToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = hashResetToken(token);
  this.resetPasswordExpire = new Date(Date.now() + RESET_PASSWORD_TTL_MS);
  return token;
};
// ===== END NEW =====

// ===== NEW: Register OTP =====
userSchema.methods.createRegistrationOtp = function (): string {
  // randomInt dung CSPRNG, khong dung Math.random() cho ma bao mat.
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  this.registrationOtp = hashResetToken(otp);
  this.registrationOtpExpire = new Date(Date.now() + REGISTRATION_OTP_TTL_MS);
  this.registrationOtpAttempts = 0;
  return otp;
};
// ===== END NEW =====

export const User = model<IUser>('User', userSchema);
