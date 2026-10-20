import { Schema, model, Document, Types } from 'mongoose';

/** User tha tim 1 outfit hoac 1 bai OOTD. */
export interface ILike extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  outfit?: Types.ObjectId;
  post?: Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outfit: { type: Schema.Types.ObjectId, ref: 'Outfit', index: true },
    post: { type: Schema.Types.ObjectId, ref: 'OotdPost', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Moi user chi like 1 outfit / post 1 lan.
likeSchema.index({ user: 1, outfit: 1 }, { unique: true, sparse: true });
likeSchema.index({ user: 1, post: 1 }, { unique: true, sparse: true });

export const Like = model<ILike>('Like', likeSchema);
