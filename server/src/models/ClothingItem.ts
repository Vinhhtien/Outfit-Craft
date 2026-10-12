import { Schema, model, Document, Types } from 'mongoose';
import {
  CATEGORIES, STYLES, SEASONS, OCCASIONS,
  Category, Style, Season, Occasion,
} from '../types/index.js';

// ===== NEW: Ghi nho fit =====
/**
 * Vi tri + co user da can tren nguoi mau (lan dau thu do). Luu dang ti le theo co the
 * (xem client/src/lib/outfitPlacement.ts - fitFromBox) nen dung lai duoc cho moi so do.
 */
export interface IItemFit {
  /** Danh muc luc can - doi danh muc thi bo qua fit cu. */
  category: Category;
  anchorRef: string;
  /** Do lech diem tham chieu so voi anchor / be rong, chieu cao chuan cua nhom do. */
  offsetX: number;
  offsetY: number;
  /** Be rong, chieu cao mon do / be rong, chieu cao chuan cua nhom do. */
  width: number;
  height: number;
}
// ===== END NEW =====

export interface IClothingItem extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  category: Category;
  /** Anh goc user upload - giu lai de co the tach nen lai neu ket qua xau. */
  originalImageUrl: string;
  /** PNG da tach nen - day moi la anh dung tren canvas. */
  imageUrl: string;
  /** public_id cua Cloudinary, can de xoa file khi delete item. */
  imagePublicId?: string;
  /**
   * Mau chu dao, hex. Phan tu [0] la mau chinh.
   * Dung cho filter theo mau va thuat toan phoi mau o buoc Suggest.
   */
  colors: string[];
  styles: Style[];
  seasons: Season[];
  occasions: Occasion[];
  /** Dai nhiet do phu hop (C). Vd ao phong: 22-40, ao phao: -5..15 */
  tempRange: { min: number; max: number };
  brand?: string;
  notes?: string;
  /** Dem so lan item duoc dung trong outfit -> thong ke "do it mac nhat". */
  wearCount: number;
  lastWornAt?: Date;
  isArchived: boolean;
  fit?: IItemFit | null; // NEW: Ghi nho fit
  createdAt: Date;
  updatedAt: Date;
}

const clothingItemSchema = new Schema<IClothingItem>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: CATEGORIES, required: true },
    originalImageUrl: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String },
    colors: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)),
        message: 'colors phai la ma hex dang #rrggbb',
      },
    },
    styles: { type: [String], enum: STYLES, default: [] },
    seasons: { type: [String], enum: SEASONS, default: [] },
    occasions: { type: [String], enum: OCCASIONS, default: [] },
    tempRange: {
      min: { type: Number, default: 15 },
      max: { type: Number, default: 35 },
    },
    brand: { type: String, trim: true },
    notes: { type: String, maxlength: 500 },
    wearCount: { type: Number, default: 0 },
    lastWornAt: { type: Date },
    isArchived: { type: Boolean, default: false },
    // ===== NEW: Ghi nho fit =====
    fit: {
      type: new Schema<IItemFit>(
        {
          category: { type: String, enum: CATEGORIES, required: true },
          anchorRef: { type: String, required: true },
          offsetX: { type: Number, required: true },
          offsetY: { type: Number, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    // ===== END NEW =====
  },
  { timestamps: true }
);

// Truy van chinh cua man Wardrobe: loc theo chu so huu + danh muc.
clothingItemSchema.index({ owner: 1, category: 1, isArchived: 1 });
// Ho tro o tim kiem theo ten/brand.
clothingItemSchema.index({ name: 'text', brand: 'text' });

// ===== NEW: Category =====
/** Quan he N-1 toi Category qua code. Chi co du lieu khi goi .populate('categoryInfo'). */
clothingItemSchema.virtual('categoryInfo', {
  ref: 'Category',
  localField: 'category',
  foreignField: 'code',
  justOne: true,
});
// ===== END NEW =====

export const ClothingItem = model<IClothingItem>('ClothingItem', clothingItemSchema);
