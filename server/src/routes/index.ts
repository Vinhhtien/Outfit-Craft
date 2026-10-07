import { Router } from 'express';
import authRoutes from './auth.routes.js';
import itemRoutes from './item.routes.js';
import outfitRoutes from './outfit.routes.js';
import suggestionRoutes from './suggestion.routes.js';
import scheduleRoutes from './schedule.routes.js';
// ===== NEW: Body Profile =====
import userRoutes from './user.routes.js';
// ===== END NEW =====

const router = Router();

router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/outfits', outfitRoutes);
router.use('/suggestions', suggestionRoutes);
router.use('/schedule', scheduleRoutes);
// ===== NEW: Body Profile =====
router.use('/users', userRoutes);
// ===== END NEW =====

export default router;
