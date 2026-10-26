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
// Dung partialFilterExpression thay vi sparse: true vi sparse tren compound index van danh chi muc
// neu field user ton tai, gay loi duplicate key { user: id, post: null } khi 1 user like outfit thu 2.
likeSchema.index(
  { user: 1, outfit: 1 },
  { unique: true, partialFilterExpression: { outfit: { $exists: true, $type: 'objectId' } } }
);
likeSchema.index(
  { user: 1, post: 1 },
  { unique: true, partialFilterExpression: { post: { $exists: true, $type: 'objectId' } } }
);

export const Like = model<ILike>('Like', likeSchema);
