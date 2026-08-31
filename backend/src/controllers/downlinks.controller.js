// naredbe prema lampama

import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, conflict, notFound } from '../lib/errors.js';
import { lampScope } from '../middleware/auth.js';
import { COMMAND_TYPES } from '../lib/codec.js';
import { cancelCommand, queueCommand } from '../services/downlink.js';
import { parseOrThrow } from './auth.controller.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const lampInfo = { select: { id: true, name: true, devEui: true } };
const authorInfo = { select: { id: true, username: true } };

const scopeThroughLamp = (user) => ({ lamp: lampScope(user) });

const commandFields = z.object({
  lampId: z.coerce.number().int().positive(),
  command: z.enum(COMMAND_TYPES),
  argument: z.coerce.number().int().min(0).max(100).nullable().optional(),
});

/// argument je obavezan samo za SET_BRIGHTNESS; ostale naredbe ga nemaju
const brightnessRule = [
  (d) => d.command !== 'SET_BRIGHTNESS' || d.argument != null,
  { message: 'Za SET_BRIGHTNESS je obavezan argument (postotak 0-100).', path: ['argument'] },
];

const commandSchema = commandFields.refine(...brightnessRule);
/// izmjena ne mijenja lampu - naredba drugoj lampi je nova naredba, ne
/// izmjena ove
const updateSchema = commandFields.omit({ lampId: true }).refine(...brightnessRule);

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);
  const lampId = Number(req.query.lampId) || undefined;

  // ?pending=true je pogled "sto jos nije otislo" - to su jedini redovi koje
  // se smije mijenjati, pa ih sucelje treba moci izdvojiti
  const pending = req.query.pending === 'true';

  const where = {
    ...scopeThroughLamp(req.user),
    ...(lampId && { lampId }),
    ...(pending && { isSent: false, cancelled: false }),
  };

  const [total, downlinks] = await Promise.all([
    prisma.downlink.count({ where }),
    prisma.downlink.findMany({
      where,
      include: { lamp: lampInfo, createdBy: authorInfo },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    data: downlinks,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const downlink = await prisma.downlink.findFirst({
    where: { id: Number(req.params.id), ...scopeThroughLamp(req.user) },
    include: { lamp: lampInfo, createdBy: authorInfo },
  });
  if (!downlink) throw notFound('Naredba nije pronadena.');
  res.json(downlink);
});

export const create = asyncHandler(async (req, res) => {
  const { lampId, command, argument } = parseOrThrow(commandSchema, req.body);

  const lamp = await prisma.lamp.findFirst({
    where: { id: lampId, ...lampScope(req.user) },
  });
  if (!lamp) throw notFound('Svjetiljka nije pronadena.');

  const downlink = await queueCommand({ lamp, command, argument: argument ?? null, user: req.user });
  res.status(201).json(downlink);
});

/// dohvat reda uz provjeru prava i uz uvjet da jos nije otisao
async function findEditable(user, id) {
  const downlink = await prisma.downlink.findFirst({
    where: { id, ...scopeThroughLamp(user) },
    include: { lamp: true },
  });
  if (!downlink) throw notFound('Naredba nije pronadena.');
  if (downlink.isSent) throw conflict('Naredba je vec poslana i vise se ne moze mijenjati.');
  if (downlink.cancelled) throw conflict('Naredba je otkazana.');
  return downlink;
}

export const update = asyncHandler(async (req, res) => {
  const postojeca = await findEditable(req.user, Number(req.params.id));

  const { command, argument } = parseOrThrow(updateSchema, req.body);

  // ponovno kroz servis: nova naredba mora proci istu provjeru payloada i
  // whitelistu kao i prva
  const zamjena = await prisma.$transaction(async (tx) => {
    await tx.downlink.delete({ where: { id: postojeca.id } });
    return queueCommand({
      lamp: postojeca.lamp,
      command,
      argument: argument ?? null,
      user: req.user,
    });
  });

  res.json(zamjena);
});

export const cancel = asyncHandler(async (req, res) => {
  const downlink = await prisma.downlink.findFirst({
    where: { id: Number(req.params.id), ...scopeThroughLamp(req.user) },
  });
  if (!downlink) throw notFound('Naredba nije pronadena.');
  res.json(await cancelCommand(downlink));
});

export const remove = asyncHandler(async (req, res) => {
  const downlink = await findEditable(req.user, Number(req.params.id));
  await prisma.downlink.delete({ where: { id: downlink.id } });
  res.status(204).end();
});
