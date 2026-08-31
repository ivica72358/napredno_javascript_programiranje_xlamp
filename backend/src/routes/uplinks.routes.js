import { Router } from 'express';
import { getOne, list, remove } from '../controllers/uplinks.controller.js';

const router = Router();

// nema POST ni PUT: uplinkovi nastaju iz MQTT-a, ne kroz sucelje
router.get('/', list);
router.get('/:id', getOne);
router.delete('/:id', remove);

export default router;
