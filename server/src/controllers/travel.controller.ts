import { z } from 'zod';
import { Types } from 'mongoose';
import { TravelTrip, TRIP_TYPES, TRAVEL_ITEM_CATEGORIES } from '../models/TravelTrip.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { getWeather, WeatherInfo } from '../services/weather.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createTripSchema = z.object({
  title: z.string().trim().min(1, 'Tên chuyến đi không được để trống').max(120),
  destination: z.string().trim().min(1, 'Điểm đến không được để trống').max(100),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  tripType: z.enum(TRIP_TYPES).default('leisure'),
  notes: z.string().trim().max(500).optional(),
  autoAddEssentials: z.boolean().default(true),
});

export const updateTripSchema = createTripSchema.partial();

export const addTravelItemSchema = z.object({
  clothingItemId: z.string().optional(),
  name: z.string().trim().min(1, 'Tên món đồ không được để trống').max(120),
  category: z.enum(TRAVEL_ITEM_CATEGORIES).default('personal'),
  imageUrl: z.string().url().or(z.literal('')).optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  note: z.string().trim().max(200).optional(),
});

export const batchAddItemsSchema = z.object({
  items: z.array(
    z.object({
      clothingItemId: z.string().optional(),
      name: z.string().trim().min(1).max(120),
      category: z.enum(TRAVEL_ITEM_CATEGORIES).default('personal'),
      imageUrl: z.string().optional(),
      quantity: z.number().int().min(1).max(99).default(1),
      note: z.string().optional(),
    })
  ).min(1, 'Danh sách món đồ không được rỗng'),
});

/** Danh sách đồ dùng thiết yếu mặc định cho mọi chuyến du lịch */
export const DEFAULT_ESSENTIALS = [
  { name: 'CCCD / Hộ chiếu & Giấy tờ tùy thân', category: 'documents', quantity: 1 },
  { name: 'Cáp sạc & Củ sạc điện thoại', category: 'electronics', quantity: 1 },
  { name: 'Sạc pin dự phòng', category: 'electronics', quantity: 1 },
  { name: 'Bàn chải & Kem đánh răng mini', category: 'personal', quantity: 1 },
  { name: 'Kem chống nắng & Dưỡng ẩm', category: 'personal', quantity: 1 },
  { name: 'Thuốc cá nhân (Hạ sốt, cảm cúm, đau bụng, urgo)', category: 'medical', quantity: 1 },
] as const;

/**
 * Tao loi khuyen trang phuc dua tren thoi tiet
 */
function generateWeatherAdvice(weather: WeatherInfo, tripType: string): string {
  const parts: string[] = [];

  if (weather.temp < 16) {
    parts.push(`Nhiệt độ tại ${weather.city} khá lạnh (~${weather.temp}°C). Bạn nên ưu tiên mang áo phao, áo trench coat dạ, áo len cổ lọ, khăn quàng và quần dài giữ ấm.`);
  } else if (weather.temp < 22) {
    parts.push(`Thời tiết tại ${weather.city} se se mát mẻ (~${weather.temp}°C). Rất thích hợp để diện áo blazer, cardigan mỏng, áo sơ mi dài tay hoặc áo hoodie.`);
  } else if (weather.temp <= 30) {
    parts.push(`Nhiệt độ tại ${weather.city} dễ chịu (~${weather.temp}°C). Bạn nên chọn trang phục thoáng mát như áo thun cotton, sơ mi cộc tay, chân váy hoặc quần lửng.`);
  } else {
    parts.push(`Thời tiết tại ${weather.city} khá nắng nóng (~${weather.temp}°C). Hãy mang đồ chất liệu lanh, đũi mát mẻ, mũ rộng vành, kính râm và kem chống nắng.`);
  }

  if (weather.isRaining) {
    parts.push('Dự báo có khả năng có mưa, bạn đừng quên mang theo ô gấp gọn hoặc áo khoác chống thấm nước!');
  }

  if (tripType === 'beach') {
    parts.push('Chuyến đi biển: Đừng quên đồ bơi, kính râm, dép xỏ ngón và túi xách tote nhẹ chống nước.');
  } else if (tripType === 'trekking') {
    parts.push('Chuyến dã ngoại/leo núi: Nên chuẩn bị giày thể thao có độ bám tốt, quần dài co giãn và tất cao cổ.');
  }

  return parts.join(' ');
}

/**
 * GET /api/travel - Danh sach cac chuyen di kem tien do dong goi vali
 */
