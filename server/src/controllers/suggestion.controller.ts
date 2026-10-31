import { ClothingItem } from '../models/ClothingItem.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getWeather } from '../services/weather.service.js';
import { buildAnchoredSuggestions, buildSuggestion, scoreItem } from '../services/suggestion.service.js';
import { getStylistAdvice, toStylistBodyContext } from '../services/stylist.service.js';
import { Occasion, OCCASIONS } from '../types/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cung moc voi man Don tu (getDeclutterSuggestions): >= 180 ngay chua mac. */
const DORMANT_DAYS = 180;

/** GET /api/suggestions/weather?city=Hanoi */
export const getWeatherInfo = asyncHandler(async (req, res) => {
  const city = String(req.query.city || '') ||
    (await User.findById(req.user!.sub))?.defaultCity || 'Hanoi';

  res.json({ success: true, data: await getWeather(city) });
});

/**
 * GET /api/suggestions?city=Hanoi&occasion=work
 * Tra ve 1 bo do goi y + loi tu van cua stylist.
 */
export const getSuggestion = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  // NEW: Body Profile - bodyProfile co select:false nen phai lay tuong minh.
  const user = await User.findById(owner).select('+bodyProfile');
  const city = String(req.query.city || '') || user?.defaultCity || 'Hanoi';

  const occasionRaw = req.query.occasion as string | undefined;
  if (occasionRaw && !OCCASIONS.includes(occasionRaw as Occasion)) {
    throw ApiError.badRequest(`Dip khong hop le. Chon 1 trong: ${OCCASIONS.join(', ')}`);
  }
  const occasion = occasionRaw as Occasion | undefined;

  const items = await ClothingItem.find({ owner, isArchived: false });
  if (items.length === 0) {
    throw ApiError.badRequest('Tủ đồ của bạn đang trống. Hãy thêm vài món đồ trước.');
  }

  // ?anchor=<itemId>: phoi quanh 1 mon co dinh (tu "Phoi voi mon nay" / Don tu).
  const anchorId = req.query.anchor ? String(req.query.anchor) : undefined;
  const anchorItem = anchorId ? items.find((i) => String(i._id) === anchorId) : undefined;
  if (anchorId && !anchorItem) {
    throw ApiError.notFound('Không tìm thấy món đồ để phối. Có thể món đã bị xoá hoặc lưu trữ.');
  }

  const weather = await getWeather(city);

  if (anchorItem) {
    const { options, weatherWarning, missing } = buildAnchoredSuggestions(anchorItem, items, weather, occasion);
    const referenceDate = anchorItem.lastWornAt || anchorItem.createdAt;
    const daysInactive = Math.max(0, Math.floor((Date.now() - new Date(referenceDate).getTime()) / DAY_MS));
    const isDormant = daysInactive >= DORMANT_DAYS;
    const { advice, source } = await getStylistAdvice(
      options[0],
      weather,
      occasion,
      toStylistBodyContext(user?.bodyProfile),
      { name: anchorItem.name, isDormant }
    );

    res.json({
      success: true,
      data: {
        weather,
        suggestion: options[0],
        options,
        anchor: { item: anchorItem, daysInactive, isDormant, weatherWarning, missing },
        advice,
        adviceSource: source,
      },
    });
    return;
  }

  const suggestion = buildSuggestion(items, weather, occasion);
  const { advice, source } = await getStylistAdvice(
    suggestion,
    weather,
    occasion,
    toStylistBodyContext(user?.bodyProfile) // NEW: Body Profile
  );

  res.json({
    success: true,
    data: { weather, suggestion, advice, adviceSource: source },
  });
});

/**
 * GET /api/suggestions/ranked?city=Hanoi&category=top
 * Danh sach item da cham diem - dung khi user muon tu chon.
 */
export const getRankedItems = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const user = await User.findById(owner);
  const city = String(req.query.city || '') || user?.defaultCity || 'Hanoi';
  const occasion = req.query.occasion as Occasion | undefined;

  const filter: Record<string, unknown> = { owner, isArchived: false };
  if (req.query.category) filter.category = req.query.category;

  const [items, weather] = await Promise.all([
    ClothingItem.find(filter),
    getWeather(city),
  ]);

  const ranked = items
    .map((i) => scoreItem(i, weather, occasion))
    .sort((a, b) => b.score - a.score);

  res.json({ success: true, data: { weather, items: ranked } });
});
