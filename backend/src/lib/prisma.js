// jedna instanca Prisma klijenta za cijelu aplikaciju

import { PrismaClient } from '@prisma/client';

const globalna = globalThis;

const prisma =
  globalna.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalna.__prisma = prisma;
}

export default prisma;
