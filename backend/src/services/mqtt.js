// most prema ChirpStacku

import mqtt from 'mqtt';
import env, { mqttConfigured } from '../lib/env.js';
import prisma from '../lib/prisma.js';
import { base64ToHex, decodeUplink } from '../lib/codec.js';
import bus, { EVENTS } from '../lib/events.js';
import { serializeLamp } from '../lib/lampStatus.js';

let client = null;

const uplinkTopic = () => `application/${env.MQTT_APPLICATION_ID}/device/+/event/+`;
export const downlinkTopic = (devEui) =>
  `application/${env.MQTT_APPLICATION_ID}/device/${devEui}/command/down`;

// 
// ─────────────────────────────────────────────────────────────────────────────

/// ChirpStack salje po jedan rxInfo zapis za svaki gateway koji je cuo uplink
function bestSignal(event) {
  const rxInfo = event.rxInfo;
  if (!Array.isArray(rxInfo) || rxInfo.length === 0) return { rssi: null, snr: null };

  const best = rxInfo.reduce((a, b) => ((b.rssi ?? -9999) > (a.rssi ?? -9999) ? b : a));
  return { rssi: best.rssi ?? null, snr: best.snr ?? null };
}

/// sto dekodirana poruka govori o stanju uredaja
function statusFromDecoded(decoded) {
  if (decoded.type === 'ALARM') return decoded.cleared ? 'ONLINE' : 'ERROR';

  // nedostaje temperatura predspojne naprave
  if (decoded.type === 'STATUS' && decoded.temperature === null) return 'ERROR';

  return 'ONLINE';
}

async function handleUplink(devEui, event) {
  // prazan payload je "sleep" poruka: nema sadrzaja za dekodirati, ali uredaj
  // se javio pa se biljezi kao znak zivota - inace bi ispao offline dok suti
  if (!event.data) {
    await oznaciZivom(devEui);
    return;
  }

  const lamp = await prisma.lamp.findUnique({ where: { devEui } });

  // pretplata hvata CIJELU ChirpStack aplikaciju, u kojoj je i hrpa uredaja
  // koji nisu u ovoj bazi
  if (!lamp) return;

  const payload = base64ToHex(event.data);
  const decoded = decodeUplink(payload);
  const { rssi, snr } = bestSignal(event);

  const uplink = await prisma.uplink.create({
    data: { lampId: lamp.id, payload, port: event.fPort ?? null, rssi, snr },
    // ownerId ide van jer realtime sloj po njemu odlucuje kome smije proslijediti
    include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
  });

  const updated = await prisma.lamp.update({
    where: { id: lamp.id },
    data: {
      lastSeen: uplink.receivedAt,
      status: statusFromDecoded(decoded),
      // svjetlinu nose samo status i boot poruka; energetska i alarmna je ne
      // sadrze, pa se stara vrijednost ne smije pregaziti s undefined
      ...(decoded.brightness !== undefined && { currentBrightness: decoded.brightness }),
    },
  });

  bus.emit(EVENTS.UPLINK, { ...uplink, decoded });
  bus.emit(EVENTS.LAMP_UPDATED, serializeLamp(updated));

  console.log(`[mqtt] uplink ${devEui} ${decoded.type} (${payload.length / 2} B)`);
}

/// osvjezi lastSeen bez spremanja poruke
async function oznaciZivom(devEui) {
  const lamp = await prisma.lamp.findUnique({ where: { devEui } });
  if (!lamp) return;

  const updated = await prisma.lamp.update({
    where: { id: lamp.id },
    data: { lastSeen: new Date() },
  });
  bus.emit(EVENTS.LAMP_UPDATED, serializeLamp(updated));
}

/// join request: uredaj se prijavio na mrezu
async function handleJoin(devEui) {
  await oznaciZivom(devEui);
  console.log(`[mqtt] join ${devEui}`);
}

async function onMessage(topic, buffer) {
  // application/{appId}/device/{devEui}/event/{type}
  const parts = topic.split('/');
  const devEui = (parts[3] || '').toLowerCase();
  const eventType = parts[5];

  if (!devEui) return;

  let event;
  try {
    event = JSON.parse(buffer.toString());
  } catch {
    console.warn(`[mqtt] neispravan JSON na ${topic}`);
    return;
  }

  try {
    if (eventType === 'up') await handleUplink(devEui, event);
    else if (eventType === 'join') await handleJoin(devEui);
    // txack, ack, status, log — ne koristimo ih
  } catch (err) {
    // jedna neispravna poruka ne smije srusiti pretplatu
    console.error(`[mqtt] greska pri obradi ${topic}:`, err.message);
  }
}

// 
// ─────────────────────────────────────────────────────────────────────────────

/// qoS 1 - broker mora potvrditi primitak
const PUBLISH_QOS = 1;

/**
 * Objavljuje naredbu na broker.
 * @returns {Promise<void>} odbija se ako broker ne potvrdi
 */
export function publishDownlink(devEui, { payload, port }) {
  if (!client?.connected) {
    return Promise.reject(new Error('MQTT klijent nije spojen.'));
  }

  const message = JSON.stringify({
    devEui,
    confirmed: false,
    fPort: port,
    data: Buffer.from(payload, 'hex').toString('base64'),
  });

  return new Promise((resolve, reject) => {
    client.publish(downlinkTopic(devEui), message, { qos: PUBLISH_QOS }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

export const isConnected = () => Boolean(client?.connected);

// 
// ─────────────────────────────────────────────────────────────────────────────

export function startMqtt() {
  if (!mqttConfigured) {
    console.warn('[mqtt] MQTT_BROKER_URL ili MQTT_APPLICATION_ID nisu postavljeni — ingest je iskljucen.');
    return null;
  }

  client = mqtt.connect(env.MQTT_BROKER_URL, {
    clientId: env.MQTT_CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 15000,
  });

  client.on('connect', () => {
    console.log(`[mqtt] spojen na ${env.MQTT_BROKER_URL}`);
    client.subscribe(uplinkTopic(), { qos: PUBLISH_QOS }, (err) => {
      if (err) console.error('[mqtt] pretplata nije uspjela:', err.message);
      else console.log(`[mqtt] pretplacen na ${uplinkTopic()}`);
    });
  });

  client.on('message', onMessage);
  client.on('error', (err) => console.error('[mqtt] greska:', err.message));
  client.on('reconnect', () => console.log('[mqtt] ponovno spajanje…'));
  client.on('close', () => console.log('[mqtt] veza zatvorena'));

  return client;
}

export async function stopMqtt() {
  if (!client) return;
  await new Promise((resolve) => client.end(false, {}, resolve));
  client = null;
}
