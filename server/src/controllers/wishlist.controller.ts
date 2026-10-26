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

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Khoang cach mau mat nguoi cam nhan (redmean metric: 0 - 765).
 */
function colorDistance(hex1: string, hex2: string): number {
  if (hex1.toLowerCase() === hex2.toLowerCase()) return 0;
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return Infinity;
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;

  // Hai mau cung gan den (max < 55) -> xem nhu tuong dong (den / xam dam)
  if (Math.max(r1, g1, b1) < 55 && Math.max(r2, g2, b2) < 55) return 0;
  // Hai mau cung gan trang (min > 210) -> xem nhu tuong dong (trang / kem / be)
  if (Math.min(r1, g1, b1) > 210 && Math.min(r2, g2, b2) > 210) return 0;

  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (((512 + rmean) * dr * dr) >> 8) +
    4 * dg * dg +
    (((767 - rmean) * db * db) >> 8)
  );
}

function areColorsSimilar(c1: string, c2: string, threshold = 120): boolean {
  return colorDistance(c1, c2) <= threshold;
}

/**
 * Ham kiem tra cac mon do trong tu co cung category va mau sac tuong dong
 */
async function findDuplicateWardrobeItems(
  owner: string | Types.ObjectId,
  category: string,
  colors: string[]
) {
  const items = await ClothingItem.find({
    owner,
    category,
    isArchived: false,
  }).sort({ wearCount: -1, createdAt: -1 });

  if (colors.length === 0) {
    return items.slice(0, 5);
  }

  // Loc cac mon trong tu co chua it nhat 1 mau tuong dong voi mau cua wishlist
  const matched = items.filter((item) => {
    if (!item.colors || item.colors.length === 0) return false;
    return item.colors.some((itemColor) =>
      colors.some((targetColor) => areColorsSimilar(itemColor, targetColor))
    );
  });

  return matched.slice(0, 5);
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

const CATEGORY_TRANSPARENT_PLACEHOLDERS: Record<string, string> = {
  top: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
  bottom: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v3l-2 13h-4l-2-8-2 8H6L4 7V4z"/></svg>',
  outerwear: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 4-4h10l4 4-2 13H5L3 7z"/><path d="M12 3v17"/></svg>',
  dress: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l2 5-3 13H10L7 8l2-5z"/></svg>',
  shoes: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18v3H3z"/><path d="M3 17l4-9h4l2 5h5a3 3 0 0 1 3 4"/></svg>',
  bag: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V6a6 6 0 0 1 12 0v2"/><rect width="18" height="14" x="3" y="8" rx="2"/></svg>',
  accessory: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 9v6"/></svg>',
};

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

  // Atomic update de chong click dup / goi API song song tao trung lap mon do
  const wishlistItem = await WishlistItem.findOneAndUpdate(
    { _id: req.params.id, owner, isPurchased: { $ne: true } },
    { $set: { isPurchased: true, purchasedAt: new Date() } },
    { new: true }
  );

  if (!wishlistItem) {
    const exists = await WishlistItem.findOne({ _id: req.params.id, owner });
    if (!exists) throw ApiError.notFound('Không tìm thấy món đồ trong wishlist.');
    throw ApiError.badRequest('Món đồ này đã được chuyển vào tủ đồ rồi.');
  }

  // Su dung hinh silhouette trong suot (SVG) neu wishlist dung anh mac dinh chua tach nen,
  // tranh viec dua hinh chu nhat Unsplash len canvas Studio gay de che quan ao.
  const fallbackImage =
    CATEGORY_TRANSPARENT_PLACEHOLDERS[wishlistItem.category] ||
    CATEGORY_TRANSPARENT_PLACEHOLDERS.top;
  const isDefaultUnsplash =
    Boolean(wishlistItem.imageUrl) &&
    Object.values(DEFAULT_CATEGORY_IMAGES).some((u) =>
      wishlistItem.imageUrl?.includes(u.split('?')[0])
    );
  const itemImageUrl =
    !wishlistItem.imageUrl || isDefaultUnsplash ? fallbackImage : wishlistItem.imageUrl;

  // Tao ClothingItem moi trong tu do
  const wardrobeItem = await ClothingItem.create({
    owner,
    name: wishlistItem.name,
    category: wishlistItem.category,
    originalImageUrl: itemImageUrl,
    imageUrl: itemImageUrl,
    colors: wishlistItem.colors,
    brand: wishlistItem.brand,
    purchasePrice: wishlistItem.price,
    wearCount: 0,
    isArchived: false,
    notes: wishlistItem.notes,
  });

  res.json({
    success: true,
    message: `Đã đưa món "${wishlistItem.name}" vào tủ đồ của bạn thành công!`,
    data: {
      wishlistItem,
      wardrobeItem,
    },
  });
});
