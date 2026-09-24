import { cloudinary } from '../config/cloudinary.js';
import { isCloudinaryConfigured } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Stream buffer tu multer len Cloudinary.
 * removeBackground=true se dung add-on cloudinary_ai_background_removal
 * (chi bat khi tai khoan co add-on; mac dinh luong chinh la tach nen o client).
 */
export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  options: { removeBackground?: boolean } = {}
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw ApiError.badRequest(
      'Chua cau hinh Cloudinary. Dat CLOUDINARY_* trong file .env'
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        format: options.removeBackground ? 'png' : undefined,
        background_removal: options.removeBackground
          ? 'cloudinary_ai'
          : undefined,
      },
      (error, result) => {
        if (error || !result) {
          return reject(ApiError.badRequest(error?.message ?? 'Upload that bai'));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Xoa anh tren Cloudinary. Nuot loi vi day chi la don dep. */
export async function destroyImage(publicId?: string): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[cloudinary] Khong xoa duoc', publicId, err);
  }
}

/** Luu anh base64 (dataURL) - dung cho thumbnail export tu Fabric canvas. */
export async function uploadDataUrl(
  dataUrl: string,
  folder: string
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw ApiError.badRequest('Chua cau hinh Cloudinary');
  }
  const res = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: 'image',
  });
  return { url: res.secure_url, publicId: res.public_id };
}
