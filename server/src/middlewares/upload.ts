import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Vercel chan moi request > 4.5MB truoc khi toi app -> moi anh toi da 4MB khi chay tren Vercel. */
export const MAX_UPLOAD_MB = process.env.VERCEL ? 4 : 10;

/**
 * Giu file trong RAM roi stream thang len Cloudinary,
 * khong ghi tam ra disk (tranh rac file tren server).
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 2, fields: 12, fieldSize: 64 * 1024, parts: 14 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'));
    }
    cb(null, true);
  },
});
