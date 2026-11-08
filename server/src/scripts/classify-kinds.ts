/**
 * Nhan dien loai chi tiet (ao len, ao phong...) cho moi mon chua co, bang AI nhin anh.
 * Chay: npm run classify:kinds
 * Khong bat buoc: chat voi stylist cung tu bo sung dan. Script nay chi giup lam 1 lan cho xong.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { KIND_BATCH_SIZE, ensureItemKinds } from '../services/itemKind.service.js';

/** Nghi giua cac lan goi de khong vuot gioi han so request/phut cua Gemini. */
const PAUSE_MS = 5_000;

async function main() {
  if (!env.geminiKey) throw new Error('Chua cau hinh GEMINI_API_KEY.');
  await mongoose.connect(env.mongoUri);
  const items = await ClothingItem.find({ kind: { $exists: false } });
  console.log(`Co ${items.length} mon chua co loai.`);

  for (let i = 0; i < items.length; i += KIND_BATCH_SIZE) {
    const batch = items.slice(i, i + KIND_BATCH_SIZE);
    await ensureItemKinds(batch);
    for (const item of batch) console.log(`  ${item.name}: ${item.kind ?? '(chua nhan dien duoc)'}`);
    if (i + KIND_BATCH_SIZE < items.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
