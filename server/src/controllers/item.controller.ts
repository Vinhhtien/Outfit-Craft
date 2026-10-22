import { z } from 'zod';
import { Types } from 'mongoose';
import { ClothingItem } from '../models/ClothingItem.js';
import { Outfit } from '../models/Outfit.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadBuffer, destroyImage, saveWithImages, queueImageCleanup } from '../services/upload.service.js';
import { ownsImage, ownedImageIdFromUrl, validateImageBuffer } from '../utils/imageValidation.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { CATEGORIES, STYLES, SEASONS, OCCASIONS } from '../types/index.js';

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(CATEGORIES),
  originalImageUrl: z.string().url(),
  imageUrl: z.string().url(),
  imagePublicId: z.string().optional(),
  originalImagePublicId: z.string().optional(),
  imageReceipt: z.string().optional(),
  originalImageReceipt: z.string().optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default([]),
  styles: z.array(z.enum(STYLES)).default([]),
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: z.array(z.enum(OCCASIONS)).default([]),
  tempRange: z.object({ min: z.number(), max: z.number() }).optional(),
  brand: z.string().optional(),
  notes: z.string().max(500).optional(),
  purchasePrice: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10_000_000_000).optional()
  ),
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
    purchasePrice: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().min(0).max(10_000_000_000).optional()
    ),
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
  if (!req.file) throw ApiError.badRequest('Vui lòng chọn ảnh.');

  // removeBackground=true -> nho Cloudinary tach nen (can add-on).
  // Mac dinh false vi luong chinh la tach nen o client.
  const removeBackground = req.body.removeBackground === 'true';

  const result = await uploadBuffer(
    req.file.buffer,
    `outfitcraft/${req.user!.sub}/items`,
    { removeBackground }
  );

  const receipt = jwt.sign({ ...result, owner: req.user!.sub, purpose: 'item-upload' }, env.jwtSecret, { expiresIn: '1h' });
  res.status(201).json({ success: true, data: { ...result, receipt } });
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
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');
  res.json({ success: true, data: item });
});

export const createItem = asyncHandler(async (req, res) => {
  const { imageReceipt, originalImageReceipt, ...body } = req.body;
  // Legacy two-step API accepts only server-issued uploads belonging to this user.
  for (const [receipt, url, publicId] of [[imageReceipt, body.imageUrl, body.imagePublicId], [originalImageReceipt, body.originalImageUrl, body.originalImagePublicId]]) {
    try {
      const data = jwt.verify(receipt, env.jwtSecret) as jwt.JwtPayload;
      if (data.owner !== req.user!.sub || data.purpose !== 'item-upload' || data.url !== url || data.publicId !== publicId) throw new Error();
    } catch { throw ApiError.badRequest('Ảnh tải lên không hợp lệ hoặc đã hết hạn. Vui lòng tải lại ảnh.'); }
  }
  const category = await Category.findOne({ code: body.category });
  const tempRange = body.tempRange ?? (category ? { min: category.defaultTempMin, max: category.defaultTempMax } : undefined);
  const item = await ClothingItem.create({ ...body, tempRange, owner: req.user!.sub });
  res.status(201).json({ success: true, data: item });
});

const itemMetadataSchema = createItemSchema.omit({ imageUrl: true, originalImageUrl: true, imagePublicId: true, originalImagePublicId: true, imageReceipt: true, originalImageReceipt: true }).strict();
export const createItemWithImages = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const creationKey = z.string().uuid().parse(req.body.creationKey);
  const existing = await ClothingItem.findOne({ owner, creationKey });
  if (existing) { res.json({ success: true, data: existing }); return; }
  let metadata: unknown;
  try { metadata = JSON.parse(req.body.metadata); }
  catch { throw ApiError.badRequest('Thông tin món đồ không đúng định dạng.'); }
  const body = itemMetadataSchema.parse(metadata);
  if (!body.tempRange) {
    const category = await Category.findOne({ code: body.category });
    if (category) body.tempRange = { min: category.defaultTempMin, max: category.defaultTempMax };
  }
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const image = files?.image?.[0];
  const original = files?.original?.[0];
  if (!image || !original) throw ApiError.badRequest('Vui lòng chọn đủ ảnh gốc và ảnh đã tách nền.');
  validateImageBuffer(image.buffer);
  validateImageBuffer(original.buffer);
  try {
    const item = await saveWithImages([
      () => uploadBuffer(image.buffer, `outfitcraft/${owner}/items`),
      () => uploadBuffer(original.buffer, `outfitcraft/${owner}/items`),
    ], ([cutout, source]) => ClothingItem.create({ ...body, owner, creationKey, imageUrl: cutout.url, imagePublicId: cutout.publicId, originalImageUrl: source.url, originalImagePublicId: source.publicId }));
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    // Concurrent retries race on a unique key; only the winning record is returned.
    if ((error as { code?: number }).code === 11000) {
      const saved = await ClothingItem.findOne({ owner, creationKey });
      if (saved) { res.json({ success: true, data: saved }); return; }
    }
    throw error;
  }
});

