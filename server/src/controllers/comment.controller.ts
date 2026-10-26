import { z } from 'zod';
import { Comment } from '../models/Comment.js';
import { Outfit } from '../models/Outfit.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Nội dung bình luận không được để trống.')
    .max(500, 'Bình luận tối đa 500 ký tự.'),
});

/**
 * GET /api/outfits/:id/comments
 * Lay danh sach tat ca binh luan cua 1 outfit.
 */
export const getOutfitComments = asyncHandler(async (req, res) => {
  const outfit = await Outfit.findById(req.params.id);
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  if (outfit.isHidden) {
    throw ApiError.forbidden('Bộ đồ này đã bị ẩn bởi quản trị viên.');
  }

  const userId = req.user?.sub;
  const isOwner = userId && outfit.owner.toString() === userId;
  if (!outfit.isPublic && !isOwner) {
    throw ApiError.forbidden('Không thể xem bình luận của bộ đồ riêng tư.');
  }

  const comments = await Comment.find({ outfit: outfit._id })
    .sort({ createdAt: 1 })
    .populate('user', 'displayName avatarUrl')
    .lean();

  res.json({ success: true, data: comments });
});

/**
 * POST /api/outfits/:id/comments
 * Gui binh luan moi cho 1 outfit.
 */
export const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const outfit = await Outfit.findById(req.params.id);
  if (!outfit) throw ApiError.notFound('Không tìm thấy outfit.');

  if (outfit.isHidden) {
    throw ApiError.forbidden('Bộ đồ này đã bị ẩn bởi quản trị viên.');
  }

  const isOwner = outfit.owner.toString() === req.user!.sub;
  if (!outfit.isPublic && !isOwner) {
    throw ApiError.forbidden('Không thể bình luận trên bộ đồ riêng tư.');
  }

  const comment = await Comment.create({
    user: req.user!.sub,
    outfit: outfit._id,
    content: content.trim(),
  });

  const populated = await comment.populate('user', 'displayName avatarUrl');

  res.status(201).json({
    success: true,
    data: populated,
    message: 'Đã thêm bình luận.',
  });
});

/**
 * DELETE /api/outfits/:id/comments/:commentId
 * Xoa binh luan (chi tac gia binh luan hoac chu so huu outfit moi duoc xoa).
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound('Không tìm thấy bình luận.');

  const isAuthor = comment.user.toString() === req.user!.sub;
  const outfit = await Outfit.findById(comment.outfit);
  const isOutfitOwner = outfit?.owner.toString() === req.user!.sub;

  if (!isAuthor && !isOutfitOwner) {
    throw ApiError.forbidden('Bạn không có quyền xóa bình luận này.');
  }

  await comment.deleteOne();
  res.json({ success: true, message: 'Đã xóa bình luận.' });
});
