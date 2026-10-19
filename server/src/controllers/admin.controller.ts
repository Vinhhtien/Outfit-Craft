import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { Outfit } from '../models/Outfit.js';
import { Category } from '../models/Category.js';
import { AdminLog } from '../models/AdminLog.js';
import { CATEGORIES } from '../types/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const userFields = 'displayName email avatarUrl defaultCity role isActive isVerified lockReason createdAt updatedAt';
const reason = z.string().trim().min(3, 'Lý do cần ít nhất 3 ký tự.').max(500);
export const userStatusSchema = z.object({ isActive: z.boolean(), reason }).strict();
export const visibilitySchema = z.object({ isHidden: z.boolean(), reason }).strict();
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  layerOrder: z.number().int().min(0).max(100),
  defaultTempMin: z.number().finite().min(-50).max(60),
  defaultTempMax: z.number().finite().min(-50).max(60),
}).strict();

function objectId(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw ApiError.badRequest('Mã đối tượng không hợp lệ.');
  return new Types.ObjectId(value);
}
function search(req: Request) {
  const value = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  return value ? { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : undefined;
}
function paging(req: Request) {
  const raw = Number(req.query.page);
  return { page: Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 100000) : 1, limit: 12 };
}
function paginated(res: Response, data: unknown, total: number, page: number, limit: number) {
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// Persist the intent before changing data so an interrupted operation remains traceable.
async function audited(req: Request, details: { action: string; targetId: string; targetName: string; reason?: string; changes?: unknown }, mutate: () => Promise<unknown>) {
  const log = await AdminLog.create({ ...details, actor: req.user!.sub, actorName: req.adminName });
  let result: unknown;
  try {
    result = await mutate();
  } catch (error) {
    await AdminLog.updateOne({ _id: log._id, status: 'pending' }, { $set: { status: 'failed' } }).catch(console.error);
    throw error;
  }
  await AdminLog.updateOne({ _id: log._id }, { $set: { status: 'completed' } });
  return result;
}

export const dashboard = asyncHandler(async (_req, res) => {
  const [users, items, outfits, lockedUsers, publicOutfits, hiddenOutfits, recentLogs] = await Promise.all([
    User.countDocuments(), ClothingItem.countDocuments(), Outfit.countDocuments(),
    User.countDocuments({ isActive: false }), Outfit.countDocuments({ isPublic: true }),
    Outfit.countDocuments({ isPublic: true, isHidden: true }),
    AdminLog.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
  ]);
  res.json({ success: true, data: { users, items, outfits, lockedUsers, publicOutfits, hiddenOutfits, recentLogs } });
});

export const users = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req);
  const filter: Record<string, unknown> = {};
  const q = search(req);
  if (q) filter.$or = [{ displayName: q }, { email: q }];
  if (req.query.status === 'locked') filter.isActive = false;
  if (req.query.status === 'active') filter.isActive = { $ne: false };
  if (req.query.status === 'unverified') filter.isVerified = false;
  const [data, total] = await Promise.all([
    User.find(filter).select(userFields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  paginated(res, data, total, page, limit);
});

export const userDetail = asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const user = await User.findById(id).select(userFields).lean();
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng.');
  const [items, outfits] = await Promise.all([ClothingItem.countDocuments({ owner: id }), Outfit.countDocuments({ owner: id })]);
  res.json({ success: true, data: { ...user, itemCount: items, outfitCount: outfits } });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const user = await User.findById(id).select(userFields);
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng.');
  // Admin accounts are protected: no self-lock or loss of the last administrator.
  if (user.role === 'admin' || id.toString() === req.user!.sub) throw ApiError.forbidden('Không thể khóa hoặc thay đổi trạng thái tài khoản quản trị viên.');
  if (user.isActive === req.body.isActive) throw ApiError.conflict('Tài khoản đã ở trạng thái này. Vui lòng tải lại danh sách.');
  const result = await audited(req, {
    action: req.body.isActive ? 'unlock_user' : 'lock_user', targetId: id.toString(), targetName: user.email,
    reason: req.body.reason, changes: { before: { isActive: user.isActive }, after: { isActive: req.body.isActive } },
  }, async () => {
    user.isActive = req.body.isActive;
    user.lockReason = req.body.isActive ? '' : req.body.reason;
    return user.save();
  });
  res.json({ success: true, data: result });
});

