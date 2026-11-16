/**
 * Nhan dien loai chi tiet (ao len, ao phong...), do nam / nu va dac diem tu anh (do trang trong, do the thao,
 * hoa tiet, rach) cho moi mon chua co, bang AI nhin anh.
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
  // Mon cu co loai "other" ma chua biet anh la gi: thuong la mon xep nham nhom (truoc day AI thay
  // quan short trong nhom Ao thi luu "other"). Xoa loai de nhan dien lai va ghi detectedKind.
  const relabel = await ClothingItem.updateMany(
    { kind: 'other', detectedKind: { $exists: false } },
    { $unset: { kind: 1 } }
  );
  if (relabel.modifiedCount > 0) console.log(`Nhan dien lai ${relabel.modifiedCount} mon dang de loai "other".`);
  // Loai "sandals" cu gop ca dep le, dep suc; nay da tach rieng "slippers" nen nhan dien lai cac doi cu.
  const sandals = await ClothingItem.updateMany(
    { category: 'shoes', kind: 'sandals', detectedKind: { $exists: false } },
    { $unset: { kind: 1 } }
  );
  if (sandals.modifiedCount > 0) console.log(`Nhan dien lai ${sandals.modifiedCount} doi dang de loai "sandals".`);
  // Thieu loai, hoac mon chinh / giay chua biet do nam nu / chua phan tich dac diem tu anh.
  const items = await ClothingItem.find({
    $or: [
      { kind: { $exists: false } },
      { category: { $nin: ['bag', 'accessory'] }, $or: [{ gender: { $exists: false } }, { visual: { $exists: false } }] },
    ],
  });
  console.log(`Co ${items.length} mon can nhan dien (loai, do nam / nu, dac diem tu anh).`);

  for (let i = 0; i < items.length; i += KIND_BATCH_SIZE) {
    const batch = items.slice(i, i + KIND_BATCH_SIZE);
    await ensureItemKinds(batch);
    for (const item of batch) {
      const seen = item.detectedKind && item.detectedKind !== item.kind ? ` (anh trong giong: ${item.detectedKind})` : '';
      console.log(`  ${item.name}: ${item.kind ?? '(chua nhan dien duoc)'}${seen}, ${item.gender ?? '(chua ro nam / nu)'}, trang trong ${item.visual?.formality ?? '?'}${item.visual?.sportswear ? ', do the thao' : ''}${item.visual?.distressed ? ', rach' : ''}`);
    }
    if (i + KIND_BATCH_SIZE < items.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
