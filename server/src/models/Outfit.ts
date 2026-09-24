import { Schema, model, Document, Types } from 'mongoose';
import { SEASONS, OCCASIONS, Season, Occasion } from '../types/index.js';

/**
 * Vi tri / bien doi cua 1 item tren canvas.
 * Tach rieng khoi canvasJSON de co the query "outfit nao chua item X"
 * va de render lai preview nhe ma khong can Fabric.
 */
export interface IOutfitItem {
  item: Types.ObjectId;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  zIndex: number;
  flipX?: boolean;
}

export interface IOutfit extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  items: IOutfitItem[];
  /**
   * Snapshot day du tu canvas.toJSON() cua Fabric.
   * Mixed vi cau truc do Fabric quyet dinh - khong rang buoc schema.
   */
  canvasJSON: Record<string, unknown>;
  /** Anh PNG export tu canvas, dung lam thumbnail trong danh sach/lich. */
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  seasons: Season[];
  occasions: Occasion[];
  tags: string[];
  isPublic: boolean;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const outfitItemSchema = new Schema<IOutfitItem>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'ClothingItem', required: true },
    left: { type: Number, required: true },
    top: { type: Number, required: true },
    scaleX: { type: Number, default: 1 },
    scaleY: { type: Number, default: 1 },
    angle: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    flipX: { type: Boolean, default: false },
  },
  { _id: false }
);

const outfitSchema = new Schema<IOutfit>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    items: {
      type: [outfitItemSchema],
      validate: {
        validator: (arr: IOutfitItem[]) => arr.length > 0,
        message: 'Outfit phai co it nhat 1 mon do',
      },
    },
    canvasJSON: { type: Schema.Types.Mixed, default: {} },
    thumbnailUrl: { type: String },
    thumbnailPublicId: { type: String },
    seasons: { type: [String], enum: SEASONS, default: [] },
    occasions: { type: [String], enum: OCCASIONS, default: [] },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

outfitSchema.index({ owner: 1, createdAt: -1 });
// Feed OOTD cong khai.
outfitSchema.index({ isPublic: 1, createdAt: -1 });
// Tim outfit dang dung 1 item cu the (vd truoc khi xoa item).
outfitSchema.index({ 'items.item': 1 });

export const Outfit = model<IOutfit>('Outfit', outfitSchema);
