import { randomUUID } from 'node:crypto';
import { cloudinary } from '../config/cloudinary.js';
import { isCloudinaryConfigured } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { decodeImageDataUrl, validateImageBuffer } from '../utils/imageValidation.js';
import { ImageCleanup } from '../models/ImageCleanup.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { Outfit } from '../models/Outfit.js';
import { User } from '../models/User.js';

export interface UploadResult { url: string; publicId: string }

/** Record old assets before changing DB references, closing the crash-before-cleanup gap. */
export async function queueImageCleanup(publicIds: (string | undefined)[]) {
  const ids = [...new Set(publicIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  await ImageCleanup.bulkWrite(ids.map((publicId) => ({ updateOne: {
    filter: { publicId }, update: { $set: { nextAttemptAt: new Date(Date.now() + 86400000) } }, upsert: true,
  } })));
}

export async function uploadBuffer(buffer: Buffer, folder: string, options: { removeBackground?: boolean } = {}): Promise<UploadResult> {
  validateImageBuffer(buffer);
  if (!isCloudinaryConfigured()) throw new ApiError(503, 'Dịch vụ lưu ảnh chưa sẵn sàng. Vui lòng thử lại sau.');
  const assetId = randomUUID();
  const publicId = `${folder}/${assetId}`;
  await ImageCleanup.create({ publicId, nextAttemptAt: new Date(Date.now() + 86400000) });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder, public_id: assetId, resource_type: 'image', timeout: 60000,
      // PNG cutouts must retain alpha. Cloudinary rejects undecodable image contents.
      ...(options.removeBackground ? { format: 'png', background_removal: 'cloudinary_ai' } : {}),
    }, (error, result) => {
      if (error || !result) {
        console.error('[cloudinary] Upload failed', error?.http_code);
        return reject(new ApiError(502, 'Không thể lưu ảnh lúc này. Nội dung của bạn vẫn được giữ, hãy thử lại.'));
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.on('error', () => reject(new ApiError(502, 'Kết nối lưu ảnh bị gián đoạn. Vui lòng thử lại.')));
    stream.end(buffer);
  });
}

async function isReferenced(publicId: string) {
  const escaped = publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const legacyUrl = new RegExp(`/image/upload/(?:[^/]+/)*${escaped}(?:\\.[a-zA-Z0-9]+)?(?:\\?.*)?$`);
  const references = await Promise.all([
    ClothingItem.exists({ $or: [{ imagePublicId: publicId }, { originalImagePublicId: publicId }, { originalImageUrl: legacyUrl }] }),
    Outfit.exists({ thumbnailPublicId: publicId }), User.exists({ avatarPublicId: publicId }),
  ]);
  return references.some(Boolean);
}

async function deleteRemote(publicId: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Cleanup timeout')), 15000); }),
    ]);
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Image deletion was not confirmed');
  } finally { if (timer) clearTimeout(timer); }
}

/** Persist retries rather than silently losing failed cleanup operations. */
export async function destroyImage(publicId?: string): Promise<void> {
  if (!publicId) return;
  try {
    // Queue first, so a process exit or provider failure does not lose the deletion.
    await ImageCleanup.updateOne({ publicId }, { $set: { nextAttemptAt: new Date() } }, { upsert: true });
    if (!isCloudinaryConfigured()) return;
    if (!await isReferenced(publicId)) await deleteRemote(publicId);
    await ImageCleanup.deleteOne({ publicId });
  } catch (err) {
    console.error('[cloudinary] Cleanup pending', publicId, err instanceof Error ? err.name : 'Error');
  }
}

export function uploadDataUrl(dataUrl: string, folder: string): Promise<UploadResult> {
  return uploadBuffer(decodeImageDataUrl(dataUrl), folder);
}

/** Wait for every upload before compensating, including partial parallel failures. */
export async function saveWithImages<T>(uploads: (() => Promise<UploadResult>)[], save: (images: UploadResult[]) => Promise<T>, cleanup = destroyImage): Promise<T> {
  const results = await Promise.allSettled(uploads.map((upload) => Promise.resolve().then(upload)));
  const images = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  try {
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    return await save(images);
  } catch (error) {
    await Promise.allSettled(images.map((image) => cleanup(image.publicId)));
    throw error;
  }
}

let cleanupRunning = false;
export async function retryImageCleanup(): Promise<void> {
  if (cleanupRunning || !isCloudinaryConfigured()) return;
  cleanupRunning = true;
  try {
    const jobs = await ImageCleanup.find({ nextAttemptAt: { $lte: new Date() } }).sort({ nextAttemptAt: 1 }).limit(10);
    for (const job of jobs) {
      // A retained/legacy image still referenced by a record must never be removed.
      if (await isReferenced(job.publicId)) {
        await ImageCleanup.deleteOne({ _id: job._id });
        continue;
      }
      try {
        await deleteRemote(job.publicId);
        await ImageCleanup.deleteOne({ _id: job._id });
      } catch {
        await ImageCleanup.updateOne({ _id: job._id }, { $inc: { attempts: 1 }, $set: { nextAttemptAt: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(job.attempts, 10))) } });
      }
    }
  } catch (error) { console.error('[cloudinary] Cleanup retry failed', error instanceof Error ? error.name : 'Error'); }
  finally { cleanupRunning = false; }
}
