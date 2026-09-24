import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Khong tim thay route: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let status = 500;
  let message = 'Loi he thong';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof Error) {
    message = err.message;
    // Duplicate key cua MongoDB (vd email da ton tai)
    if ((err as { code?: number }).code === 11000) {
      status = 409;
      message = 'Du lieu da ton tai';
    } else if (err.name === 'ValidationError') {
      status = 400;
    } else if (err.name === 'CastError') {
      status = 400;
      message = 'ID khong hop le';
    }
  }

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.nodeEnv === 'development' && err instanceof Error ? { stack: err.stack } : {}),
  });
}
