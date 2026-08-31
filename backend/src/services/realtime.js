// Socket.IO — gura telemetriju na frontend cim stigne, bez pollinga

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../lib/env.js';
import prisma from '../lib/prisma.js';
import bus, { EVENTS } from '../lib/events.js';

/// administratori vide sve, pa svi sjede u jednoj sobi
const ADMIN_ROOM = 'admins';
const userRoom = (id) => `user:${id}`;

export function startRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  io.use(async (socket, next) => {
    // token stize kroz `auth`, ne kroz query string: query zavrsi u logovima
    // poslužitelja i proxyja, a ovo je vjerodajnica koja vrijedi 8 sati
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Nedostaje token.'));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true },
      });
      if (!user) return next(new Error('Korisnik vise ne postoji.'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Token je neispravan ili je istekao.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    if (user.role === 'ADMIN') socket.join(ADMIN_ROOM);

    console.log(`[socket] ${user.username} spojen`);
    socket.on('disconnect', () => console.log(`[socket] ${user.username} odspojen`));
  });

  /// salje dogadaj vlasniku lampe i administratorima
  const emitScoped = (event, ownerId, data) => {
    io.to(userRoom(ownerId)).to(ADMIN_ROOM).emit(event, data);
  };

  bus.on(EVENTS.UPLINK, (uplink) => emitScoped('uplink', uplink.lamp.ownerId, uplink));
  bus.on(EVENTS.LAMP_UPDATED, (lamp) => emitScoped('lamp:updated', lamp.ownerId, lamp));
  bus.on(EVENTS.DOWNLINK_SENT, (dl) => emitScoped('downlink:sent', dl.lamp.ownerId, dl));

  return io;
}
