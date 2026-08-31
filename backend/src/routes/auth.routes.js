import { Router } from 'express';
import { login, me, register } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
// jedina ruta u ovoj skupini koja trazi token - postavlja se pojedinacno jer
// je cijela skupina inace javna
router.get('/me', requireAuth, me);

export default router;
