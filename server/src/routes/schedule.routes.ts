import { Router } from 'express';
import * as c from '../controllers/schedule.controller.js';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';

const router = Router();
router.use(protect);

router.get('/', c.getSchedule);
router.post('/', validate(c.scheduleSchema), c.setSchedule);
router.patch('/:id/worn', c.markScheduleWorn);
router.delete('/:id', c.deleteSchedule);

export default router;
