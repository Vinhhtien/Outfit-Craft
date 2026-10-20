import { Schema, model, Document, Types } from 'mongoose';

export interface IComment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  outfit: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outfit: { type: Schema.Types.ObjectId, ref: 'Outfit', required: true, index: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  },
  { timestamps: true }
);

commentSchema.index({ outfit: 1, createdAt: 1 });
commentSchema.index({ user: 1, createdAt: -1 });

export const Comment = model<IComment>('Comment', commentSchema);
