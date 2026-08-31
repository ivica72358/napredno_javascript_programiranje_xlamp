// sredisnja obrada gresaka

import { ApiError } from '../lib/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Ruta ${req.method} ${req.originalUrl} ne postoji.`));
}

// Express 4 prepoznaje error handler po cetiri argumenta - `next` se ne
// smije izostaviti iako se ne koristi
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Prisma: krsenje unique ogranicenja
  if (err.code === 'P2002') {
    const polja = err.meta?.target?.join(', ') ?? 'vrijednost';
    return res.status(409).json({ error: `Zapis s tom vrijednoscu vec postoji (${polja}).` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Zapis nije pronaden.' });
  }

  console.error('Neocekivana greska:', err);
  return res.status(500).json({ error: 'Interna greska poslužitelja.' });
}
