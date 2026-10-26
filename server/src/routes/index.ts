import { Router } from 'express';
import authRoutes from './auth.routes.js';
import itemRoutes from './item.routes.js';
import outfitRoutes from './outfit.routes.js';
import suggestionRoutes from './suggestion.routes.js';
import scheduleRoutes from './schedule.routes.js';
// ===== NEW: Body Profile =====
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import { categoryConfig } from '../controllers/admin.controller.js';
// ===== END NEW =====

const router = Router();

router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/outfits', outfitRoutes);
router.use('/suggestions', suggestionRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/wishlist', wishlistRoutes);
// ===== NEW: Body Profile =====
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.get('/categories', categoryConfig);
// ===== END NEW =====

export default router;
