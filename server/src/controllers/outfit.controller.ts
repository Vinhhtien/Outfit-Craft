import { z } from 'zod';
import { Outfit } from '../models/Outfit.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDataUrl, destroyImage } from '../services/upload.service.js';
import { SEASONS, OCCASIONS } from '../types/index.js';

const outfitItemSchema = z.object({
  item: z.string().length(24, 'itemId khong hop le'),
  left: z.number(),
  top: z.number(),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  angle: z.number().default(0),
  zIndex: z.number().default(0),
  flipX: z.boolean().optional(),
});

export const createOutfitSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(outfitItemSchema).min(1, 'Outfit phai co it nhat 1 mon do'),
  canvasJSON: z.record(z.unknown()).default({}),
  /** dataURL PNG export tu Fabric; server se day len Cloudinary. */
  thumbnailDataUrl: z.string().startsWith('data:image/').optional(),
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: z.array(z.enum(OCCASIONS)).default([]),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
});

export const updateOutfitSchema = createOutfitSchema.partial();

/** Chan viec ghep item cua nguoi khac vao outfit cua minh. */
async function assertOwnsItems(itemIds: string[], owner: string) {
  const count = await ClothingItem.countDocuments({
    _id: { $in: itemIds },
    owner,
  });
  if (count !== new Set(itemIds).size) {
    throw ApiError.badRequest('Co mon do khong ton tai hoac khong thuoc ve ban');
  }
}

export const createOutfit = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { thumbnailDataUrl, ...rest } = req.body;

  await assertOwnsItems(rest.items.map((i: { item: string }) => i.item), owner);

  let thumbnailUrl: string | undefined;
  let thumbnailPublicId: string | undefined;
  if (thumbnailDataUrl) {
    const up = await uploadDataUrl(thumbnailDataUrl, `outfitcraft/${owner}/outfits`);
    thumbnailUrl = up.url;
    thumbnailPublicId = up.publicId;
  }

  const outfit = await Outfit.create({
    ...rest,
    owner,
    thumbnailUrl,
    thumbnailPublicId,
  });

  res.status(201).json({ success: true, data: outfit });
});

export const getOutfits = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 12);

  const filter: Record<string, unknown> = { owner: req.user!.sub };
  if (req.query.season) filter.seasons = req.query.season;
  if (req.query.occasion) filter.occasions = req.query.occasion;

  const [outfits, total] = await Promise.all([
    Outfit.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('items.item', 'name imageUrl category'),
    Outfit.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: outfits,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getOutfit = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findById(req.params.id).populate('items.item');
  if (!outfit) throw ApiError.notFound('Khong tim thay outfit');

  // Cho xem neu la chu so huu hoac outfit da cong khai.
  const isOwner = outfit.owner.toString() === req.user?.sub;
  if (!isOwner && !outfit.isPublic) throw ApiError.forbidden();

  res.json({ success: true, data: outfit });
});

export const updateOutfit = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { thumbnailDataUrl, ...rest } = req.body;

  const outfit = await Outfit.findOne({ _id: req.params.id, owner });
  if (!outfit) throw ApiError.notFound('Khong tim thay outfit');

  if (rest.items) {
    await assertOwnsItems(rest.items.map((i: { item: string }) => i.item), owner);
  }

  if (thumbnailDataUrl) {
    await destroyImage(outfit.thumbnailPublicId);
    const up = await uploadDataUrl(thumbnailDataUrl, `outfitcraft/${owner}/outfits`);
    outfit.thumbnailUrl = up.url;
    outfit.thumbnailPublicId = up.publicId;
  }

  Object.assign(outfit, rest);
  await outfit.save();

  res.json({ success: true, data: outfit });
});

export const deleteOutfit = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findOneAndDelete({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!outfit) throw ApiError.notFound('Khong tim thay outfit');

  await destroyImage(outfit.thumbnailPublicId);
  res.json({ success: true, message: 'Da xoa outfit' });
});

/**
 * POST /api/outfits/:id/wear
 * Danh dau da mac -> tang wearCount cho tat ca item trong outfit.
 */
export const markAsWorn = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findOne({ _id: req.params.id, owner: req.user!.sub });
  if (!outfit) throw ApiError.notFound('Khong tim thay outfit');

  await ClothingItem.updateMany(
    { _id: { $in: outfit.items.map((i) => i.item) } },
    { $inc: { wearCount: 1 }, $set: { lastWornAt: new Date() } }
  );

  res.json({ success: true, message: 'Da ghi nhan lan mac nay' });
});

/** GET /api/outfits/feed - OOTD cong khai cua moi nguoi. */
export const getPublicFeed = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Number(req.query.limit) || 12);

  const [outfits, total] = await Promise.all([
    Outfit.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'displayName avatarUrl')
      .select('name thumbnailUrl tags likeCount createdAt owner'),
    Outfit.countDocuments({ isPublic: true }),
  ]);

  res.json({
    success: true,
    data: outfits,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
