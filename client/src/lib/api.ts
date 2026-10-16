import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
const TOKEN_KEY = 'outfitcraft_token';
export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// A rejected password must not expire a valid session. Ignore responses for an older token.
api.interceptors.response.use((res) => res, (error: AxiosError<{ code?: string }>) => {
  if (error.response?.data?.code === 'SESSION_EXPIRED' && typeof window !== 'undefined') {
    if (error.config?.headers.Authorization === `Bearer ${tokenStore.get()}`) {
      tokenStore.clear();
      window.dispatchEvent(new Event('outfitcraft:session-expired'));
    }
  }
  return Promise.reject(error);
});
export function isCancelled(err: unknown): boolean { return axios.isCancel(err); }
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const details = err.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => typeof d?.field === 'string' && typeof d?.message === 'string').map((d) => [d.field, d.message]));
}
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (axios.isCancel(err)) return 'Yêu cầu đã được hủy.';
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'Kết nối đang chậm. Vui lòng thử lại; nội dung của bạn vẫn được giữ nguyên.';
    if (!err.response) return 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng rồi thử lại.';
    if (err.response.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.';
    const fields = Object.values(getFieldErrors(err));
    if (fields.length) return [...new Set(fields)].join(' ');
    const message = err.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (err.response.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (err.response.status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
    if (err.response.status === 413) return 'Dữ liệu quá lớn. Vui lòng giảm kích thước ảnh.';
    return 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
  }
  return err instanceof Error && /[^\u0000-\u007f]/.test(err.message)
    ? err.message : 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
