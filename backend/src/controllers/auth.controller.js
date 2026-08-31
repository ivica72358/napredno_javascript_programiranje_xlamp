// registracija, prijava i podaci o prijavljenom korisniku

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../lib/errors.js';
import { signToken } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 10;

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Korisnicko ime mora imati barem 3 znaka.')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Dopusteni su slova, brojke, tocka, crtica i podvlaka.'),
  email: z.string().trim().email('Neispravna e-mail adresa.').max(150),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(100),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Korisnicko ime je obavezno.'),
  password: z.string().min(1, 'Lozinka je obavezna.'),
});

/// zod greske u oblik koji frontend moze mapirati na polja obrasca
export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      details[issue.path.join('.') || '_'] = issue.message;
    }
    throw badRequest('Neispravni podaci.', details);
  }
  return result.data;
}

const publicUser = { id: true, username: true, email: true, role: true, createdAt: true };

export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = parseOrThrow(registerSchema, req.body);

  // provjera prije unosa daje poruku koja imenuje tocno polje
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (existing) {
    throw conflict(
      existing.username === username
        ? 'Korisnicko ime je zauzeto.'
        : 'E-mail adresa je vec registrirana.',
    );
  }

  // uloga se NE cita iz zahtjeva
  const user = await prisma.user.create({
    data: { username, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    select: publicUser,
  });

  res.status(201).json({ user, token: signToken(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { username, password } = parseOrThrow(loginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { username } });

  // ista poruka za nepostojeceg korisnika i za krivu lozinku - razlicite
  // poruke otkrivaju koja korisnicka imena postoje
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw unauthorized('Neispravno korisnicko ime ili lozinka.');

  const { password: _, ...safe } = user;
  res.json({ user: safe, token: signToken(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
