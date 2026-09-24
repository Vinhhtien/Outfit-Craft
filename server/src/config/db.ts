import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log(`[db] Da ket noi MongoDB: ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => console.error('[db] Loi ket noi:', err));
  mongoose.connection.on('disconnected', () => console.warn('[db] Mat ket noi MongoDB'));
}
