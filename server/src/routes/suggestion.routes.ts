import { Router } from 'express';
import * as c from '../controllers/suggestion.controller.js';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

/** Moi tin nhan toi da 2 lan goi Gemini -> gioi han theo tung user de khong het quota. */
const stylistChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn hỏi stylist hơi nhiều rồi. Vui lòng thử lại sau ít phút.' },
});

const router = Router();
router.use(protect);

router.get('/weather', c.getWeatherInfo);
router.get('/ranked', c.getRankedItems);
router.post('/chat', stylistChatLimiter, validate(c.stylistChatSchema), c.chatWithStylist);
router.get('/chats', c.listStylistChats);
router.get('/chats/:id', c.getStylistChat);
router.delete('/chats/:id', c.deleteStylistChat);
router.get('/', c.getSuggestion);

export default router;