export const getTrips = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const trips = await TravelTrip.find({ owner }).sort({ startDate: 1 });

  const formattedTrips = trips.map((t) => {
    const totalItems = t.items.length;
    const packedItems = t.items.filter((i) => i.isPacked).length;
    const packedPercentage = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
    const durationDays = Math.max(
      1,
      Math.ceil((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      ...t.toObject(),
      durationDays,
      totalItems,
      packedItems,
      packedPercentage,
    };
  });

  res.json({ success: true, data: formattedTrips });
});

/**
 * GET /api/travel/:id - Chi tiet chuyen di
 */
export const getTripById = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const trip = await TravelTrip.findOne({ _id: req.params.id, owner }).populate('items.clothingItem');

  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi này.');

  // Kiem tra neu can lam moi thoi tiet (da cu hon 3 tieng hoac chua co)
  const shouldRefresh =
    !trip.weatherSnapshot ||
    Date.now() - new Date(trip.weatherSnapshot.fetchedAt).getTime() > 3 * 60 * 60 * 1000;

  if (shouldRefresh) {
    try {
      const weather = await getWeather(trip.destination);
      trip.weatherSnapshot = {
        ...weather,
        fetchedAt: new Date(),
      };
      await trip.save();
    } catch {
      // silent fallback
    }
  }

  const totalItems = trip.items.length;
  const packedItems = trip.items.filter((i) => i.isPacked).length;
  const packedPercentage = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
  const durationDays = Math.max(
    1,
    Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
  );

  res.json({
    success: true,
    data: {
      ...trip.toObject(),
      durationDays,
      totalItems,
      packedItems,
      packedPercentage,
    },
  });
});

/**
 * POST /api/travel - Tao chuyen di moi kem snapshot thoi tiet
 */
export const createTrip = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = createTripSchema.parse(req.body);

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (endDate < startDate) {
    throw ApiError.badRequest('Ngày kết thúc phải sau hoặc cùng ngày với ngày khởi hành.');
  }

  // Lay thoi tiet diem den
  const weather = await getWeather(body.destination);

  // Tao danh sach do mac dinh neu autoAddEssentials = true
  const initialItems = [];
  if (body.autoAddEssentials) {
    for (const ess of DEFAULT_ESSENTIALS) {
      initialItems.push({
        name: ess.name,
        category: ess.category,
        quantity: ess.quantity,
        isPacked: false,
      });
    }
    if (weather.isRaining) {
      initialItems.push({
        name: 'Ô / Dù gấp gọn hoặc áo mưa nhẹ',
        category: 'accessory' as const,
        quantity: 1,
        isPacked: false,
        note: 'Dự báo nơi đến có mưa',
      });
    }
  }

  const trip = await TravelTrip.create({
    owner,
    title: body.title,
    destination: body.destination,
    startDate,
    endDate,
    tripType: body.tripType,
    notes: body.notes,
    weatherSnapshot: {
      ...weather,
      fetchedAt: new Date(),
    },
    items: initialItems,
  });

  res.status(201).json({ success: true, data: trip });
});

/**
 * PATCH /api/travel/:id - Cap nhat thong tin chuyen di
 */
