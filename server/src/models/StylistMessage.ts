import { Schema, model, Document, Types } from 'mongoose';
import { OCCASIONS, Occasion } from '../types/index.js';

export const STYLIST_ROLES = ['user', 'stylist'] as const;
export type StylistRole = (typeof STYLIST_ROLES)[number];

/** Moi doan chat giu toi da chung nay tin gan nhat. */
export const MAX_STYLIST_MESSAGES = 100;

export interface IStylistMessage extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  conversation: Types.ObjectId;
  role: StylistRole;
  text: string;
  /** Cac mon cua bo do trong tin tra loi. Mon da xoa se tu mat khi populate. */
  items: Types.ObjectId[];
  /** key cua bo do, de "doi bo khac" khong lap lai. */
  outfitKey?: string;
  occasion?: Occasion;
  /** Thoi tiet luc tra loi, dung khi luu bo do tu lich su chat. */
  weather?: Record<string, unknown>;
  notes: string[];
  source?: 'ai' | 'rule';
  createdAt: Date;
  updatedAt: Date;
}

const stylistMessageSchema = new Schema<IStylistMessage>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'StylistConversation', required: true },
    role: { type: String, enum: STYLIST_ROLES, required: true },
    text: { type: String, required: true, maxlength: 5000 },
    items: [{ type: Schema.Types.ObjectId, ref: 'ClothingItem' }],
    outfitKey: { type: String },
    occasion: { type: String, enum: OCCASIONS },
    weather: { type: Schema.Types.Mixed },
    notes: { type: [String], default: [] },
    source: { type: String, enum: ['ai', 'rule'] },
  },
  { timestamps: true }
);

stylistMessageSchema.index({ conversation: 1, _id: -1 });

export const StylistMessage = model<IStylistMessage>('StylistMessage', stylistMessageSchema);
