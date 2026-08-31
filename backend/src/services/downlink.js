// stvaranje i otkazivanje naredbi

import prisma from '../lib/prisma.js';
import env, { allowedDevEuis } from '../lib/env.js';
import { encodeCommand } from '../lib/codec.js';
import { badRequest, conflict, forbidden } from '../lib/errors.js';
import { isConnected, publishDownlink } from './mqtt.js';
import bus, { EVENTS } from '../lib/events.js';

/// baca ako uredaj nije na popisu dozvoljenih
// provjera je ovdje, a ne u kontroleru - svaka nova pozivna tocka bi je
// inace morala ponoviti, a prva koja zaboravi gasi pravu ulicu
export function assertSendAllowed(devEui) {
  if (!allowedDevEuis.has(devEui.toLowerCase())) {
    throw forbidden(
      `Slanje naredbi uredaju ${devEui} nije dopusteno. ` +
        'Uredaj mora biti naveden u ALLOWED_DEVEUIS.',
    );
  }
}

/**
 * Zapisuje naredbu u red za slanje.
 * @param {{lamp: object, command: string, argument: number|null, user: object}} opts
 */
export async function queueCommand({ lamp, command, argument = null, user }) {
  assertSendAllowed(lamp.devEui);

  let encoded;
  try {
    encoded = encodeCommand(command, argument);
  } catch (e) {
    throw badRequest(e.message);
  }

  const downlink = await prisma.downlink.create({
    data: {
      lampId: lamp.id,
      command,
      argument: command === 'SET_BRIGHTNESS' ? argument : null,
      payload: encoded.payload,
      port: encoded.port,
      createdById: user.id,
    },
    include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
  });

  return dispatch(downlink, lamp.devEui);
}

/// objavljuje naredbu i biljezi ishod
async function dispatch(downlink, devEui) {
  if (env.DOWNLINK_DRY_RUN) {
    console.warn(`[downlink] DRY RUN — ${downlink.command} za ${devEui} nije objavljen.`);
    return downlink;
  }

  if (!isConnected()) {
    return prisma.downlink.update({
      where: { id: downlink.id },
      data: { error: 'MQTT klijent nije spojen na broker.' },
      include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
    });
  }

  try {
    await publishDownlink(devEui, downlink);
    const sent = await prisma.downlink.update({
      where: { id: downlink.id },
      data: { isSent: true, sentAt: new Date(), error: null },
      include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
    });
    bus.emit(EVENTS.DOWNLINK_SENT, sent);
    console.log(`[downlink] ${downlink.command} -> ${devEui} (${downlink.payload}:${downlink.port})`);
    return sent;
  } catch (err) {
    return prisma.downlink.update({
      where: { id: downlink.id },
      data: { error: `Objava na broker nije uspjela: ${err.message}` },
      include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
    });
  }
}

/// otkazivanje ima smisla samo dok naredba nije otisla na mrezu
export async function cancelCommand(downlink) {
  if (downlink.isSent) {
    throw conflict('Naredba je vec poslana i ne moze se opozvati.');
  }
  if (downlink.cancelled) {
    throw conflict('Naredba je vec otkazana.');
  }

  return prisma.downlink.update({
    where: { id: downlink.id },
    data: { cancelled: true, cancelledAt: new Date() },
    include: { lamp: { select: { id: true, name: true, devEui: true, ownerId: true } } },
  });
}
