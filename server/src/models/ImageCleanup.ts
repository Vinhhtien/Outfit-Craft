import { Schema, model } from 'mongoose';
// Retain failed deletions across server restarts; never expire unresolved jobs.
const schema = new Schema({
  publicId: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
export const ImageCleanup = model('ImageCleanup', schema);
