import { Router } from 'express';
import { cancel, create, getOne, list, remove, update } from '../controllers/downlinks.controller.js';

const router = Router();

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
// izmjena i brisanje rade samo dok naredba nije poslana - provjera je u
// kontroleru
router.put('/:id', update);
router.delete('/:id', remove);
// otkazivanje umjesto brisanja kad se zeli sacuvati trag da je naredba
// postojala
router.post('/:id/cancel', cancel);

export default router;
