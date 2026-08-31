// upravljanje korisnicima

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { isAdmin } from '../middleware/auth.js';
import { parseOrThrow } from './auth.controller.js';

const BCRYPT_ROUNDS = 10;

const publicUser = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  _count: { select: { lamps: true } },
};

const createSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().trim().email().max(150),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(100),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

const updateSchema = z.object({
  email: z.string().trim().email().max(150).optional(),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(100).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

/// korisnik smije dirati sebe; administrator svakoga
function assertCanTouch(actor, targetId) {
  if (!isAdmin(actor) && actor.id !== targetId) {
    throw forbidden('Mozete uredivati samo vlastiti profil.');
  }
}

export const list = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: publicUser,
    orderBy: { username: 'asc' },
  });
  res.json({ data: users, total: users.length });
});

export const getOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  assertCanTouch(req.user, id);

  const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
  if (!user) throw notFound('Korisnik nije pronaden.');
  res.json(user);
});

export const create = asyncHandler(async (req, res) => {
  const data = parseOrThrow(createSchema, req.body);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: data.username }, { email: data.email }] },
    select: { username: true },
  });
  if (existing) {
    throw conflict(
      existing.username === data.username
        ? 'Korisnicko ime je zauzeto.'
        : 'E-mail adresa je vec registrirana.',
    );
  }

  const user = await prisma.user.create({
    data: { ...data, password: await bcrypt.hash(data.password, BCRYPT_ROUNDS) },
    select: publicUser,
  });
  res.status(201).json(user);
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  assertCanTouch(req.user, id);

  const data = parseOrThrow(updateSchema, req.body);

  // promjena uloge je administratorska
  if (data.role !== undefined && !isAdmin(req.user)) {
    throw forbidden('Ulogu moze mijenjati samo administrator.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...data,
      ...(data.password && { password: await bcrypt.hash(data.password, BCRYPT_ROUNDS) }),
    },
    select: publicUser,
  });
  res.json(user);
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  // administrator koji obrise sam sebe ostavlja sustav bez nacina da se vrati
  // unutra ako je bio jedini
  if (id === req.user.id) throw badRequest('Ne mozete obrisati vlastiti racun.');

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw notFound('Korisnik nije pronaden.');

  // lampe korisnika odlaze s njim (onDelete: Cascade), a s njima i telemetrija
  await prisma.user.delete({ where: { id } });
  res.status(204).end();
});
