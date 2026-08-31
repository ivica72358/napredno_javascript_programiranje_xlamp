// ucitavanje i provjera konfiguracije

import 'dotenv/config';
import { z } from 'zod';

const shema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL je obavezan'),

  // 32 znaka je minimum da potpis ima smisla; .env.example generira 64 hex znaka
  JWT_SECRET: z.string().min(32, 'JWT_SECRET mora imati barem 32 znaka'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  MQTT_BROKER_URL: z.string().optional(),
  MQTT_APPLICATION_ID: z.string().optional(),
  MQTT_CLIENT_ID: z.string().default('xlamp-ng'),

  ALLOWED_DEVEUIS: z.string().default(''),

  // naredbe se zapisuju u bazu, ali se NE objavljuju na broker
  DOWNLINK_DRY_RUN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  OFFLINE_AFTER_MINUTES: z.coerce.number().int().positive().default(180),
});

const rezultat = shema.safeParse(process.env);

if (!rezultat.success) {
  console.error('Neispravna konfiguracija u .env:');
  for (const greska of rezultat.error.issues) {
    console.error(`  ${greska.path.join('.')}: ${greska.message}`);
  }
  process.exit(1);
}

const env = rezultat.data;

// `--dry-run` u naredbenom retku ima prednost pred .env
if (process.argv.includes('--dry-run')) {
  env.DOWNLINK_DRY_RUN = true;
}

if (env.DOWNLINK_DRY_RUN) {
  console.warn('[env] DRY RUN — naredbe se zapisuju, ali se NE salju na broker.');
}

/// uredaji kojima se smije poslati naredba
export const allowedDevEuis = new Set(
  env.ALLOWED_DEVEUIS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export const mqttConfigured = Boolean(env.MQTT_BROKER_URL && env.MQTT_APPLICATION_ID);

export default env;
