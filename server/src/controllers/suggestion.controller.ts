import { z } from 'zod';
import { ClothingItem } from '../models/ClothingItem.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getWeather } from '../services/weather.service.js';
import { buildOutfitOptions, scoreItem } from '../services/suggestion.service.js';
import {
  getRuleAdvice, getStylistAdvice, readStylistIntent, toStylistBodyContext, writeStylistReply,
} from '../services/stylist.service.js';
import { COLOR_GROUPS, Occasion, OCCASIONS, SEASONS } from '../types/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cung moc voi man Don tu (getDeclutterSuggestions): >= 180 ngay chua mac. */
const DORMANT_DAYS = 180;

/** GET /api/suggestions/weather?city=Hanoi */
export const getWeatherInfo = asyncHandler(async (req, res) => {
  const city = String(req.query.city || '') ||
    (await User.findById(req.user!.sub))?.defaultCity || 'Hanoi';

  res.json({ success: true, data: await getWeather(city) });
});

const OUTFIT_KEY = /^[0-9a-f]{10}$/;
const MAX_SEEN_KEYS = 30;

/** Doc tham so dang "a,b,c"; gia tri ngoai danh sach -> 400. */
function listParam<T extends string>(raw: unknown, allowed: readonly T[], label: string): T[] {
  const values = String(raw ?? '').split(',').filter(Boolean);
  if (values.some((v) => !allowed.includes(v as T))) throw ApiError.badRequest(`${label} không hợp lệ.`);
  return values as T[];
}

/**
 * GET /api/suggestions?city=Hanoi&occasion=work&anchor=<id>&seasons=summer,autumn&colorGroups=red
 * Tra ve toi da 3 phuong an + loi tu van cua stylist.
 * shuffle=1&seen=<key,key>: boc ngau nhien trong nhom diem cao, dung loi khuyen rule-based (khong goi AI).
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
  const filters = {
    seasons: listParam(req.query.seasons, SEASONS, 'Mùa'),
    colorGroups: listParam(req.query.colorGroups, COLOR_GROUPS, 'Màu'),
  };
  const isShuffle = req.query.shuffle === '1';
  const seen = String(req.query.seen ?? '').split(',').filter((k) => OUTFIT_KEY.test(k)).slice(-MAX_SEEN_KEYS);

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
  const { options, weatherWarning, seasonWarning, missing } = buildOutfitOptions(items, weather, occasion, {
    anchor: anchorItem,
    filters,
    shuffle: isShuffle ? { seen } : undefined,
  });

  let anchor;
  let anchorContext;
  if (anchorItem) {
    const referenceDate = anchorItem.lastWornAt || anchorItem.createdAt;
    const daysInactive = Math.max(0, Math.floor((Date.now() - new Date(referenceDate).getTime()) / DAY_MS));
    const isDormant = daysInactive >= DORMANT_DAYS;
    anchor = { item: anchorItem, daysInactive, isDormant, weatherWarning, missing };
    anchorContext = { name: anchorItem.name, isDormant };
  }

  const { advice, source } = isShuffle
    ? getRuleAdvice(options[0], weather, anchorContext)
    : await getStylistAdvice(
        options[0],
        weather,
        occasion,
        toStylistBodyContext(user?.bodyProfile), // NEW: Body Profile
        anchorContext
      );

  res.json({
    success: true,
    data: {
      weather,
      suggestion: options[0],
      options,
      anchor,
      seasonWarning,
      missing,
      advice,
      adviceSource: source,
    },
  });
});

export const stylistChatSchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'stylist']),
    text: z.string().trim().min(1).max(1000),
  })).max(6).default([]),
  city: z.string().trim().max(100).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  seen: z.array(z.string().regex(OUTFIT_KEY)).max(MAX_SEEN_KEYS).default([]),
});

/**
 * POST /api/suggestions/chat
 * AI doc yeu cau -> logic goi y chon do that trong tu -> AI giai thich bo do.
 */
export const chatWithStylist = asyncHandler(async (req, res) => {
  const { message, history, city: cityInput, occasion: currentOccasion, seen } =
    req.body as z.infer<typeof stylistChatSchema>;
  const owner = req.user!.sub;
  const user = await User.findById(owner).select('+bodyProfile');
  const weather = await getWeather(cityInput || user?.defaultCity || 'Hanoi');

  const intent = await readStylistIntent(message, history, weather);
  if (!intent) {
    throw new ApiError(503, 'Stylist AI đang tạm nghỉ. Bạn vẫn có thể dùng bộ lọc và nút Xáo trộn ở tab Bộ đồ gợi ý.');
  }
  if (intent.intent === 'question') {
    res.json({ success: true, data: { reply: intent.reply, source: 'ai', weather } });
    return;
  }

  const items = await ClothingItem.find({ owner, isArchived: false });
  if (items.length === 0) {
    throw ApiError.badRequest('Tủ đồ của bạn đang trống. Hãy thêm vài món đồ trước.');
  }

  const occasion = intent.occasion ?? currentOccasion;
  const { options, seasonWarning, missing } = buildOutfitOptions(items, weather, occasion, {
    filters: { seasons: intent.seasons, colorGroups: intent.colorGroups, styles: intent.styles },
    shuffle: intent.wantsDifferent ? { seen } : undefined,
  });
  const notes = [...missing, ...(seasonWarning ? [seasonWarning] : [])];
  const { advice, source } = await writeStylistReply(
    message,
    options[0],
    weather,
    occasion,
    toStylistBodyContext(user?.bodyProfile),
    notes
  );

  res.json({
    success: true,
    data: { reply: advice, source, weather, suggestion: options[0], occasion, notes },
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
