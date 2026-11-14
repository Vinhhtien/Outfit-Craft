/**
 * Cac buoc chuan bi truoc khi nhan request: ket noi DB, dong bo index, tao du lieu mac dinh.
 * Dung chung cho server chay lien tuc (server.ts) va ham serverless tren Vercel (vercel.ts).
 * Tren Vercel moi instance chi chay 1 lan; loi thi lan request sau thu lai.
 */
import { ClothingItem } from './models/ClothingItem.js';
import { Outfit } from './models/Outfit.js';
import { ImageCleanup } from './models/ImageCleanup.js';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Like } from './models/Like.js';
import { seedDemoAdmin, DEMO_ADMIN_EMAIL } from './services/demoAdmin.service.js';
import { seedDefaultCategories } from './models/Category.js';

async function prepare(): Promise<void> {
  await connectDB();
  await Like.collection.dropIndex('user_1_outfit_1').catch(() => {});
  await Like.collection.dropIndex('user_1_post_1').catch(() => {});
  await Promise.all([ClothingItem.init(), Outfit.init(), ImageCleanup.init(), User.init(), Like.init()]);
  const demo = await seedDemoAdmin();
  if (demo.status === 'created') console.log(`[admin] Da tao tai khoan demo: ${DEMO_ADMIN_EMAIL}`);
  if (demo.status === 'exists' && demo.usable === false) console.warn('[admin] Email demo da ton tai nhung khong phai admin kha dung. Giu nguyen tai khoan hien co.');
  // Loi nap danh muc khong duoc chan server: ClothingItem van validate bang enum CATEGORIES.
  await seedDefaultCategories().catch((err) =>
    console.warn('[db] Khong nap duoc danh muc mac dinh:', err)
  );
}

let ready: Promise<void> | null = null;

/** Goi bao nhieu lan cung chi chuan bi 1 lan; that bai thi xoa cache de lan sau thu lai. */
export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = prepare().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
