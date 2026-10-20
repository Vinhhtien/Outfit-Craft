// ===== NEW: Body Profile =====
import { Router } from 'express';
import * as c from '../controllers/bodyProfile.controller.js';
import * as userController from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
router.use(protect);

router.get('/me/body-profile', c.getBodyProfile);
router.put('/me/body-profile', validate(c.bodyProfileSchema), c.updateBodyProfile);
router.delete('/me/body-profile', c.deleteBodyProfile);

// Public user profile (dat sau cac route '/me/...')
router.get('/:id', userController.getUserPublicProfile);

export default router;
// ===== END NEW =====
