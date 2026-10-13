import { Router } from 'express';
import * as c from '../controllers/item.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = Router();
router.use(protect); // toan bo route tu do do deu can dang nhap

router.post('/upload', upload.single('image'), c.uploadImage);
router.get('/stats', c.getStats);           // dat truoc '/:id' de khong bi nuot
router.get('/', c.getItems);
router.post('/', validate(c.createItemSchema), c.createItem);
router.get('/:id', c.getItem);
router.patch('/:id', validate(c.updateItemSchema), c.updateItem);
router.put('/:id/fit', validate(c.saveFitSchema), c.saveFit); // NEW: Ghi nho fit
router.delete('/:id', c.deleteItem);

export default router;
