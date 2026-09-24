import { Router } from 'express';
import * as c from '../controllers/suggestion.controller.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
router.use(protect);

router.get('/weather', c.getWeatherInfo);
router.get('/ranked', c.getRankedItems);
router.get('/', c.getSuggestion);

export default router;
