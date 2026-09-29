import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
// ===== NEW: Forgot Password =====
import crypto from 'crypto';

/** Thoi han link dat lai mat khau. */
export const RESET_PASSWORD_TTL_MS = 15 * 60 * 1000;

/** Bam reset token truoc khi luu/tim trong DB - dung chung cho model va controller. */
export const hashResetToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');
// ===== END NEW =====

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  displayName: string;
  avatarUrl?: string;
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
}

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
    defaultCity: { type: String, default: 'Hanoi' },
    // ===== NEW: Forgot Password =====
    // select:false -> /auth/me tra ca document nen khong duoc lo hash token.
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    // ===== END NEW =====
  },
  { timestamps: true }
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

export const User = model<IUser>('User', userSchema);