export const updateTrip = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = updateTripSchema.parse(req.body);

  const trip = await TravelTrip.findOne({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  if (body.title !== undefined) trip.title = body.title;
  if (body.tripType !== undefined) trip.tripType = body.tripType;
  if (body.notes !== undefined) trip.notes = body.notes;
  if (body.startDate) trip.startDate = new Date(body.startDate);
  if (body.endDate) trip.endDate = new Date(body.endDate);

  if (trip.endDate < trip.startDate) {
    throw ApiError.badRequest('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
  }

  // Neu doi diem den thi fetch lai thoi tiet
  if (body.destination && body.destination !== trip.destination) {
    trip.destination = body.destination;
    const weather = await getWeather(trip.destination);
    trip.weatherSnapshot = {
      ...weather,
      fetchedAt: new Date(),
    };
  }

  await trip.save();
  res.json({ success: true, data: trip });
});

/**
 * DELETE /api/travel/:id - Xoa chuyen di
 */
export const deleteTrip = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const trip = await TravelTrip.findOneAndDelete({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  res.json({ success: true, message: 'Đã xóa chuyến đi.' });
});

/**
 * POST /api/travel/:id/items - Them mon do vao danh sach mang theo
 */
export const addTravelItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const body = addTravelItemSchema.parse(req.body);

  const trip = await TravelTrip.findOne({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  let imageUrl = body.imageUrl || '';
  if (body.clothingItemId && !imageUrl) {
    const wardrobeItem = await ClothingItem.findOne({ _id: body.clothingItemId, owner });
    if (wardrobeItem) {
      imageUrl = wardrobeItem.imageUrl || wardrobeItem.originalImageUrl;
    }
  }

  trip.items.push({
    _id: new Types.ObjectId(),
    clothingItem: body.clothingItemId ? new Types.ObjectId(body.clothingItemId) : undefined,
    name: body.name,
    category: body.category,
    imageUrl,
    quantity: body.quantity,
    isPacked: false,
    note: body.note,
  });

  await trip.save();
  res.status(201).json({ success: true, data: trip });
});

/**
 * PATCH /api/travel/:id/items/:itemId - Danh dau da dong goi / sua so luong
 */
export const updateTravelItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { isPacked, quantity, note } = req.body;

  const trip = await TravelTrip.findOne({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  const item = trip.items.find((i) => i._id.toString() === req.params.itemId);
  if (!item) throw ApiError.notFound('Không tìm thấy món đồ trong danh sách.');

  if (typeof isPacked === 'boolean') item.isPacked = isPacked;
  if (typeof quantity === 'number' && quantity >= 1) item.quantity = quantity;
  if (typeof note === 'string') item.note = note;

  await trip.save();
  res.json({ success: true, data: trip });
});

/**
 * DELETE /api/travel/:id/items/:itemId - Xoa mon do khoi danh sach
 */
export const removeTravelItem = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const trip = await TravelTrip.findOne({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  trip.items = trip.items.filter((i) => i._id.toString() !== req.params.itemId);
  await trip.save();

  res.json({ success: true, data: trip });
});

/**
 * POST /api/travel/:id/batch-add - Them nhieu mon vao danh sach 1 lan
 */
export const batchAddItems = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const { items } = batchAddItemsSchema.parse(req.body);

  const trip = await TravelTrip.findOne({ _id: req.params.id, owner });
  if (!trip) throw ApiError.notFound('Không tìm thấy chuyến đi.');

  for (const it of items) {
    trip.items.push({
      _id: new Types.ObjectId(),
      clothingItem: it.clothingItemId ? new Types.ObjectId(it.clothingItemId) : undefined,
      name: it.name,
      category: it.category,
      imageUrl: it.imageUrl || '',
      quantity: it.quantity || 1,
      isPacked: false,
      note: it.note,
    });
  }

  await trip.save();
  res.json({ success: true, data: trip });
});

/**
 * GET /api/travel/suggestions - Goi y do mang theo tu tu do phu hop thoi tiet diem den
 */
export const getPackingSuggestions = asyncHandler(async (req, res) => {
  const owner = req.user!.sub;
  const destination = (req.query.destination as string)?.trim() || 'Đà Lạt';
  const tripType = (req.query.tripType as string) || 'leisure';
  const durationDays = Number(req.query.durationDays) || 3;

  // 1. Lay thoi tiet thuc te cua diem den
  const weather = await getWeather(destination);

  // 2. Lay cac mon do trong tu phu hop voi nhiet do va dip di du lich
  const wardrobeItems = await ClothingItem.find({
    owner,
    isArchived: false,
    'tempRange.min': { $lte: weather.temp },
    'tempRange.max': { $gte: weather.temp },
  }).sort({ wearCount: -1 });

  // 3. Tinh toan loi khuyen va so luong trang phuc goi y
  const weatherAdvice = generateWeatherAdvice(weather, tripType);

  const suggestedQuantities = {
    top: durationDays + 1, // Du phong them 1 chiec
    bottom: Math.max(2, Math.ceil(durationDays / 2) + 1),
    outerwear: weather.temp < 24 ? (weather.temp < 18 ? 2 : 1) : 0,
    shoes: 2, // 1 doi di tren chan + 1 doi mang du phong/phu hop hoat dong
    accessory: 2,
    bag: 1,
  };

  // 4. Phan loai mon do trong tu
  const categorized = {
    top: wardrobeItems.filter((i) => i.category === 'top'),
    bottom: wardrobeItems.filter((i) => i.category === 'bottom'),
    outerwear: wardrobeItems.filter((i) => i.category === 'outerwear'),
    dress: wardrobeItems.filter((i) => i.category === 'dress'),
    shoes: wardrobeItems.filter((i) => i.category === 'shoes'),
    bag: wardrobeItems.filter((i) => i.category === 'bag'),
    accessory: wardrobeItems.filter((i) => i.category === 'accessory'),
  };

  res.json({
    success: true,
    data: {
      weather,
      weatherAdvice,
      suggestedQuantities,
      wardrobeSuggestions: categorized,
      totalMatchedWardrobeItems: wardrobeItems.length,
      defaultEssentials: DEFAULT_ESSENTIALS,
    },
  });
});
