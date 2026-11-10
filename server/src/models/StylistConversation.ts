import { Schema, model, Document, Types } from 'mongoose';
import { COLOR_GROUPS, ColorGroup, OCCASIONS, Occasion, SEASONS, STYLES, Season, Style } from '../types/index.js';

/** Yeu cau dang ap dung trong doan chat; luot sau chi ghi de phan user noi moi. */
export interface IStylistRequest {
  occasion?: Occasion;
  seasons: Season[];
  colorGroups: ColorGroup[];
  styles: Style[];
  /** Mon user muon mac (vd moi ao len). */
  includeItems: Types.ObjectId[];
  /** Nhiet do user muon mac (vd "mua dong 18 do"), thay cho thoi tiet thuc te khi chon do. */
  temperature?: number;
}

/** Moi tai khoan giu toi da chung nay doan chat gan nhat. */
export const MAX_STYLIST_CONVERSATIONS = 50;

export interface IStylistConversation extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  /** Lay tu tin nhan dau tien, khong ton them lan goi AI. */
  title: string;
  lastMessageAt: Date;
  /** Mon user da che trong doan chat nay, khong goi y lai cho den khi user muon mac lai. */
  excludedItems: Types.ObjectId[];
  lastRequest?: IStylistRequest | null;
  createdAt: Date;
  updatedAt: Date;
}

const stylistConversationSchema = new Schema<IStylistConversation>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 100 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    excludedItems: [{ type: Schema.Types.ObjectId, ref: 'ClothingItem' }],
    lastRequest: {
      type: new Schema<IStylistRequest>(
        {
          occasion: { type: String, enum: OCCASIONS },
          seasons: { type: [String], enum: SEASONS, default: [] },
          colorGroups: { type: [String], enum: COLOR_GROUPS, default: [] },
          styles: { type: [String], enum: STYLES, default: [] },
          includeItems: [{ type: Schema.Types.ObjectId, ref: 'ClothingItem' }],
          temperature: { type: Number, min: -30, max: 50 },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

stylistConversationSchema.index({ owner: 1, lastMessageAt: -1 });

export const StylistConversation = model<IStylistConversation>('StylistConversation', stylistConversationSchema);
