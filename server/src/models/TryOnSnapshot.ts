import { Schema, model, Document, Types } from 'mongoose';

/** Anh user chup lai trong luc thu do truc tiep. */
export interface ITryOnSnapshot extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  /** Giu ten mon luc chup: mon do bi xoa sau do thi lich su van doc duoc. */
  item?: Types.ObjectId;
  itemName?: string;
  imageUrl: string;
  imagePublicId: string;
  createdAt: Date;
}

const tryOnSnapshotSchema = new Schema<ITryOnSnapshot>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    item: { type: Schema.Types.ObjectId, ref: 'ClothingItem' },
    itemName: { type: String },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

tryOnSnapshotSchema.index({ owner: 1, createdAt: -1 });

export const TryOnSnapshot = model<ITryOnSnapshot>('TryOnSnapshot', tryOnSnapshotSchema);
