import { z } from 'zod';
import { Outfit } from '../models/Outfit.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDataUrl, destroyImage, saveWithImages, queueImageCleanup } from '../services/upload.service.js';
import { SEASONS, OCCASIONS } from '../types/index.js';
// ===== NEW: OOTD Post =====
import { OotdPost } from '../models/OotdPost.js';
import { Like } from '../models/Like.js';
// ===== END NEW =====
// ===== NEW: Body Profile =====
import { mannequinSchema } from './bodyProfile.controller.js';
// ===== END NEW =====
// ===== NEW: Legacy scene3D =====
// Che do 3D da bo: outfit cu van con truong scene3D (chi doc) - xem models/Outfit.ts.

/**
 * Ban xem cong khai cua outfit (nguoi xem khong phai chu): bo snapshot dang nguoi
 * va bodySnapshot cua scene3D cu (co can nang + so do). Vi tri mon do van giu.
 */
export function toPublicOutfitView(outfit: Record<string, unknown>): Record<string, unknown> {
  const { mannequin: _hidden, scene3D, ...rest } = outfit;
  if (!scene3D || typeof scene3D !== 'object') {
    return scene3D === undefined ? rest : { ...rest, scene3D };
  }
  const { bodySnapshot: _body, ...scenePublic } = scene3D as Record<string, unknown>;
  return { ...rest, scene3D: scenePublic };
}

/** Moi itemId xuat hien trong items va scene3D.items (request moi khong con scene3D - xem createOutfitSchema). */
function outfitItemIds(body: {
  items?: { item: string }[];
  scene3D?: { items: { itemId: string }[] } | null;
}): string[] {
  return [
    ...(body.items ?? []).map((i) => i.item),
    ...(body.scene3D?.items ?? []).map((i) => i.itemId),
  ];
}
// ===== END NEW =====

const outfitItemSchema = z.object({
  item: z.string().length(24, 'itemId khong hop le'),
  left: z.number(),
  top: z.number(),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  angle: z.number().default(0),
  zIndex: z.number().default(0),
  flipX: z.boolean().optional(),
  // ===== NEW: Body Profile =====
  anchorRef: z.string().max(32).nullable().optional(),
  offset: z.object({ x: z.number(), y: z.number() }).optional(),
  // ===== END NEW =====
});

export const createOutfitSchema = z.object({
  creationKey: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  items: z.array(outfitItemSchema).min(1, 'Outfit phai co it nhat 1 mon do'),
  canvasJSON: z.record(z.unknown()).default({}),
  /** dataURL PNG export tu Fabric; server se day len Cloudinary. */
  thumbnailDataUrl: z.string().startsWith('data:image/').optional(),
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: z.array(z.enum(OCCASIONS)).default([]),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  // ===== NEW: Body Profile =====
  /** Snapshot dang nguoi luc phoi; null = tat mannequin. Khong gui = outfit kieu cu. */
  mannequin: mannequinSchema.nullable().optional(),
  // ===== END NEW =====
  // ===== NEW: Legacy scene3D =====
  /** Che do 3D da bo: tu choi moi gia tri (ke ca null) de khong ghi de/xoa scene3D cu. */
  scene3D: z
    .never({ errorMap: () => ({ message: 'Che do 3D da ngung ho tro: khong nhan truong scene3D' }) })
    .optional(),
  // ===== END NEW =====
});

export const updateOutfitSchema = createOutfitSchema.omit({ creationKey: true }).partial();

/** Chan viec ghep item cua nguoi khac vao outfit cua minh. */
async function assertOwnsItems(itemIds: string[], owner: string) {
  const count = await ClothingItem.countDocuments({
    _id: { $in: itemIds },
    owner,
  });
  if (count !== new Set(itemIds).size) {
    throw ApiError.badRequest('Có món đồ không tồn tại hoặc không thuộc về bạn.');
  }
}

