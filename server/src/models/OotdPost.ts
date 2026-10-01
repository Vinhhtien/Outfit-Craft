import { Schema, model, Document, Types } from 'mongoose';

/**
 * Bai dang OOTD: chia se 1 outfit len feed cong khai.
 * Rang buoc nghiep vu (kiem tra o controller): outfit phai thuoc chinh user dang bai.
 * So like = dem trong collection Like, khong luu cung tai day.
 */
export interface IOotdPost extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  outfit: Types.ObjectId;
  caption?: string;
  /** Admin an bai vi pham. */
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ootdPostSchema = new Schema<IOotdPost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outfit: { type: Schema.Types.ObjectId, ref: 'Outfit', required: true, index: true },
    caption: { type: String, trim: true, maxlength: 500 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Feed chung + trang ca nhan cua 1 user, deu sap xep moi nhat truoc.
ootdPostSchema.index({ isHidden: 1, createdAt: -1 });
ootdPostSchema.index({ user: 1, createdAt: -1 });

export const OotdPost = model<IOotdPost>('OotdPost', ootdPostSchema);
