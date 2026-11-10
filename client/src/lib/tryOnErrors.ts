import axios from 'axios';
import { getErrorMessage } from './api';

export type TryOnFailureKind =
  | 'unsupported' | 'camera-denied' | 'camera-missing' | 'camera-busy' | 'camera-lost'
  | 'connection' | 'quota' | 'session-over' | 'service';

export interface TryOnFailure {
  kind: TryOnFailureKind;
  message: string;
}

export function unsupportedFailure(support: { secure: boolean; media: boolean; webrtc: boolean }): TryOnFailure | null {
  if (!support.secure) {
    return { kind: 'unsupported', message: 'Camera chỉ hoạt động trên kết nối bảo mật. Hãy mở trang bằng địa chỉ HTTPS rồi thử lại.' };
  }
  if (!support.media || !support.webrtc) {
    return { kind: 'unsupported', message: 'Trình duyệt này chưa hỗ trợ thử đồ trực tiếp. Hãy dùng Chrome, Edge hoặc Safari phiên bản mới.' };
  }
  return null;
}

export function cameraFailure(err: unknown): TryOnFailure {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { kind: 'camera-denied', message: 'Bạn chưa cấp quyền dùng camera. Hãy bấm biểu tượng bên trái thanh địa chỉ, cho phép Camera rồi thử lại.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { kind: 'camera-missing', message: 'Không tìm thấy camera trên thiết bị này. Hãy kết nối camera rồi thử lại.' };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return { kind: 'camera-busy', message: 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.' };
  }
  return { kind: 'camera-missing', message: 'Không mở được camera. Vui lòng thử lại.' };
}

export const cameraLostFailure: TryOnFailure = {
  kind: 'camera-lost',
  message: 'Camera vừa bị ngắt. Hãy kiểm tra lại camera rồi bắt đầu phiên mới.',
};

/** Loi tu API cua OutfitCraft; han muc duoc tach rieng de an nut "Thu lai". */
export function apiFailure(err: unknown): TryOnFailure {
  const code = axios.isAxiosError(err) ? err.response?.data?.code : undefined;
  if (code === 'TRYON_QUOTA_EXCEEDED') return { kind: 'quota', message: getErrorMessage(err) };
  if (code === 'TRYON_SESSION_OVER') return { kind: 'session-over', message: getErrorMessage(err) };
  return { kind: 'service', message: getErrorMessage(err) };
}

export const connectionFailure: TryOnFailure = {
  kind: 'connection',
  message: 'Mất kết nối tới dịch vụ thử đồ. Hãy kiểm tra mạng rồi thử lại.',
};

/**
 * Server khong nhan anh/prompt luc khoi tao: ket noi van mo nhung se khong bao gio co video.
 * Loi hang doi (WEBRTC_SERVER_ERROR) va mat ket noi khong thuoc nhom nay vi SDK tu thu lai.
 */
export function setupRejectedFailure(code: string): TryOnFailure | null {
  if (code !== 'WEBRTC_SIGNALING_ERROR' && code !== 'WEBRTC_TIMEOUT_ERROR') return null;
  return { kind: 'service', message: 'Dịch vụ thử đồ chưa nhận được ảnh hoặc mô tả của món này. Hãy đóng lại và thử món khác.' };
}

const SESSION_END_MESSAGES: Record<string, string> = {
  moderation_violation: 'Phiên bị dừng vì hình ảnh không phù hợp với chính sách của dịch vụ.',
  policy_violation: 'Phiên bị dừng vì hình ảnh không phù hợp với chính sách của dịch vụ.',
  insufficient_credits: 'Dịch vụ thử đồ tạm thời hết hạn mức. Vui lòng thử lại sau.',
  session_limit: 'Dịch vụ thử đồ đang quá tải. Vui lòng thử lại sau ít phút.',
};

/** Server cua Decart chu dong ket thuc phien (SDK khong tu noi lai trong truong hop nay). */
export function sessionEndedFailure(reason: string): TryOnFailure {
  return { kind: 'service', message: SESSION_END_MESSAGES[reason] ?? 'Phiên thử đồ đã bị dịch vụ kết thúc. Vui lòng thử lại.' };
}
