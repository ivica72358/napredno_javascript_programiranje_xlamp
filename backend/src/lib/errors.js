// greske s HTTP statusom

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new ApiError(400, msg, details);
export const unauthorized = (msg = 'Niste prijavljeni.') => new ApiError(401, msg);
export const forbidden = (msg = 'Nemate ovlasti za ovu radnju.') => new ApiError(403, msg);
export const notFound = (msg = 'Zapis nije pronaden.') => new ApiError(404, msg);
export const conflict = (msg) => new ApiError(409, msg);

/// omotac koji hvata odbijene promise iz async kontrolera
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
