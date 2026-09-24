import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

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

export const User = model<IUser>('User', userSchema);
