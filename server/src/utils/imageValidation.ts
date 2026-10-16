import { ApiError } from './ApiError.js';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function validateImageBuffer(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw ApiError.badRequest('Ảnh phải có dung lượng từ 1 byte đến 10 MB.');
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw ApiError.badRequest('Nội dung ảnh không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.');
}
export function decodeImageDataUrl(dataUrl: string): Buffer {
  if (dataUrl.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 64) throw ApiError.badRequest('Ảnh tối đa 10 MB.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) throw ApiError.badRequest('Ảnh xem trước không đúng định dạng.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.toString('base64') !== match[2] || validateImageBuffer(buffer) !== match[1]) throw ApiError.badRequest('Nội dung ảnh không khớp định dạng.');
  return buffer;
}
export function ownsImage(publicId: string | undefined, owner: string): boolean {
  return Boolean(publicId && publicId.startsWith(`outfitcraft/${owner}/`) && !publicId.includes('..'));
}

/** Recover only URLs in our configured Cloudinary account and this owner's folder. */
export function ownedImageIdFromUrl(url: string | undefined, owner: string, cloudName: string): string | undefined {
  if (!url || !cloudName) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return;
    const prefix = `/${cloudName}/image/upload/`;
    if (!parsed.pathname.startsWith(prefix)) return;
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
    const index = path.indexOf(`outfitcraft/${owner}/`);
    if (index < 0 || (index > 0 && path[index - 1] !== '/')) return;
    const publicId = path.slice(index).replace(/\.(png|jpe?g|webp|avif)$/i, '');
    return ownsImage(publicId, owner) ? publicId : undefined;
  } catch { return; }
}
