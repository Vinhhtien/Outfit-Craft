import app from './app.js';
import { ClothingItem } from './models/ClothingItem.js';
import { Outfit } from './models/Outfit.js';
import { ImageCleanup } from './models/ImageCleanup.js';
import { retryImageCleanup } from './services/upload.service.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { seedDemoAdmin, DEMO_ADMIN_EMAIL } from './services/demoAdmin.service.js';
// ===== NEW: Category =====
import { seedDefaultCategories } from './models/Category.js';
// ===== END NEW =====

async function bootstrap() {
  try {
    await connectDB();
    await Promise.all([ClothingItem.init(), Outfit.init(), ImageCleanup.init(), User.init()]);
    const demo = await seedDemoAdmin();
    if (demo.status === 'created') console.log(`[admin] Da tao tai khoan demo: ${DEMO_ADMIN_EMAIL}`);
    if (demo.status === 'exists' && demo.usable === false) console.warn('[admin] Email demo da ton tai nhung khong phai admin kha dung. Giu nguyen tai khoan hien co.');
    void retryImageCleanup();
    setInterval(() => void retryImageCleanup(), 60000).unref();
    // ===== NEW: Category =====
    // Loi nap danh muc khong duoc chan server: ClothingItem van validate bang enum CATEGORIES.
    await seedDefaultCategories().catch((err) =>
      console.warn('[db] Khong nap duoc danh muc mac dinh:', err)
    );
    // ===== END NEW =====
    app.listen(env.port, () =>
      console.log(`[server] http://localhost:${env.port} (${env.nodeEnv})`)
    );
  } catch (err) {
    console.error('[server] Khong khoi dong duoc:', err);
    process.exit(1);
  }
}

bootstrap();

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});
