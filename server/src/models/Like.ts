import { Schema, model, Document, Types } from 'mongoose';

/** User tha tim 1 bai OOTD (bang trung gian User N-N OotdPost). */
export interface ILike extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'OotdPost', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Moi user chi like 1 bai 1 lan.
likeSchema.index({ user: 1, post: 1 }, { unique: true });
// Dem so like cua 1 bai.
likeSchema.index({ post: 1 });

export const Like = model<ILike>('Like', likeSchema);
