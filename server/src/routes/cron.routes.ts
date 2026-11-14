import { Router } from 'express';
import { retryImageCleanup } from '../services/upload.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Viec dinh ky cho Vercel Cron (local da co setInterval trong server.ts).
 * Vercel tu gui "Authorization: Bearer <CRON_SECRET>"; chua dat CRON_SECRET thi tat han route.
 */
const router = Router();

router.get('/cleanup-images', asyncHandler(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ success: false, message: 'Không có quyền.' });
    return;
  }
  await retryImageCleanup();
  res.json({ success: true, message: 'Đã dọn ảnh chờ xóa.' });
}));

export default router;