// ===== NEW: Xem/Sua Item =====
/** PATCH /api/items/:id - body da qua updateItemSchema nen chi con field metadata. */
export const updateItem = asyncHandler(async (req, res) => {
  if (Object.keys(req.body).length === 0) {
    throw ApiError.badRequest('Không có thông tin nào để cập nhật.');
  }

  const item = await ClothingItem.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!.sub },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  // ===== END NEW =====
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');
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
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');
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
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');

  const usedCount = await Outfit.countDocuments({ 'items.item': item._id });
  if (usedCount > 0) {
    item.isArchived = true;
    await item.save();
    return res.json({
      success: true,
      message: `Món đồ đang được dùng trong ${usedCount} outfit nên đã chuyển vào kho lưu trữ thay vì xóa hẳn.`,
      data: item,
    });
  }

  const imageIds = [item.imagePublicId, item.originalImagePublicId ?? ownedImageIdFromUrl(item.originalImageUrl, req.user!.sub, env.cloudinary.cloudName)]
    .filter((id) => ownsImage(id, req.user!.sub));
  await queueImageCleanup(imageIds);
  await item.deleteOne();
  await Promise.all(imageIds.map((id) => destroyImage(id)));
  res.json({ success: true, message: 'Đã xóa món đồ.' });
});

/** GET /api/items/stats - so lieu cho dashboard. */
export const getStats = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;

  const [
    byCategory,
    total,
    mostWorn,
    neverWorn,
    neverWornItems,
    financialAgg,
    bestValueItems,
    wastefulItems,
  ] = await Promise.all([
    ClothingItem.aggregate([
      { $match: { owner: new Types.ObjectId(owner), isArchived: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ClothingItem.countDocuments({ owner, isArchived: false }),
    ClothingItem.find({ owner, isArchived: false }).sort({ wearCount: -1 }).limit(5),
    ClothingItem.countDocuments({ owner, isArchived: false, wearCount: 0 }),
    ClothingItem.find({ owner, isArchived: false, wearCount: 0 }).sort({ createdAt: -1 }).limit(20),
    ClothingItem.aggregate([
      {
        $match: {
          owner: new Types.ObjectId(owner),
          isArchived: false,
          purchasePrice: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$purchasePrice' },
          pricedCount: { $sum: 1 },
          avgPrice: { $avg: '$purchasePrice' },
        },
      },
    ]),
    // Top 5 món tối ưu chi phí nhất (CPW = purchasePrice / wearCount thấp nhất trong những món đã mặc)
    ClothingItem.aggregate([
      {
        $match: {
          owner: new Types.ObjectId(owner),
          isArchived: false,
          purchasePrice: { $gt: 0 },
          wearCount: { $gt: 0 },
        },
      },
      {
        $addFields: {
          costPerWear: { $round: [{ $divide: ['$purchasePrice', '$wearCount'] }, 0] },
        },
      },
      { $sort: { costPerWear: 1 } },
      { $limit: 5 },
    ]),
    // Top 5 món giá cao nhưng chưa mặc hoặc ít mặc nhất (wearCount <= 1)
    ClothingItem.find({
      owner,
      isArchived: false,
      purchasePrice: { $gt: 0 },
      wearCount: { $lte: 1 },
    })
      .sort({ purchasePrice: -1 })
      .limit(5),
  ]);

  const financial = financialAgg[0] || { totalValue: 0, pricedCount: 0, avgPrice: 0 };

  res.json({
    success: true,
    data: {
      total,
      byCategory,
      mostWorn,
      neverWorn,
      neverWornItems,
      financial: {
        totalValue: Math.round(financial.totalValue || 0),
        pricedCount: financial.pricedCount || 0,
        avgPrice: Math.round(financial.avgPrice || 0),
      },
      bestValueItems,
      wastefulItems,
    },
  });
});
