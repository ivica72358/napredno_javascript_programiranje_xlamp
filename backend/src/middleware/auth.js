// autentikacija tokenom i autorizacija po ulozi

import jwt from 'jsonwebtoken';
import env from '../lib/env.js';
import prisma from '../lib/prisma.js';
import { asyncHandler, forbidden, unauthorized } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

/// trazi ispravan Bearer token i ucitava korisnika iz baze
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [shema, token] = header.split(' ');

  if (shema !== 'Bearer' || !token) {
    throw unauthorized('Nedostaje Bearer token.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw unauthorized('Token je neispravan ili je istekao.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, email: true, role: true },
  });

  if (!user) throw unauthorized('Korisnik vise ne postoji.');

  req.user = user;
  next();
});

/// samo ADMIN
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'ADMIN') {
    return next(forbidden('Ova radnja je dopustena samo administratoru.'));
  }
  next();
}

export const isAdmin = (user) => user?.role === 'ADMIN';

/// Prisma `where` uvjet koji ogranicava lampe na one koje korisnik smije
/// vidjeti
export function lampScope(user) {
  return isAdmin(user) ? {} : { ownerId: user.id };
}
