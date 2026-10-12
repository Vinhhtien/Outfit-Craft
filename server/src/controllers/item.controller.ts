import { z } from 'zod';
import { Types } from 'mongoose';
import { ClothingItem } from '../models/ClothingItem.js';
import { Outfit } from '../models/Outfit.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadBuffer, destroyImage } from '../services/upload.service.js';
import { CATEGORIES, STYLES, SEASONS, OCCASIONS } from '../types/index.js';

export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(CATEGORIES),
  originalImageUrl: z.string().url(),
  imageUrl: z.string().url(),
  imagePublicId: z.string().optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default([]),
  styles: z.array(z.enum(STYLES)).default([]),
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: z.array(z.enum(OCCASIONS)).default([]),
  tempRange: z.object({ min: z.number(), max: z.number() }).optional(),
  brand: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// ===== NEW: Xem/Sua Item =====
/**
 * PATCH chi cho sua metadata. .strict() -> gui kem field la (imageUrl, wearCount,
 * isArchived, canvasJSON...) se bi 400 thay vi am tham ghi de.
 */
export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.enum(CATEGORIES),
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(10),
    styles: z.array(z.enum(STYLES)),
    seasons: z.array(z.enum(SEASONS)),
    occasions: z.array(z.enum(OCCASIONS)),
    // Chuoi rong = xoa thuong hieu / ghi chu.
    brand: z.string().trim().max(100),
    notes: z.string().trim().max(500),
  })
  .partial()
  .strict();
// ===== END NEW =====

// ===== NEW: Ghi nho fit =====
/** Anchor ma mon do co the bam - trung GROUP_RULES o client/src/lib/outfitPlacement.ts. */
const FIT_ANCHORS = ['neck', 'waist', 'hip', 'footBottom', 'hipRight'] as const;

/** PUT /api/items/:id/fit - null = xoa fit da luu (lan sau tu dat theo mac dinh). */
export const saveFitSchema = z
  .object({
    fit: z
      .object({
        category: z.enum(CATEGORIES),
        anchorRef: z.enum(FIT_ANCHORS),
        offsetX: z.number().finite().min(-5).max(5),
        offsetY: z.number().finite().min(-5).max(5),
        width: z.number().finite().positive().max(10),
        height: z.number().finite().positive().max(10),
      })
      .strict()
      .nullable(),
  })
  .strict();
// ===== END NEW =====

/**
 * POST /api/items/upload
 * Nhan file anh (da tach nen o client hoac anh goc), day len Cloudinary.
 * Tra ve URL de buoc sau goi POST /api/items luu metadata.
 */
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Chua chon file anh');

  // removeBackground=true -> nho Cloudinary tach nen (can add-on).
  // Mac dinh false vi luong chinh la tach nen o client.
  const removeBackground = req.body.removeBackground === 'true';

  const result = await uploadBuffer(
    req.file.buffer,
    `outfitcraft/${req.user!.sub}/items`,
    { removeBackground }
  );

  res.status(201).json({ success: true, data: result });
});

/** GET /api/items?category=top&style=casual&season=summer&q=... */
export const getItems = asyncHandler(async (req, res) => {
  const { category, style, season, occasion, color, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 24);

  const filter: Record<string, unknown> = {
    owner: req.user!.sub,
    isArchived: req.query.archived === 'true',
  };
  if (category) filter.category = category;
  if (style) filter.styles = style;
  if (season) filter.seasons = season;
  if (occasion) filter.occasions = occasion;
  if (color) filter.colors = color;
  if (q) filter.$text = { $search: String(q) };

  const [items, total] = await Promise.all([
    ClothingItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ClothingItem.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getItem = asyncHandler(async (req, res) => {
  const item = await ClothingItem.findOne({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!item) throw ApiError.notFound('Khong tim thay mon do');
  res.json({ success: true, data: item });
});

export const createItem = asyncHandler(async (req, res) => {
  const item = await ClothingItem.create({ ...req.body, owner: req.user!.sub });
  res.status(201).json({ success: true, data: item });
});

// ===== NEW: Xem/Sua Item =====
/** PATCH /api/items/:id - body da qua updateItemSchema nen chi con field metadata. */
export const updateItem = asyncHandler(async (req, res) => {
  if (Object.keys(req.body).length === 0) {
    throw ApiError.badRequest('Khong co thong tin nao de cap nhat');
  }

  const item = await ClothingItem.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!.sub },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  // ===== END NEW =====
  if (!item) throw ApiError.notFound('Khong tim thay mon do');
  res.json({ success: true, data: item });
});

// ===== NEW: Ghi nho fit =====
/** PUT /api/items/:id/fit - tach rieng khoi PATCH metadata (updateItemSchema van .strict()). */
export const saveFit = asyncHandler(async (req, res) => {
  const item = await ClothingItem.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!.sub },
    { $set: { fit: req.body.fit } },
    { new: true, runValidators: true }
  );
  if (!item) throw ApiError.notFound('Khong tim thay mon do');
  res.json({ success: true, data: item });
});
// ===== END NEW =====

/**
 * DELETE /api/items/:id
 * Neu item dang nam trong outfit nao do -> archive thay vi xoa han,
 * de khong lam vo layout cua outfit da luu.
 */
export const deleteItem = asyncHandler(async (req, res) => {
  const item = await ClothingItem.findOne({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!item) throw ApiError.notFound('Khong tim thay mon do');

  const usedCount = await Outfit.countDocuments({ 'items.item': item._id });
  if (usedCount > 0) {
    item.isArchived = true;
    await item.save();
    return res.json({
      success: true,
      message: `Mon do dang duoc dung trong ${usedCount} outfit nen da chuyen vao kho luu tru thay vi xoa han`,
      data: item,
    });
  }

  await destroyImage(item.imagePublicId);
  await item.deleteOne();
  res.json({ success: true, message: 'Da xoa mon do' });
});

/** GET /api/items/stats - so lieu cho dashboard. */
export const getStats = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;

  const [byCategory, total, mostWorn, neverWorn] = await Promise.all([
    ClothingItem.aggregate([
      { $match: { owner: new Types.ObjectId(owner), isArchived: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ClothingItem.countDocuments({ owner, isArchived: false }),
    ClothingItem.find({ owner, isArchived: false }).sort({ wearCount: -1 }).limit(5),
    ClothingItem.countDocuments({ owner, isArchived: false, wearCount: 0 }),
  ]);

  res.json({
    success: true,
    data: { total, byCategory, mostWorn, neverWorn },
  });
});
