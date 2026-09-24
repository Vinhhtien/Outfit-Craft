import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Boc controller async de loi throw ra duoc chuyen toi errorHandler,
 * khoi phai viet try/catch o moi controller.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
