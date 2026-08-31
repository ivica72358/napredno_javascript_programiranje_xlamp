// telemetrija

import prisma from '../lib/prisma.js';
import { asyncHandler, notFound } from '../lib/errors.js';
import { lampScope } from '../middleware/auth.js';
import { decodeUplink } from '../lib/codec.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const lampInfo = { select: { id: true, name: true, devEui: true } };

/// scope se ne moze staviti izravno na uplink - prava su vezana uz lampu, pa
/// filter ide kroz relaciju
const scopeThroughLamp = (user) => ({ lamp: lampScope(user) });

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);
  const lampId = Number(req.query.lampId) || undefined;
  const decode = req.query.decode !== 'false';

  const where = { ...scopeThroughLamp(req.user), ...(lampId && { lampId }) };

  const [total, uplinks] = await Promise.all([
    prisma.uplink.count({ where }),
    prisma.uplink.findMany({
      where,
      include: { lamp: lampInfo },
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    // dekodiranje je ukljuceno po defaultu jer lista bez njega prikazuje samo hex
    data: uplinks.map((u) => (decode ? { ...u, decoded: decodeUplink(u.payload) } : u)),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const uplink = await prisma.uplink.findFirst({
    where: { id: Number(req.params.id), ...scopeThroughLamp(req.user) },
    include: { lamp: lampInfo },
  });
  if (!uplink) throw notFound('Uplink nije pronaden.');
  res.json({ ...uplink, decoded: decodeUplink(uplink.payload) });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const postojeci = await prisma.uplink.findFirst({
    where: { id, ...scopeThroughLamp(req.user) },
    select: { id: true },
  });
  if (!postojeci) throw notFound('Uplink nije pronaden.');

  await prisma.uplink.delete({ where: { id } });
  res.status(204).end();
});
