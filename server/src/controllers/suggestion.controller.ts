import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { ClothingItem } from '../models/ClothingItem.js';
import {
  IStylistConversation, MAX_STYLIST_CONVERSATIONS, StylistConversation,
} from '../models/StylistConversation.js';
import { IStylistMessage, MAX_STYLIST_MESSAGES, StylistMessage } from '../models/StylistMessage.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getWeather } from '../services/weather.service.js';
import { buildOutfitOptions, scoreItem } from '../services/suggestion.service.js';
import {
  getRuleAdvice, getStylistAdvice, outfitItems, readStylistIntent, toStylistBodyContext, writeStylistReply,
} from '../services/stylist.service.js';
import { COLOR_GROUPS, Occasion, OCCASIONS, SEASONS } from '../types/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cung moc voi man Don tu (getDeclutterSuggestions): >= 180 ngay chua mac. */
const DORMANT_DAYS = 180;
const CHAT_TITLE_LENGTH = 60;
const CHAT_HISTORY_TURNS = 6;
const CHAT_HISTORY_TEXT_LENGTH = 1000;
const MAX_REPLY_LENGTH = 5000;

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
  /** Bo trong -> tao doan chat moi. */
  conversationId: z.string().regex(/^[0-9a-f]{24}$/i).optional(),
  city: z.string().trim().max(100).optional(),
  occasion: z.enum(OCCASIONS).optional(),
});

/** Chi tra ve doan chat cua chinh user; id sai hoac cua nguoi khac deu la 404. */
async function findConversation(id: string, owner: string) {
  const conversation = isValidObjectId(id) ? await StylistConversation.findOne({ _id: id, owner }) : null;
  if (!conversation) throw ApiError.notFound('Không tìm thấy đoạn chat này.');
  return conversation;
}

/** Chi luu luot chat thanh cong; AI loi thi khong de lai tin nhan hay doan chat rong. */
async function saveChatTurn(
  owner: string,
  existing: IStylistConversation | null,
  message: string,
  reply: Pick<IStylistMessage, 'text' | 'source'> & Partial<IStylistMessage>
) {
  const conversation = existing
    ?? await StylistConversation.create({ owner, title: message.split('\n')[0].slice(0, CHAT_TITLE_LENGTH) });
  const [, saved] = await StylistMessage.insertMany([
    { owner, conversation: conversation._id, role: 'user', text: message },
    { ...reply, owner, conversation: conversation._id, role: 'stylist', text: reply.text.slice(0, MAX_REPLY_LENGTH) },
  ]);
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const oldMessages = await StylistMessage.find({ conversation: conversation._id })
    .sort({ _id: -1 }).skip(MAX_STYLIST_MESSAGES).select('_id').lean();
  if (oldMessages.length > 0) await StylistMessage.deleteMany({ _id: { $in: oldMessages.map((m) => m._id) } });

  const oldConversations = await StylistConversation.find({ owner })
    .sort({ lastMessageAt: -1 }).skip(MAX_STYLIST_CONVERSATIONS).select('_id').lean();
  if (oldConversations.length > 0) {
    const ids = oldConversations.map((c) => c._id);
    await Promise.all([
      StylistMessage.deleteMany({ conversation: { $in: ids } }),
      StylistConversation.deleteMany({ _id: { $in: ids } }),
    ]);
  }

  return { conversation, message: await saved.populate('items') };
}

/** GET /api/suggestions/chats - danh sach doan chat, moi nhat truoc. */
export const listStylistChats = asyncHandler(async (req, res) => {
  const conversations = await StylistConversation.find({ owner: req.user!.sub })
    .sort({ lastMessageAt: -1 })
    .select('title lastMessageAt');
  res.json({ success: true, data: conversations });
});

/** GET /api/suggestions/chats/:id - tin nhan cua 1 doan chat, cu truoc moi sau. */
export const getStylistChat = asyncHandler(async (req, res) => {
  const conversation = await findConversation(req.params.id, req.user!.sub);
  const messages = await StylistMessage.find({ conversation: conversation._id })
    .sort({ _id: 1 })
    .populate('items');
  res.json({ success: true, data: messages });
});

/** DELETE /api/suggestions/chats/:id - xoa 1 doan chat va cac tin cua no. */
export const deleteStylistChat = asyncHandler(async (req, res) => {
  const conversation = await findConversation(req.params.id, req.user!.sub);
  await StylistMessage.deleteMany({ conversation: conversation._id });
  await conversation.deleteOne();
  res.json({ success: true, data: null });
});

/**
 * POST /api/suggestions/chat
 * AI doc yeu cau -> logic goi y chon do that trong tu -> AI giai thich bo do.
 * Lich su va cac bo da hien lay tu doan chat trong database, client khong can gui.
 */
export const chatWithStylist = asyncHandler(async (req, res) => {
  const { message, conversationId, city: cityInput, occasion: currentOccasion } =
    req.body as z.infer<typeof stylistChatSchema>;
  const owner = req.user!.sub;
  const conversation = conversationId ? await findConversation(conversationId, owner) : null;
  const user = await User.findById(owner).select('+bodyProfile');
  const weather = await getWeather(cityInput || user?.defaultCity || 'Hanoi');

  const recent = conversation
    ? await StylistMessage.find({ conversation: conversation._id })
        .sort({ _id: -1 }).limit(MAX_SEEN_KEYS).select('role text outfitKey').lean()
    : [];
  const history = recent.slice(0, CHAT_HISTORY_TURNS).reverse()
    .map((m) => ({ role: m.role, text: m.text.slice(0, CHAT_HISTORY_TEXT_LENGTH) }));
  const seen = recent.flatMap((m) => (m.outfitKey ? [m.outfitKey] : []));

  const intent = await readStylistIntent(message, history, weather);
  if (!intent) {
    throw new ApiError(503, 'Stylist AI đang tạm nghỉ. Bạn vẫn có thể dùng bộ lọc và nút Xáo trộn ở tab Bộ đồ gợi ý.');
  }
  if (intent.intent === 'question') {
    const saved = await saveChatTurn(owner, conversation, message, { text: intent.reply, source: 'ai' });
    res.json({ success: true, data: saved });
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

  const pieces = outfitItems(options[0]);
  const saved = await saveChatTurn(owner, conversation, message, {
    text: advice,
    source,
    notes,
    occasion,
    weather: { ...weather },
    items: pieces.map((item) => item._id),
    outfitKey: pieces.length > 0 ? options[0].key : undefined,
  });
  res.json({ success: true, data: saved });
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
