import { z } from 'zod';
import { Outfit } from '../models/Outfit.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDataUrl, destroyImage } from '../services/upload.service.js';
import { SEASONS, OCCASIONS } from '../types/index.js';
// ===== NEW: OOTD Post =====
import { OotdPost } from '../models/OotdPost.js';
import { Like } from '../models/Like.js';
// ===== END NEW =====
// ===== NEW: Body Profile =====
import { mannequinSchema } from './bodyProfile.controller.js';
// ===== END NEW =====
// ===== NEW: Body 3D =====
import { bodySnapshotSchema } from './bodyProfile.controller.js';
import { SCENE3D_MAX_ITEMS, SCENE3D_VERSION } from '../types/index.js';

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

const scene3DItemSchema = z
  .object({
    itemId: z.string().length(24, 'itemId khong hop le'),
    anchor: z.string().max(32).nullable(),
    offset: vec3,
    scale: z.number().positive().max(100),
    rotation: z.number().finite().default(0),
    layer: z.number().int().default(0),
    aspect: z.number().positive().max(20).optional(),
    flipX: z.boolean().optional(),
  })
  .strict();

export const scene3DSchema = z
  .object({
    version: z.literal(SCENE3D_VERSION),
    bodySnapshot: bodySnapshotSchema,
    showModel: z.boolean().default(true),
    items: z.array(scene3DItemSchema).max(SCENE3D_MAX_ITEMS),
    camera: z.object({ position: vec3, target: vec3 }).strict().optional(),
  })
  .strict();

/**
 * Ban xem cong khai cua outfit (nguoi xem khong phai chu): bo snapshot dang nguoi 2D
 * va bodySnapshot cua canh 3D (co can nang + so do). Vi tri mon do van giu.
 */
export function toPublicOutfitView(outfit: Record<string, unknown>): Record<string, unknown> {
  const { mannequin: _hidden, scene3D, ...rest } = outfit;
  if (!scene3D || typeof scene3D !== 'object') {
    return scene3D === undefined ? rest : { ...rest, scene3D };
  }
  const { bodySnapshot: _body, ...scenePublic } = scene3D as Record<string, unknown>;
  return { ...rest, scene3D: scenePublic };
}

/** Moi itemId xuat hien trong items (2D) va scene3D.items. */
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
  // ===== NEW: Body 3D =====
  /** Canh 3D; null = bo canh 3D (luu lai o che do 2D). Khong gui = outfit 2D kieu cu. */
  scene3D: scene3DSchema.nullable().optional(),
  // ===== END NEW =====
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

  await assertOwnsItems(outfitItemIds(rest), owner); // NEW: Body 3D - tinh ca scene3D.items

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

  // ===== NEW: Body Profile =====
  // Snapshot mannequin la du lieu dang nguoi -> chi chu so huu duoc thay.
  if (!isOwner) {
    // NEW: Body 3D - bo ca scene3D.bodySnapshot (can nang, so do vong).
    return res.json({ success: true, data: toPublicOutfitView(outfit.toJSON()) });
  }
  // ===== END NEW =====

  res.json({ success: true, data: outfit });
});

export const updateOutfit = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { thumbnailDataUrl, ...rest } = req.body;

  const outfit = await Outfit.findOne({ _id: req.params.id, owner });
  if (!outfit) throw ApiError.notFound('Khong tim thay outfit');

  // NEW: Body 3D - kiem tra ca mon do trong scene3D.
  if (rest.items || rest.scene3D) {
    await assertOwnsItems(outfitItemIds(rest), owner);
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
