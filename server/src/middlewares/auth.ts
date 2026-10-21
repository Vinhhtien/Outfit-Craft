import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { JwtPayload } from '../types/index.js';
import { User } from '../models/User.js';

// Bo sung field user vao Request cua Express.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      adminName?: string;
    }
  }
}

export async function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.sessionExpired());
  }

  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as JwtPayload;
  } catch {
    return next(ApiError.sessionExpired());
  }
  try {
    const account = await User.findById(req.user!.sub).select('isActive');
    if (!account) return next(ApiError.sessionExpired());
    if (!account.isActive) return next(ApiError.forbidden('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'));
    next();
  } catch (error) { next(error); }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const account = await User.findById(req.user?.sub).select('role isActive displayName');
    if (!account || !account.isActive || account.role !== 'admin') return next(ApiError.forbidden());
    req.adminName = account.displayName;
    next();
  } catch (error) { next(error); }
}
