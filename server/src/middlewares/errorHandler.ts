import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { validationDetails } from './validate.js';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound('Đường dẫn yêu cầu không tồn tại.'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  let status = 500;
  let message = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
  let details: unknown;
  let code: string | undefined;
  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
    code = err.code;
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Vui lòng kiểm tra lại thông tin đã nhập.';
    details = validationDetails(err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Mỗi ảnh được phép tối đa 10 MB.'
      : 'Số lượng ảnh hoặc dữ liệu tải lên không hợp lệ.';
  } else if (err instanceof Error) {
    const error = err as Error & { code?: number; type?: string };
    if (error.code === 11000) {
      status = 409;
      message = 'Dữ liệu này đã tồn tại. Vui lòng kiểm tra lại.';
    } else if (err.name === 'ValidationError' || err.name === 'CastError') {
      status = 400;
      message = err.name === 'CastError' ? 'Mã dữ liệu hoặc giá trị không hợp lệ.' : 'Vui lòng kiểm tra lại thông tin đã nhập.';
    } else if (err.name === 'VersionError') {
      status = 409;
      message = 'Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      message = 'Dữ liệu quá lớn. Vui lòng giảm kích thước ảnh rồi thử lại.';
    } else if (error.type === 'entity.parse.failed') {
      status = 400;
      message = 'Dữ liệu gửi lên không đúng định dạng.';
    }
  }
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(details ? { details } : {}) });
}
