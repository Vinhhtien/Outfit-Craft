import app from './app.js';
import { retryImageCleanup } from './services/upload.service.js';
import { env } from './config/env.js';
import { ensureReady } from './bootstrap.js';

/** Server chay lien tuc (local / VPS). Tren Vercel dung src/vercel.ts thay cho file nay. */
async function bootstrap() {
  try {
    await ensureReady();
    void retryImageCleanup();
    setInterval(() => void retryImageCleanup(), 60000).unref();
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
