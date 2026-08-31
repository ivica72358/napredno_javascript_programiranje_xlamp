// CRUD nad lampama

import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, forbidden, notFound } from '../lib/errors.js';
import { isAdmin, lampScope } from '../middleware/auth.js';
import { serializeLamp } from '../lib/lampStatus.js';
import { parseOrThrow } from './auth.controller.js';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const lampSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan.').max(100),
  devEui: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{16}$/, 'devEUI mora imati tocno 16 heksadekadskih znamenki.'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  ownerId: z.coerce.number().int().positive().optional(),
});

const owner = { select: { id: true, username: true } };

/// vlasnik novog ili izmijenjenog zapisa
function resolveOwnerId(user, requested) {
  if (requested === undefined) return user.id;
  if (!isAdmin(user) && requested !== user.id) {
    throw forbidden('Svjetiljku mozete dodijeliti samo sebi.');
  }
  return requested;
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);
  const search = (req.query.search || '').trim();

  const where = {
    ...lampScope(req.user),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { devEui: { contains: search.toLowerCase() } },
      ],
    }),
  };

  const [total, lamps] = await Promise.all([
    prisma.lamp.count({ where }),
    prisma.lamp.findMany({
      where,
      include: { owner },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const now = new Date();
  res.json({
    data: lamps.map((l) => serializeLamp(l, now)),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const lamp = await prisma.lamp.findFirst({
    where: { id: Number(req.params.id), ...lampScope(req.user) },
    include: {
      owner,
      _count: { select: { uplinks: true, downlinks: true } },
    },
  });
  if (!lamp) throw notFound('Svjetiljka nije pronadena.');
  res.json(serializeLamp(lamp));
});

export const create = asyncHandler(async (req, res) => {
  const data = parseOrThrow(lampSchema, req.body);
  const lamp = await prisma.lamp.create({
    data: { ...data, ownerId: resolveOwnerId(req.user, data.ownerId) },
    include: { owner },
  });
  res.status(201).json(serializeLamp(lamp));
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  // provjera vidljivosti PRIJE izmjene: findFirst sa scopeom, pa tek update po
  // id-u
  const postojeca = await prisma.lamp.findFirst({
    where: { id, ...lampScope(req.user) },
    select: { id: true },
  });
  if (!postojeca) throw notFound('Svjetiljka nije pronadena.');

  const data = parseOrThrow(lampSchema.partial(), req.body);
  const { ownerId, ...rest } = data;

  const lamp = await prisma.lamp.update({
    where: { id },
    data: {
      ...rest,
      ...(ownerId !== undefined && { ownerId: resolveOwnerId(req.user, ownerId) }),
    },
    include: { owner },
  });
  res.json(serializeLamp(lamp));
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const postojeca = await prisma.lamp.findFirst({
    where: { id, ...lampScope(req.user) },
    select: { id: true },
  });
  if (!postojeca) throw notFound('Svjetiljka nije pronadena.');

  // uplinkovi i downlinkovi odlaze s lampom (onDelete: Cascade u shemi)
  await prisma.lamp.delete({ where: { id } });
  res.status(204).end();
});
