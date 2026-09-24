/** Loi co chu dich - errorHandler se tra dung status thay vi 500. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, details?: unknown) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Chua dang nhap') { return new ApiError(401, msg); }
  static forbidden(msg = 'Khong co quyen truy cap') { return new ApiError(403, msg); }
  static notFound(msg = 'Khong tim thay du lieu') { return new ApiError(404, msg); }
  static conflict(msg: string) { return new ApiError(409, msg); }
}
