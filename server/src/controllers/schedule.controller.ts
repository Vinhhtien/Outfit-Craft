import { z } from 'zod';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { Outfit } from '../models/Outfit.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const scheduleSchema = z.object({
  outfit: z.string().length(24, 'outfitId khong hop le'),
  date: z.coerce.date(),
  note: z.string().max(300).optional(),
});

/** Chuan hoa ve 00:00 UTC de 1 ngay chi co 1 ban ghi. */
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** GET /api/schedule?from=2026-01-01&to=2026-01-31 */
export const getSchedule = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter: Record<string, unknown> = { owner: req.user!.sub };

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = startOfDayUTC(new Date(String(from)));
    if (to) range.$lte = startOfDayUTC(new Date(String(to)));
    filter.date = range;
  }

  const entries = await ScheduleEntry.find(filter)
    .sort({ date: 1 })
    .populate('outfit', 'name thumbnailUrl');

  res.json({ success: true, data: entries });
});

/**
 * POST /api/schedule
 * Upsert: gan lai outfit cho ngay da co se ghi de thay vi bao trung.
 */
export const setSchedule = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { outfit: outfitId, date, note } = req.body;

  if (!(await Outfit.exists({ _id: outfitId, owner }))) {
    throw ApiError.notFound('Khong tim thay outfit nay trong bo suu tap cua ban');
  }

  const entry = await ScheduleEntry.findOneAndUpdate(
    { owner, date: startOfDayUTC(date) },
    { outfit: outfitId, note, isWorn: false },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate('outfit', 'name thumbnailUrl');

  res.status(201).json({ success: true, data: entry });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const entry = await ScheduleEntry.findOneAndDelete({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!entry) throw ApiError.notFound('Khong tim thay lich nay');
  res.json({ success: true, message: 'Da xoa lich' });
});

/**
 * PATCH /api/schedule/:id/worn
 * Xac nhan da mac -> cong wearCount cho cac item cua outfit do.
 */
export const markScheduleWorn = asyncHandler(async (req, res) => {
  const entry = await ScheduleEntry.findOne({
    _id: req.params.id,
    owner: req.user!.sub,
  });
  if (!entry) throw ApiError.notFound('Khong tim thay lich nay');
  if (entry.isWorn) throw ApiError.badRequest('Lich nay da duoc danh dau truoc do');

  const outfit = await Outfit.findById(entry.outfit);
  if (outfit) {
    await ClothingItem.updateMany(
      { _id: { $in: outfit.items.map((i) => i.item) } },
      { $inc: { wearCount: 1 }, $set: { lastWornAt: entry.date } }
    );
  }

  entry.isWorn = true;
  await entry.save();

  res.json({ success: true, data: entry });
});
