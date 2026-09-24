import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/** Validate req.body bang Zod schema; gan lai gia tri da parse. */
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          ApiError.badRequest(
            'Du lieu gui len khong hop le',
            err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
          )
        );
      }
      next(err);
    }
  };
