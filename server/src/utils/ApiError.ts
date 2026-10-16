/** Loi co chu dich - errorHandler se tra dung status thay vi 500. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, details?: unknown) { return new ApiError(400, msg, details); }
  static sessionExpired() {
    const error = new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    error.code = 'SESSION_EXPIRED';
    return error;
  }
  static unauthorized(msg = 'Vui lòng đăng nhập để tiếp tục.') { return new ApiError(401, msg); }
  static forbidden(msg = 'Bạn không có quyền thực hiện thao tác này.') { return new ApiError(403, msg); }
  static notFound(msg = 'Không tìm thấy dữ liệu.') { return new ApiError(404, msg); }
  static conflict(msg: string) { return new ApiError(409, msg); }
}
