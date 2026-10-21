import { Router } from 'express';
import { protect, requireAdmin } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as c from '../controllers/admin.controller.js';

const router = Router();
router.use(protect, requireAdmin);
router.get('/dashboard', c.dashboard);
router.get('/users', c.users);
router.get('/users/:id', c.userDetail);
router.patch('/users/:id/status', validate(c.userStatusSchema), c.setUserStatus);
router.get('/categories', c.categories);
router.patch('/categories/:code', validate(c.categorySchema), c.updateCategory);
router.get('/outfits', c.publicOutfits);
router.patch('/outfits/:id/visibility', validate(c.visibilitySchema), c.setOutfitVisibility);
router.get('/logs', c.logs);
export default router;
