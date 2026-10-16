import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { JwtPayload } from '../types/index.js';

// Bo sung field user vao Request cua Express.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.sessionExpired());
  }

  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as JwtPayload;
    next();
  } catch {
    next(ApiError.sessionExpired());
  }
}
