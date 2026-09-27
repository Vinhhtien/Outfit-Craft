import { ClothingItem } from '../models/ClothingItem.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getWeather } from '../services/weather.service.js';
import { buildSuggestion, scoreItem } from '../services/suggestion.service.js';
import { getStylistAdvice } from '../services/stylist.service.js';
import { Occasion, OCCASIONS } from '../types/index.js';

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
  const user = await User.findById(owner);
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

  const weather = await getWeather(city);
  const suggestion = buildSuggestion(items, weather, occasion);
  const { advice, source } = await getStylistAdvice(suggestion, weather, occasion);

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
