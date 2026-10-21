import { Schema, model, Document, Types } from 'mongoose';
import { CATEGORIES, CATEGORY_Z_INDEX, Category as CategoryCode } from '../types/index.js';

/**
 * Danh muc mon do (ao, quan, giay...) - admin quan ly.
 * ClothingItem.category luu `code` (khoa tu nhien, unique) thay vi ObjectId
 * de bo loc, thuat toan goi y va client hien tai van chay nhu cu.
 */
export interface ICategory extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  /** Thu tu lop tren canvas: so lon = nam tren. */
  layerOrder: number;
  /** Khoang nhiet do goi y khi them mon do moi thuoc danh muc nay. */
  defaultTempMin: number;
  defaultTempMax: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    layerOrder: { type: Number, default: 0 },
    defaultTempMin: { type: Number, default: 15 },
    defaultTempMax: { type: Number, default: 35 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Category = model<ICategory>('Category', categorySchema);

/** Du lieu goc - khop voi CATEGORY_LABELS / DEFAULT_TEMP dang dung o client. */
const DEFAULTS: Record<CategoryCode, { name: string; min: number; max: number }> = {
  top: { name: 'Áo', min: 18, max: 35 },
  bottom: { name: 'Quần / Chân váy', min: 15, max: 35 },
  outerwear: { name: 'Áo khoác', min: -5, max: 20 },
  dress: { name: 'Váy liền', min: 20, max: 38 },
  shoes: { name: 'Giày', min: 0, max: 40 },
  bag: { name: 'Túi', min: 0, max: 40 },
  accessory: { name: 'Phụ kiện', min: 0, max: 40 },
};

/**
 * Nap 7 danh muc mac dinh neu chua co.
 * $setOnInsert -> chay lai moi lan khoi dong khong tao trung va khong ghi de ban admin da sua.
 */
export async function seedDefaultCategories(): Promise<void> {
  await Category.bulkWrite(
    CATEGORIES.map((code) => ({
      updateOne: {
        filter: { code },
        update: {
          $setOnInsert: {
            code,
            name: DEFAULTS[code].name,
            layerOrder: CATEGORY_Z_INDEX[code],
            defaultTempMin: DEFAULTS[code].min,
            defaultTempMax: DEFAULTS[code].max,
          },
        },
        upsert: true,
      },
    }))
  );
}
