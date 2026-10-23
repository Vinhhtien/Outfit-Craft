import { Router } from 'express';
import { protect } from '../middlewares/auth.js';
import * as c from '../controllers/travel.controller.js';

const router = Router();

router.use(protect);

router.get('/suggestions', c.getPackingSuggestions);
router.get('/', c.getTrips);
router.post('/', c.createTrip);
router.get('/:id', c.getTripById);
router.patch('/:id', c.updateTrip);
router.delete('/:id', c.deleteTrip);

router.post('/:id/items', c.addTravelItem);
router.patch('/:id/items/:itemId', c.updateTravelItem);
router.delete('/:id/items/:itemId', c.removeTravelItem);
router.post('/:id/batch-add', c.batchAddItems);

export default router;
