import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Outfit } from '../models/Outfit.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/users/:id
 * Lay thong tin ho so cong khai va cac ban phoi duoc chia se cua mot nguoi dung.
 */
export const getUserPublicProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID người dùng không hợp lệ.');
  }

  const user = await User.findById(id).select('displayName avatarUrl createdAt');
  if (!user) {
    throw ApiError.notFound('Không tìm thấy người dùng.');
  }

  // Lay cac ban phoi cong khai cua nguoi dung nay
  const publicOutfits = await Outfit.find({ owner: user._id, isPublic: true })
    .sort({ createdAt: -1 })
    .populate('items.item', 'name imageUrl category brand')
    .select('name thumbnailUrl tags seasons occasions likeCount createdAt items')
    .lean();

  const totalLikesReceived = publicOutfits.reduce(
    (sum, o) => sum + (o.likeCount || 0),
    0
  );

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      stats: {
        publicOutfitCount: publicOutfits.length,
        totalLikesReceived,
      },
      outfits: publicOutfits,
    },
  });
});
