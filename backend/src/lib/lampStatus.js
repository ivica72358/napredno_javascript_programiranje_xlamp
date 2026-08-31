// izvedeni status lampe

import env from './env.js';

const MINUTE = 60 * 1000;

/**
 * @param {{status: string, lastSeen: Date|null}} lamp
 * @param {Date} [now]
 * @returns {'UNKNOWN'|'ONLINE'|'OFFLINE'|'ERROR'}
 */
// status se racuna pri citanju, ne cuva u bazi - lampa koja je zadnji put
// javila da je ok pa se ugasila bi inace zauvijek pisala kao ONLINE
export function deriveStatus(lamp, now = new Date()) {
  if (!lamp.lastSeen) return 'UNKNOWN';

  const silentFor = now.getTime() - new Date(lamp.lastSeen).getTime();
  if (silentFor > env.OFFLINE_AFTER_MINUTES * MINUTE) return 'OFFLINE';

  // uredaj se javlja - vrijedi ono sto je zadnji uplink zabiljezio
  return lamp.status === 'UNKNOWN' ? 'ONLINE' : lamp.status;
}

/// lampa spremna za slanje klijentu - sa stvarnim, a ne zapisanim statusom
export function serializeLamp(lamp, now = new Date()) {
  return { ...lamp, status: deriveStatus(lamp, now) };
}
