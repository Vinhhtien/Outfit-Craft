import { z } from 'zod';
import { Types } from 'mongoose';
import { WishlistItem, WISHLIST_PRIORITIES } from '../models/WishlistItem.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CATEGORIES } from '../types/index.js';

export const createWishlistSchema = z.object({
  name: z.string().trim().min(1, 'Tên món đồ không được để trống').max(100),
  category: z.enum(CATEGORIES),
  imageUrl: z.string().url().or(z.literal('')).optional(),
  productUrl: z.string().url().or(z.literal('')).optional(),
  price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10_000_000_000).optional()
  ),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default([]),
  brand: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  priority: z.enum(WISHLIST_PRIORITIES).default('medium'),
});

export const updateWishlistSchema = createWishlistSchema.partial().strict();

export const checkDuplicateSchema = z.object({
  category: z.enum(CATEGORIES),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default([]),
});

/**
 * Ham kiem tra cac mon do trong tu co cung category va mau sac tuong dong
 */
async function findDuplicateWardrobeItems(
  owner: string | Types.ObjectId,
  category: string,
  colors: string[]
) {
  if (colors.length === 0) {
    // Neu chua chon mau, tim xem da co bao nhieu do cung danh muc
    return ClothingItem.find({
      owner,
      category,
      isArchived: false,
    }).limit(5);
  }

  // Tim cac mon trong tu co cung category VA chua it nhat 1 mau trung
  return ClothingItem.find({
    owner,
    category,
    isArchived: false,
    colors: { $in: colors },
  }).limit(5);
}

/**
 * GET /api/wishlist - Lay danh sach wishlist kem canh bao trung cho tung mon
 */
export const getWishlist = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { category, priority, purchased } = req.query;

  const query: Record<string, unknown> = { owner };
  if (category && typeof category === 'string' && category !== 'all') {
    query.category = category;
  }
  if (priority && typeof priority === 'string' && priority !== 'all') {
    query.priority = priority;
  }
  if (purchased !== 'all') {
    query.isPurchased = purchased === 'true';
  }

  const items = await WishlistItem.find(query).sort({ isPurchased: 1, createdAt: -1 });

  // Tinh toan canh bao trung lap cho tung mon chua mua
  const itemsWithWarnings = await Promise.all(
    items.map(async (item) => {
      const itemObj = item.toObject();
      if (item.isPurchased) {
        return { ...itemObj, duplicates: [], hasDuplicate: false };
      }

      const duplicates = await findDuplicateWardrobeItems(owner, item.category, item.colors);
      const hasExactColorDuplicate = item.colors.length > 0 && duplicates.length > 0;

      return {
        ...itemObj,
        duplicates,
        hasDuplicate: hasExactColorDuplicate,
        duplicateCount: duplicates.length,
      };
    })
  );

  // Tinh toan thong ke tong quan
  const unpurchasedItems = itemsWithWarnings.filter((i) => !i.isPurchased);
  const totalEstimatedBudget = unpurchasedItems.reduce((sum, i) => sum + (i.price || 0), 0);
  const duplicateWarningCount = unpurchasedItems.filter((i) => i.hasDuplicate).length;

  res.json({
    success: true,
    data: {
      items: itemsWithWarnings,
      stats: {
        totalItems: items.length,
        unpurchasedCount: unpurchasedItems.length,
        totalEstimatedBudget,
        duplicateWarningCount,
      },
    },
  });
});

/**
 * POST /api/wishlist/check-duplicates - Kiem tra trung lap realtime truoc khi them
 */
export const checkDuplicates = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { category, colors } = checkDuplicateSchema.parse(req.body);

  const duplicates = await findDuplicateWardrobeItems(owner, category, colors);
  const hasExactDuplicate = colors.length > 0 && duplicates.length > 0;

  res.json({
    success: true,
    data: {
      hasDuplicate: hasExactDuplicate,
      duplicates,
      count: duplicates.length,
    },
  });
});

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  top: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
  bottom: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500',
  outerwear: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500',
  dress: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500',
  shoes: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500',
  bag: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500',
  accessory: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500',
};

/**
 * POST /api/wishlist - Them mon do vao wishlist
 */
export const createWishlistItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = createWishlistSchema.parse(req.body);

  // Dat anh mac dinh theo danh muc neu nguoi dung khong dien URL anh
  let imageUrl = body.imageUrl;
  if (!imageUrl) {
    imageUrl = DEFAULT_CATEGORY_IMAGES[body.category] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500';
  }

  const wishlistItem = await WishlistItem.create({
    ...body,
    imageUrl,
    owner,
  });

  const duplicates = await findDuplicateWardrobeItems(owner, wishlistItem.category, wishlistItem.colors);
  const hasDuplicate = wishlistItem.colors.length > 0 && duplicates.length > 0;

  res.status(201).json({
    success: true,
    data: {
      ...wishlistItem.toObject(),
      duplicates,
      hasDuplicate,
    },
  });
});

/**
 * PATCH /api/wishlist/:id - Sua mon do trong wishlist
 */
export const updateWishlistItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = updateWishlistSchema.parse(req.body);

  const item = await WishlistItem.findOneAndUpdate(
    { _id: req.params.id, owner },
    { $set: body },
    { new: true, runValidators: true }
  );

  if (!item) throw ApiError.notFound('Không tìm thấy món đồ trong danh sách mong muốn.');

  const duplicates = await findDuplicateWardrobeItems(owner, item.category, item.colors);
  const hasDuplicate = item.colors.length > 0 && duplicates.length > 0;

  res.json({
    success: true,
    data: {
      ...item.toObject(),
      duplicates,
      hasDuplicate,
    },
  });
});

/**
 * DELETE /api/wishlist/:id - Xoa mon do khoi wishlist
 */
export const deleteWishlistItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const item = await WishlistItem.findOneAndDelete({ _id: req.params.id, owner });
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ.');

  res.json({ success: true, message: 'Đã xóa khỏi danh sách mong muốn.' });
});

/**
 * POST /api/wishlist/:id/move-to-wardrobe - Danh dau da mua va chuyen vao tu do
 */
export const moveToWardrobe = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const wishlistItem = await WishlistItem.findOne({ _id: req.params.id, owner });
  if (!wishlistItem) throw ApiError.notFound('Không tìm thấy món đồ trong wishlist.');

  // Tao ClothingItem moi trong tu do
  const wardrobeItem = await ClothingItem.create({
    owner,
    name: wishlistItem.name,
    category: wishlistItem.category,
    originalImageUrl: wishlistItem.imageUrl || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500',
    imageUrl: wishlistItem.imageUrl || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500',
    colors: wishlistItem.colors,
    brand: wishlistItem.brand,
    purchasePrice: wishlistItem.price,
    wearCount: 0,
    isArchived: false,
    notes: wishlistItem.notes,
  });

  // Cap nhat trang thai wishlist
  wishlistItem.isPurchased = true;
  wishlistItem.purchasedAt = new Date();
  await wishlistItem.save();

  res.json({
    success: true,
    message: `Đã đưa món "${wishlistItem.name}" vào tủ đồ của bạn thành công!`,
    data: {
      wishlistItem,
      wardrobeItem,
    },
  });
});
