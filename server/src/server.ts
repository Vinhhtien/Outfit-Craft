import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
// ===== NEW: Category =====
import { seedDefaultCategories } from './models/Category.js';
// ===== END NEW =====

async function bootstrap() {
  try {
    await connectDB();
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
