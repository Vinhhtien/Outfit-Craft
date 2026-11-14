/**
 * Ham serverless cho Vercel (goi tu api/index.js). Moi request: dam bao da chuan bi xong
 * (chi lan dau cua moi instance), roi giao cho Express app nhu khi chay local.
 * Viec don anh Cloudinary dinh ky chay bang Vercel Cron (xem vercel.json, routes/cron.routes.ts).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import app from './app.js';
import { ensureReady } from './bootstrap.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await ensureReady();
  } catch (err) {
    console.error('[vercel] Khong chuan bi duoc server:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, message: 'Máy chủ đang khởi động hoặc mất kết nối cơ sở dữ liệu. Vui lòng thử lại sau ít phút.' }));
    return;
  }
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
