import { Schema, model, Document, Types } from 'mongoose';
import { CATEGORIES, Category } from '../types/index.js';

export const WISHLIST_PRIORITIES = ['low', 'medium', 'high'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export interface IWishlistItem extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  category: Category;
  imageUrl?: string;
  imagePublicId?: string;
  productUrl?: string;
  price?: number;
  colors: string[];
  brand?: string;
  notes?: string;
  priority: WishlistPriority;
  isPurchased: boolean;
  purchasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: CATEGORIES, required: true },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String },
    productUrl: { type: String, trim: true },
    price: { type: Number, min: 0 },
    colors: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)),
        message: 'colors phai la ma hex dang #rrggbb',
      },
    },
    brand: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, maxlength: 500 },
    priority: { type: String, enum: WISHLIST_PRIORITIES, default: 'medium' },
    isPurchased: { type: Boolean, default: false },
    purchasedAt: { type: Date },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ owner: 1, isPurchased: 1, createdAt: -1 });

export const WishlistItem = model<IWishlistItem>('WishlistItem', wishlistItemSchema);