export const categories = asyncHandler(async (_req, res) => {
  const [data, counts] = await Promise.all([
    Category.find({ code: { $in: CATEGORIES } }).sort({ layerOrder: 1 }).lean(),
    ClothingItem.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data: data.map((category) => ({ ...category, itemCount: counts.find((c) => c._id === category.code)?.count ?? 0 })) });
});

export const updateCategory = asyncHandler(async (req, res) => {
  if (!CATEGORIES.includes(req.params.code as typeof CATEGORIES[number])) throw ApiError.notFound('Không tìm thấy danh mục.');
  if (req.body.defaultTempMin > req.body.defaultTempMax) throw ApiError.badRequest('Nhiệt độ thấp nhất không được lớn hơn nhiệt độ cao nhất.');
  const category = await Category.findOne({ code: req.params.code });
  if (!category) throw ApiError.notFound('Không tìm thấy danh mục.');
  const result = await audited(req, {
    action: 'edit_category', targetId: category.code, targetName: category.name,
    changes: { before: { name: category.name, layerOrder: category.layerOrder, defaultTempMin: category.defaultTempMin, defaultTempMax: category.defaultTempMax }, after: req.body },
  }, async () => { Object.assign(category, req.body); return category.save(); });
  res.json({ success: true, data: result });
});

export const publicOutfits = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req);
  const filter: Record<string, unknown> = { isPublic: true };
  const q = search(req);
  if (q) {
    const owners = await User.find({ $or: [{ displayName: q }, { email: q }] }).distinct('_id');
    filter.$or = [{ name: q }, { owner: { $in: owners } }];
  }
  if (req.query.status === 'hidden') filter.isHidden = true;
  if (req.query.status === 'visible') filter.isHidden = { $ne: true };
  const [data, total] = await Promise.all([
    Outfit.find(filter).select('name thumbnailUrl owner isHidden moderationReason createdAt tags').populate('owner', 'displayName email').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Outfit.countDocuments(filter),
  ]);
  paginated(res, data, total, page, limit);
});

export const setOutfitVisibility = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findOne({ _id: objectId(req.params.id), isPublic: true });
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit công khai.');
  if (outfit.isHidden === req.body.isHidden) throw ApiError.conflict('Outfit đã ở trạng thái này. Vui lòng tải lại.');
  await audited(req, {
    action: req.body.isHidden ? 'hide_outfit' : 'show_outfit', targetId: outfit.id, targetName: outfit.name,
    reason: req.body.reason, changes: { before: { isHidden: outfit.isHidden }, after: { isHidden: req.body.isHidden } },
  }, async () => {
    outfit.isHidden = req.body.isHidden;
    outfit.moderationReason = req.body.isHidden ? req.body.reason : '';
    await outfit.save();
  });
  res.json({ success: true, message: 'Đã cập nhật trạng thái outfit.' });
});

export const logs = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req);
  const filter: Record<string, unknown> = {};
  const q = search(req);
  if (q) filter.$or = [{ actorName: q }, { targetName: q }];
  const [data, total] = await Promise.all([
    AdminLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminLog.countDocuments(filter),
  ]);
  paginated(res, data, total, page, limit);
});

export const categoryConfig = asyncHandler(async (_req, res) => {
  const data = await Category.find({ code: { $in: CATEGORIES } }).select('code name layerOrder defaultTempMin defaultTempMax').sort({ layerOrder: 1 }).lean();
  res.json({ success: true, data });
});
