import { Schema, model, Document, Types } from 'mongoose';

/** Moi tai khoan giu toi da chung nay doan chat gan nhat. */
export const MAX_STYLIST_CONVERSATIONS = 50;

export interface IStylistConversation extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  /** Lay tu tin nhan dau tien, khong ton them lan goi AI. */
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stylistConversationSchema = new Schema<IStylistConversation>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 100 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

stylistConversationSchema.index({ owner: 1, lastMessageAt: -1 });

export const StylistConversation = model<IStylistConversation>('StylistConversation', stylistConversationSchema);