export const createOutfit = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { thumbnailDataUrl, ...rest } = req.body;

  if (rest.creationKey) {
    const existing = await Outfit.findOne({ owner, creationKey: rest.creationKey });
    if (existing) { res.json({ success: true, data: existing }); return; }
  }
  await assertOwnsItems(outfitItemIds(rest), owner);

  const outfit = await saveWithImages(
    thumbnailDataUrl ? [() => uploadDataUrl(thumbnailDataUrl, `outfitcraft/${owner}/outfits`)] : [],
    async ([image]) => {
      try { return await Outfit.create({ ...rest, owner, thumbnailUrl: image?.url, thumbnailPublicId: image?.publicId }); }
      catch (error) {
        if ((error as { code?: number }).code === 11000 && rest.creationKey) {
          const existing = await Outfit.findOne({ owner, creationKey: rest.creationKey });
          if (existing) { await destroyImage(image?.publicId); return existing; }
        }
        throw error;
      }
    }
  );

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
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  // Cho xem neu la chu so huu hoac outfit da cong khai.
  const isOwner = outfit.owner.toString() === req.user?.sub;
  if (!isOwner && !outfit.isPublic) throw ApiError.forbidden();

  // ===== NEW: Body Profile =====
  // Snapshot mannequin la du lieu dang nguoi -> chi chu so huu duoc thay.
  if (!isOwner) {
    // Bo ca scene3D.bodySnapshot cua outfit 3D cu (can nang, so do vong).
    return res.json({ success: true, data: toPublicOutfitView(outfit.toJSON()) });
  }
  // ===== END NEW =====

  res.json({ success: true, data: outfit });
});

export const updateOutfit = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { thumbnailDataUrl, ...rest } = req.body;

  const outfit = await Outfit.findOne({ _id: req.params.id, owner });
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  if (rest.items) {
    await assertOwnsItems(outfitItemIds(rest), owner);
  }

  const oldPublicId = outfit.thumbnailPublicId;
  await saveWithImages(
    thumbnailDataUrl ? [() => uploadDataUrl(thumbnailDataUrl, `outfitcraft/${owner}/outfits`)] : [],
    async ([image]) => {
      if (image) await queueImageCleanup([oldPublicId]);
      if (image) { outfit.thumbnailUrl = image.url; outfit.thumbnailPublicId = image.publicId; }
      Object.assign(outfit, rest);
      return outfit.save();
    }
  );
  if (thumbnailDataUrl && oldPublicId !== outfit.thumbnailPublicId) await destroyImage(oldPublicId);

  res.json({ success: true, data: outfit });
});

export const deleteOutfit = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findOne({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  await queueImageCleanup([outfit.thumbnailPublicId]);
  await outfit.deleteOne();

  // ===== NEW: OOTD Post =====
  // Xoa luon bai dang chia se outfit nay cung like cua bai, tranh du lieu mo coi.
  const postIds = await OotdPost.find({ outfit: outfit._id }).distinct('_id');
  if (postIds.length > 0) {
    await Promise.all([
      Like.deleteMany({ post: { $in: postIds } }),
      OotdPost.deleteMany({ _id: { $in: postIds } }),
    ]);
  }
  // ===== END NEW =====

  await destroyImage(outfit.thumbnailPublicId);
  res.json({ success: true, message: 'Đã xóa outfit.' });
});

/**
 * POST /api/outfits/:id/wear
 * Danh dau da mac -> tang wearCount cho tat ca item trong outfit.
 */
export const markAsWorn = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findOne({ _id: req.params.id, owner: req.user!.sub });
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  await ClothingItem.updateMany(
    { _id: { $in: outfit.items.map((i) => i.item) } },
    { $inc: { wearCount: 1 }, $set: { lastWornAt: new Date() } }
  );

  res.json({ success: true, message: 'Đã ghi nhận lần mặc này.' });
});

/** GET /api/outfits/feed - OOTD cong khai cua moi nguoi. */
export const getPublicFeed = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Number(req.query.limit) || 12);

  const filter: Record<string, unknown> = { isPublic: true };

  if (req.query.season && SEASONS.includes(req.query.season as any)) {
    filter.seasons = req.query.season;
  }
  if (req.query.occasion && OCCASIONS.includes(req.query.occasion as any)) {
    filter.occasions = req.query.occasion;
  }
  if (req.query.tag && typeof req.query.tag === 'string') {
    filter.tags = req.query.tag.trim();
  }
  if (req.query.q && typeof req.query.q === 'string' && req.query.q.trim()) {
    filter.name = { $regex: req.query.q.trim(), $options: 'i' };
  }

  const [outfits, total] = await Promise.all([
    Outfit.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'displayName avatarUrl')
      .populate('items.item', 'name imageUrl category brand')
      .select('name thumbnailUrl tags seasons occasions likeCount createdAt owner items'),
    Outfit.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: outfits,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
