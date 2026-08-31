// ulazna tocka poslužitelja

import express from 'express';
import cors from 'cors';
import env from './lib/env.js';
import prisma from './lib/prisma.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { startMqtt, stopMqtt } from './services/mqtt.js';
import { startRealtime } from './services/realtime.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);

// redoslijed je bitan: 404 pa error handler, oba iza svih ruta
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`API sluša na http://localhost:${env.PORT}/api`);
});

const io = startRealtime(server);
startMqtt();

/// uredno gasenje: prekini prihvat novih zahtjeva, odspoji se s brokera pa
/// zatvori pool prema bazi
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} — gasim poslužitelj.`);

  await stopMqtt();
  io.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
