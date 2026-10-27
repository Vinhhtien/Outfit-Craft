import { z } from 'zod';
import { Types } from 'mongoose';
import { WishlistItem, WISHLIST_PRIORITIES } from '../models/WishlistItem.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CATEGORIES } from '../types/index.js';

const optionalUrl = z.preprocess((val) => {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}, z.string().url('Đường dẫn URL không hợp lệ').optional());

const optionalImage = z.preprocess((val) => {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}, z.string().refine((val) => {
  if (!val) return true;
  if (val.startsWith('data:image/')) return true;
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
}, { message: 'Ảnh sản phẩm phải là link URL hợp lệ hoặc file ảnh tải lên' }).default(''));

export const createWishlistSchema = z.object({
  name: z.string().trim().min(1, 'Tên món đồ không được để trống').max(100),
  category: z.enum(CATEGORIES),
  imageUrl: optionalImage,
  productUrl: optionalUrl,
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
  name: z.string().trim().optional().default(''),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default([]),
});

function cleanText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYMS: Record<string, string> = {
  phong: 'thun',
  tee: 'thun',
  tshirt: 'thun',
  bot: 'boot',
  boots: 'boot',
  sneakers: 'sneaker',
};

const STOP_WORDS = new Set([
  'ao', 'quan', 'giay', 'vay', 'dam', 'tui', 'mu', 'non', 'that', 'lung', 'khan',
  'cho', 'va', 'cua', 'dep', 'chiec', 'nam', 'nu', 'thoi', 'trang',
]);

function getKeywords(name: string): string[] {
  const words = cleanText(name)
    .split(' ')
    .filter((w) => w.length > 1);
  return words.map((w) => SYNONYMS[w] || w).filter((w) => !STOP_WORDS.has(w));
}

export function isSimilarItem(name1: string, name2: string): boolean {
  const c1 = cleanText(name1);
  const c2 = cleanText(name2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;

  const kw1 = getKeywords(name1);
  const kw2 = getKeywords(name2);
  if (kw1.length === 0 || kw2.length === 0) return false;

  const strKw1 = kw1.join(' ');
  const strKw2 = kw2.join(' ');
  if (strKw1 === strKw2) return true;
  if (strKw1.includes(strKw2) || strKw2.includes(strKw1)) return true;

  const set2 = new Set(kw2);
  const intersect = kw1.filter((w) => set2.has(w));
  const minLen = Math.min(kw1.length, kw2.length);
  const matchRatio = intersect.length / minLen;
  return matchRatio >= 0.6 && intersect.length >= 2;
}

/**
 * Kiem tra cac mon do trong tu co cung category va ten/loai tuong tu
 * (Chi canh bao khi mon do da co trong tu, khong canh bao theo trung lap mau sac).
 */
async function findDuplicateWardrobeItems(
  owner: string | Types.ObjectId,
  name: string | undefined,
  category: string
) {
  if (!name || name.trim().length < 2) {
    return [];
  }

  const items = await ClothingItem.find({
    owner,
    category,
    isArchived: false,
  }).sort({ wearCount: -1, createdAt: -1 });

  const matched = items.filter((item) => isSimilarItem(name, item.name));
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

      const duplicates = await findDuplicateWardrobeItems(owner, item.name, item.category);
      const hasDuplicate = duplicates.length > 0;

      return {
        ...itemObj,
        duplicates,
        hasDuplicate,
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
  const { category, name } = checkDuplicateSchema.parse(req.body);

  const duplicates = await findDuplicateWardrobeItems(owner, name, category);
  const hasDuplicate = duplicates.length > 0;

  res.json({
    success: true,
    data: {
      hasDuplicate,
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
  set: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v5h12V6.54a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/><path d="M6 13h12l-1.5 8.5h-3L12 17l-1.5 4.5h-3z"/></svg>',
  shoes: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18v3H3z"/><path d="M3 17l4-9h4l2 5h5a3 3 0 0 1 3 4"/></svg>',
  bag: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V6a6 6 0 0 1 12 0v2"/><rect width="18" height="14" x="3" y="8" rx="2"/></svg>',
  accessory: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%231F453E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 9v6"/></svg>',
};

/**
 * POST /api/wishlist - Them mon do vao wishlist
 */
export const createWishlistItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = createWishlistSchema.parse(req.body);

  // Khong tu dong lay anh tu Unsplash. Neu nguoi dung khong cung cap anh thi de trong ('').
  const imageUrl = body.imageUrl?.trim() || '';

  const wishlistItem = await WishlistItem.create({
    ...body,
    imageUrl,
    owner,
  });

  const duplicates = await findDuplicateWardrobeItems(owner, wishlistItem.name, wishlistItem.category);
  const hasDuplicate = duplicates.length > 0;

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

  const duplicates = await findDuplicateWardrobeItems(owner, item.name, item.category);
  const hasDuplicate = duplicates.length > 0;

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

  // Su dung hinh silhouette trong suot (SVG) neu wishlist chua co anh,
  // tranh viec loi tren canvas Studio va dam bao ClothingItem co anh hop le.
  const fallbackImage =
    CATEGORY_TRANSPARENT_PLACEHOLDERS[wishlistItem.category] ||
    CATEGORY_TRANSPARENT_PLACEHOLDERS.top;
  const itemImageUrl =
    wishlistItem.imageUrl && wishlistItem.imageUrl.trim()
      ? wishlistItem.imageUrl
      : fallbackImage;

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
