import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Giu file trong RAM roi stream thang len Cloudinary,
 * khong ghi tam ra disk (tranh rac file tren server).
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 12, fieldSize: 64 * 1024, parts: 14 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'));
    }
    cb(null, true);
  },
});
