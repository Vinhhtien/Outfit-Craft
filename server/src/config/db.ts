import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  // Serverless (Vercel): instance duoc dung lai giua cac request -> giu ket noi cu.
  if (mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log(`[db] Da ket noi MongoDB Atlas: ${mongoose.connection.name}`);
  } catch (err) {
    // Tren Vercel khong co MongoDB local -> bao loi ngay thay vi doi them 4 giay.
    if (!process.env.VERCEL && !env.mongoUri.includes('127.0.0.1') && !env.mongoUri.includes('localhost')) {
      console.warn('[db] Ket noi Atlas khong thanh cong (timeout / IP chua whitelist). Dang thu ket noi MongoDB Local...');
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/outfitcraft', { serverSelectionTimeoutMS: 4000 });
        console.log(`[db] Da ket noi MongoDB Local: ${mongoose.connection.name}`);
      } catch (localErr) {
        console.error('[db] Khong the ket noi ca Atlas lan Local MongoDB.');
        throw err;
      }
    } else {
      throw err;
    }
  }

  mongoose.connection.on('error', (err) => console.error('[db] Loi ket noi:', err));
  mongoose.connection.on('disconnected', () => console.warn('[db] Mat ket noi MongoDB'));
}
