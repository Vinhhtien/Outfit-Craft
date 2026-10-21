import { Schema, model } from 'mongoose';

const schema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  action: { type: String, enum: ['lock_user', 'unlock_user', 'edit_category', 'hide_outfit', 'show_outfit'], required: true },
  targetId: { type: String, required: true },
  targetName: { type: String, required: true },
  reason: { type: String, default: '' },
  changes: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
}, { timestamps: true });
schema.index({ createdAt: -1 });
export const AdminLog = model('AdminLog', schema);
