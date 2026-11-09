import { z } from 'zod';
import { ClothingItem } from '../models/ClothingItem.js';
import { TryOnSnapshot } from '../models/TryOnSnapshot.js';
import { resolveTryOnPrompt } from '../services/tryOnPrompt.service.js';
import {
  endTryOnSession, getTryOnQuota, issueTryOnToken, recordTryOnHeartbeat, startTryOnSession,
} from '../services/tryOnSession.service.js';
import { destroyImage, queueImageCleanup, saveWithImages, uploadBuffer } from '../services/upload.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateImageBuffer } from '../utils/imageValidation.js';

/** Moi user giu toi da chung nay anh, day thi phai xoa bot truoc khi chup them. */
const MAX_SNAPSHOTS = 60;

export const heartbeatSchema = z.object({ live: z.boolean() }).strict();

/** GET /api/try-on/quota */
export const getQuota = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getTryOnQuota(req.user!.sub) });
});

/** POST /api/try-on/sessions - kiem tra han muc, mo phien moi. */
export const startSession = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await startTryOnSession(req.user!.sub) });
});

/** POST /api/try-on/sessions/:id/token - client token ngan han, goi moi lan connect/reconnect. */
export const createToken = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await issueTryOnToken(req.user!.sub, req.params.id) });
});

/** POST /api/try-on/sessions/:id/heartbeat - ghi nhan thoi luong theo dong ho server. */
export const heartbeat = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await recordTryOnHeartbeat(req.user!.sub, req.params.id, req.body.live) });
});

/** POST /api/try-on/sessions/:id/end */
export const endSession = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await endTryOnSession(req.user!.sub, req.params.id) });
});

/** POST /api/try-on/items/:id/prompt - tuy chon kem file 'frame' (anh camera, khong luu lai). */
export const getItemPrompt = asyncHandler(async (req, res) => {
  const item = await ClothingItem.findOne({ _id: req.params.id, owner: req.user!.sub }).select('+tryOnPrompt');
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');
  const frame = req.file ? { data: req.file.buffer, mimeType: validateImageBuffer(req.file.buffer) } : undefined;
  res.json({ success: true, data: await resolveTryOnPrompt(item, frame) });
});

/** GET /api/try-on/snapshots - lich su anh da chup, moi nhat truoc. */
export const listSnapshots = asyncHandler(async (req, res) => {
  const snapshots = await TryOnSnapshot.find({ owner: req.user!.sub }).sort({ createdAt: -1 }).limit(MAX_SNAPSHOTS);
  res.json({ success: true, data: snapshots });
});

/** POST /api/try-on/snapshots - file 'image', tuy chon itemId cua mon dang thu. */
export const createSnapshot = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  if (!req.file) throw ApiError.badRequest('Vui lòng chọn ảnh.');
  const buffer = req.file.buffer;
  validateImageBuffer(buffer);
  if (await TryOnSnapshot.countDocuments({ owner }) >= MAX_SNAPSHOTS) {
    throw ApiError.conflict('Lịch sử thử đồ đã đầy. Hãy xóa bớt ảnh cũ rồi chụp tiếp nhé.');
  }
  const item = req.body.itemId
    ? await ClothingItem.findOne({ _id: String(req.body.itemId), owner }).select('name')
    : null;
  const snapshot = await saveWithImages(
    [() => uploadBuffer(buffer, `outfitcraft/${owner}/tryon`)],
    ([image]) => TryOnSnapshot.create({
      owner, item: item?._id, itemName: item?.name, imageUrl: image.url, imagePublicId: image.publicId,
    })
  );
  res.status(201).json({ success: true, data: snapshot });
});

/** DELETE /api/try-on/snapshots/:id - anh co hinh user nen phai xoa han khoi Cloudinary. */
export const deleteSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await TryOnSnapshot.findOne({ _id: req.params.id, owner: req.user!.sub });
  if (!snapshot) throw ApiError.notFound('Không tìm thấy ảnh.');
  await queueImageCleanup([snapshot.imagePublicId]);
  await snapshot.deleteOne();
  await destroyImage(snapshot.imagePublicId);
  res.json({ success: true, message: 'Đã xóa ảnh.' });
});
