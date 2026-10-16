import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

const labels: Record<string, string> = {
  name: 'Tên', email: 'Email', password: 'Mật khẩu', displayName: 'Tên hiển thị',
  category: 'Danh mục', colors: 'Màu sắc', styles: 'Phong cách', seasons: 'Mùa',
  occasions: 'Dịp mặc', brand: 'Thương hiệu', notes: 'Ghi chú', date: 'Ngày',
  outfit: 'Outfit', items: 'Món đồ', defaultCity: 'Thành phố',
};
export function validationDetails(error: ZodError) {
  return error.issues.map((issue) => {
    const field = issue.path.join('.');
    const label = labels[String(issue.path[0])] ?? 'Thông tin';
    let message = /[^\u0000-\u007f]/.test(issue.message) ? issue.message : `${label} không hợp lệ.`;
    if (issue.code === 'invalid_type' && issue.received === 'undefined') message = `Vui lòng nhập ${label.toLowerCase()}.`;
    if (issue.code === 'too_small') message = `${label} cần tối thiểu ${issue.minimum}${issue.type === 'string' ? ' ký tự' : ''}.`;
    if (issue.code === 'too_big') message = `${label} được phép tối đa ${issue.maximum}${issue.type === 'string' ? ' ký tự' : ''}.`;
    if (issue.code === 'unrecognized_keys') message = 'Có thông tin không được phép thay đổi.';
    return { field, message };
  });
}

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
            'Vui lòng kiểm tra lại thông tin đã nhập.',
            validationDetails(err)
          )
        );
      }
      next(err);
    }
  };
