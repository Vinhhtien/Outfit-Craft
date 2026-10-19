import { Router } from 'express';
import * as c from '../controllers/outfit.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
router.use(protect);

router.get('/feed', c.getPublicFeed);       // dat truoc '/:id'
router.get('/', c.getOutfits);
router.post('/', validate(c.createOutfitSchema), c.createOutfit);
router.get('/:id', c.getOutfit);
router.patch('/:id', validate(c.updateOutfitSchema), c.updateOutfit);
router.delete('/:id', c.deleteOutfit);
router.post('/:id/wear', c.markAsWorn);
router.post('/:id/like', c.toggleLikeOutfit);

export default router;
