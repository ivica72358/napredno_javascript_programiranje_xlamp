// sve rute API-ja pod /api

import { Router } from 'express';
import env from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';
import { isConnected } from '../services/mqtt.js';
import authRoutes from './auth.routes.js';
import lampRoutes from './lamps.routes.js';
import uplinkRoutes from './uplinks.routes.js';
import downlinkRoutes from './downlinks.routes.js';
import userRoutes from './users.routes.js';

const router = Router();

// javno i namjerno bez podataka o okolini osim ova dva prekidaca: smoke test
// po `dryRun` provjerava smije li uopce slati naredbe, a sucelje po `mqtt`
router.get('/health', (_req, res) =>
  res.json({ status: 'ok', mqtt: isConnected(), dryRun: env.DOWNLINK_DRY_RUN }),
);

router.use('/auth', authRoutes);

router.use(requireAuth);

router.use('/lamps', lampRoutes);
router.use('/uplinks', uplinkRoutes);
router.use('/downlinks', downlinkRoutes);
router.use('/users', userRoutes);

export default router;
