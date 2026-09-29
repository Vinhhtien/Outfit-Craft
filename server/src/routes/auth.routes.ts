import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';
// ===== NEW: Forgot Password =====
import rateLimit from 'express-rate-limit';

/** Chan spam email: toi da 5 yeu cau quen mat khau / 15 phut / IP. */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Ban da yeu cau qua nhieu lan, vui long thu lai sau 15 phut' },
});
// ===== END NEW =====
// ===== NEW: Update Profile =====
import { upload } from '../middlewares/upload.js';
// ===== END NEW =====

const router = Router();

router.post('/register', validate(c.registerSchema), c.register);
router.post('/login', validate(c.loginSchema), c.login);
router.get('/me', protect, c.getMe);

// ===== NEW: Forgot / Reset / Change Password =====
router.post('/forgot-password', forgotPasswordLimiter, validate(c.forgotPasswordSchema), c.forgotPassword);
router.put('/reset-password/:token', validate(c.resetPasswordSchema), c.resetPassword);
router.put('/change-password', protect, validate(c.changePasswordSchema), c.changePassword);
// ===== END NEW =====

// ===== NEW: Update Profile =====
// Lay ho so hien tai: dung lai GET /auth/me o tren.
// upload.single() phai chay TRUOC validate() vi multer moi parse multipart ra req.body.
router.put('/profile', protect, upload.single('avatar'), validate(c.updateProfileSchema), c.updateProfile);
// ===== END NEW =====

export default router;
