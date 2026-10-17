import app from './app.js';
import { ClothingItem } from './models/ClothingItem.js';
import { Outfit } from './models/Outfit.js';
import { ImageCleanup } from './models/ImageCleanup.js';
import { retryImageCleanup } from './services/upload.service.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
// ===== NEW: Category =====
import { seedDefaultCategories } from './models/Category.js';
// ===== END NEW =====

async function bootstrap() {
  try {
    await connectDB();
    await Promise.all([ClothingItem.init(), Outfit.init(), ImageCleanup.init()]);
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
