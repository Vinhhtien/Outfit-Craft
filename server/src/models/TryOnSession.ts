import { Schema, model, Document, Types } from 'mongoose';

export type TryOnEndReason = 'user' | 'limit' | 'abandoned' | 'replaced';

/** 1 phien thu do truc tiep. Tong usedSeconds trong ngay la thoi luong user da dung. */
export interface ITryOnSession extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  /** Ngay tinh han muc (gio Viet Nam), dang YYYY-MM-DD. */
  dayKey: string;
  status: 'active' | 'ended';
  /** Tran cua phien nay: min(gioi han moi phien, so giay con lai trong ngay luc mo phien). */
  maxSeconds: number;
  usedSeconds: number;
  /** Luc video da ghep do bat dau chay. Truoc moc nay user khong bi tinh gio. */
  activatedAt?: Date;
  lastSeenAt: Date;
  tokenIssuedAt?: Date;
  endedAt?: Date;
  endReason?: TryOnEndReason;
}

const tryOnSessionSchema = new Schema<ITryOnSession>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dayKey: { type: String, required: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    maxSeconds: { type: Number, required: true },
    usedSeconds: { type: Number, default: 0 },
    activatedAt: { type: Date },
    lastSeenAt: { type: Date, required: true },
    tokenIssuedAt: { type: Date },
    endedAt: { type: Date },
    endReason: { type: String, enum: ['user', 'limit', 'abandoned', 'replaced'] },
  },
  { timestamps: true }
);

tryOnSessionSchema.index({ owner: 1, dayKey: 1 });
// Moi user chi 1 phien dang chay, nen 2 request dong thoi khong the cung vuot han muc.
tryOnSessionSchema.index({ owner: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export const TryOnSession = model<ITryOnSession>('TryOnSession', tryOnSessionSchema);
