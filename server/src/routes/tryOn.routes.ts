import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/tryOn.controller.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';

/** Moi route ton tien that (Decart, Gemini, Cloudinary) deu gioi han theo tung user. */
const perUserLimit = (max: number) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.' },
});

const router = Router();
router.use(protect);

router.get('/quota', c.getQuota);
router.post('/sessions', perUserLimit(20), c.startSession);
router.post('/sessions/:id/token', perUserLimit(60), c.createToken);
router.post('/sessions/:id/heartbeat', validate(c.heartbeatSchema), c.heartbeat);
router.post('/sessions/:id/end', c.endSession);
router.post('/items/:id/prompt', perUserLimit(60), upload.single('frame'), c.getItemPrompt);
router.get('/snapshots', c.listSnapshots);
router.post('/snapshots', perUserLimit(30), upload.single('image'), c.createSnapshot);
router.delete('/snapshots/:id', c.deleteSnapshot);

export default router;
