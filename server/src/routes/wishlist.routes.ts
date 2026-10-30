import { Router } from 'express';
import * as c from '../controllers/wishlist.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
router.use(protect); // Toan bo route wishlist deu can dang nhap

router.get('/', c.getWishlist);
router.post('/check-duplicates', validate(c.checkDuplicateSchema), c.checkDuplicates);
router.post('/', validate(c.createWishlistSchema), c.createWishlistItem);
router.patch('/:id', validate(c.updateWishlistSchema), c.updateWishlistItem);
router.delete('/:id', c.deleteWishlistItem);
router.post('/:id/move-to-wardrobe', c.moveToWardrobe);

export default router;
