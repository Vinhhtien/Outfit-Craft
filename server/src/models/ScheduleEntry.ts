import { Schema, model, Document, Types } from 'mongoose';

/**
 * Gan mot outfit vao mot ngay cu the (tinh nang Lich trinh & OOTD).
 */
export interface IScheduleEntry extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  outfit: Types.ObjectId;
  /** Chuan hoa ve 00:00 UTC de moi ngay chi co 1 ban ghi/user. */
  date: Date;
  note?: string;
  /** Danh dau da thuc su mac -> tang wearCount cho cac item. */
  isWorn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleEntrySchema = new Schema<IScheduleEntry>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outfit: { type: Schema.Types.ObjectId, ref: 'Outfit', required: true },
    date: { type: Date, required: true },
    note: { type: String, maxlength: 300 },
    isWorn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Moi user chi co 1 outfit cho 1 ngay.
scheduleEntrySchema.index({ owner: 1, date: 1 }, { unique: true });

export const ScheduleEntry = model<IScheduleEntry>('ScheduleEntry', scheduleEntrySchema);
