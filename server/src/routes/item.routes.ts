import { Router } from 'express';
import * as c from '../controllers/item.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import rateLimit from 'express-rate-limit';

/** Moi anh 1 lan goi Gemini -> gioi han theo tung user de khong het quota. */
const autoTagLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn thêm đồ hơi nhanh, hãy chọn phong cách, mùa, dịp thủ công nhé.' },
});

const router = Router();
router.use(protect); // toan bo route tu do do deu can dang nhap

router.post('/with-images', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'original', maxCount: 1 }]), c.createItemWithImages);
router.post('/upload', upload.single('image'), c.uploadImage);
router.post('/auto-tag', autoTagLimiter, upload.single('image'), c.autoTagItem);
router.get('/stats', c.getStats);           // dat truoc '/:id' de khong bi nuot
router.get('/declutter', c.getDeclutterSuggestions);
router.get('/', c.getItems);
router.post('/', validate(c.createItemSchema), c.createItem);
router.get('/:id', c.getItem);
router.patch('/:id', validate(c.updateItemSchema), c.updateItem);
router.put('/:id/fit', validate(c.saveFitSchema), c.saveFit); // NEW: Ghi nho fit
router.post('/:id/wear', c.markItemWorn);
router.post('/:id/archive', c.archiveItem);
router.delete('/:id', c.deleteItem);

export default router;
