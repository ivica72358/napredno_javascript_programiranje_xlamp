import { Router } from 'express';
import { create, getOne, list, remove, update } from '../controllers/users.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, list);
router.post('/', requireAdmin, create);
router.delete('/:id', requireAdmin, remove);

// svoj profil svatko smije procitati i urediti; provjera "ja ili admin" je u
// kontroleru jer ovisi o :id-u
router.get('/:id', getOne);
router.put('/:id', update);

export default router;
