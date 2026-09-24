import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function bootstrap() {
  try {
    await connectDB();
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
