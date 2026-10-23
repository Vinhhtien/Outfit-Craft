'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Luggage,
  Calendar,
  MapPin,
  CloudSun,
  Umbrella,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Shirt,
  ShieldCheck,
  Check,
  PackageCheck,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { travelApi } from '@/lib/services';
import { useCategoryLabels } from '@/store/categoryStore';
import type {
  TravelTrip,
  TravelItem,
  TravelPackingSuggestions,
  TravelItemCategory,
  ClothingItem,
} from '@/types';

const CATEGORY_NAMES: Record<TravelItemCategory, string> = {
  top: 'Áo',
  bottom: 'Quần / Váy',
  outerwear: 'Áo khoác',
  dress: 'Váy liền',
  shoes: 'Giày dép',
  bag: 'Túi xách',
  accessory: 'Phụ kiện',
  personal: 'Vệ sinh & Chăm sóc',
  documents: 'Giấy tờ & Tiền',
  electronics: 'Đồ điện tử',
  medical: 'Y tế dự phòng',
};

export function TripPackingView({
  tripId,
  onBack,
  onDeleted,
}: {
  tripId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [trip, setTrip] = useState<TravelTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<TravelPackingSuggestions | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestionsTab, setShowSuggestionsTab] = useState(false);

  // Quick add item state
  const [customName, setCustomName] = useState('');
  const [customCat, setCustomCat] = useState<TravelItemCategory>('personal');
  const [addingItem, setAddingItem] = useState(false);

  // Active category filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isPending, startTransition] = useTransition();

  const loadTrip = async () => {
    try {
      setLoading(true);
      const data = await travelApi.getById(tripId);
      setTrip(data);
    } catch {
      setError('Không thể tải thông tin chuyến đi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrip();
  }, [tripId]);

  // Load smart suggestions when trip is ready
  useEffect(() => {
    if (!trip) return;
    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const data = await travelApi.getSuggestions({
          destination: trip.destination,
          durationDays: trip.durationDays,
          tripType: trip.tripType,
        });
        setSuggestions(data);
      } catch {
        // silent fail
      } finally {
        setLoadingSuggestions(false);
      }
    };
    void fetchSuggestions();
  }, [trip?.destination, trip?.durationDays, trip?.tripType]);

  const handleTogglePacked = async (item: TravelItem) => {
    if (!trip) return;
    const newStatus = !item.isPacked;

    // Optimistic UI update
    setTrip((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((i) =>
        i._id === item._id ? { ...i, isPacked: newStatus } : i
      );
      const packedCount = updatedItems.filter((i) => i.isPacked).length;
      return {
        ...prev,
        items: updatedItems,
        packedItems: packedCount,
        packedPercentage: Math.round((packedCount / updatedItems.length) * 100),
      };
    });

    try {
      await travelApi.updateItem(trip._id, item._id, { isPacked: newStatus });
    } catch {
      void loadTrip();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!trip) return;
    try {
      const res = await travelApi.removeItem(trip._id, itemId);
      setTrip(res);
    } catch {
      // silent fail
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip || !customName.trim()) return;

    setAddingItem(true);
    try {
      const res = await travelApi.addItem(trip._id, {
        name: customName.trim(),
        category: customCat,
        quantity: 1,
      });
      setTrip(res);
      setCustomName('');
    } catch {
      // silent
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddWardrobeItem = async (item: ClothingItem) => {
    if (!trip) return;
    try {
      const res = await travelApi.addItem(trip._id, {
        clothingItemId: item._id,
        name: item.name,
        category: (item.category as TravelItemCategory) || 'top',
        imageUrl: item.imageUrl || item.originalImageUrl,
        quantity: 1,
      });
      setTrip(res);
    } catch {
      // silent
    }
  };

  const handleAddEssentialItem = async (ess: { name: string; category: TravelItemCategory }) => {
    if (!trip) return;
    try {
      const res = await travelApi.addItem(trip._id, {
        name: ess.name,
        category: ess.category,
        quantity: 1,
      });
      setTrip(res);
    } catch {
      // silent
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) return;
    if (!confirm(`Bạn có chắc muốn xóa chuyến đi "${trip.title}" không?`)) return;

    try {
      await travelApi.remove(trip._id);
      onDeleted();
    } catch {
      alert('Không thể xóa chuyến đi.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm font-semibold text-[#6B7B76]">Đang tải kế hoạch chuyến đi &amp; vali...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="text-sm text-red-600">{error || 'Không tìm thấy chuyến đi.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#1F453E] px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft size={14} /> Quay lại danh sách
        </button>
      </div>
    );
  }

  const weather = trip.weatherSnapshot;
  const filteredItems =
    categoryFilter === 'all'
      ? trip.items
      : categoryFilter === 'clothing'
      ? trip.items.filter((i) =>
          ['top', 'bottom', 'outerwear', 'dress', 'shoes', 'bag', 'accessory'].includes(i.category)
        )
      : categoryFilter === 'essentials'
      ? trip.items.filter((i) =>
          ['personal', 'documents', 'electronics', 'medical'].includes(i.category)
        )
      : trip.items.filter((i) => i.category === categoryFilter);

  const isAllPacked = trip.totalItems > 0 && trip.packedItems === trip.totalItems;

  return (
    <div className="space-y-6">
      {/* Top Header & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F453E]/10 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F453E] transition-colors hover:bg-[#FAF9F5]"
        >
          <ArrowLeft size={14} /> Danh sách chuyến đi
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSuggestionsTab(!showSuggestionsTab)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              showSuggestionsTab
                ? 'bg-[#1F453E] text-white shadow-xs'
                : 'border border-[#1F453E] bg-[#E2ECC8] text-[#1F453E] hover:bg-[#d8e4bd]'
            }`}
          >
            <Sparkles size={14} />
            {showSuggestionsTab ? 'Ẩn gợi ý tủ đồ' : '✨ Gợi ý đồ theo thời tiết'}
          </button>

          <button
            type="button"
            onClick={handleDeleteTrip}
            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50"
            title="Xóa chuyến đi này"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Hero Banner: Tiêu đề, Điểm đến & Thời tiết nơi đến */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cột 1: Thông tin chuyến đi */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E2ECC8] px-3 py-1 text-xs font-bold text-[#1F453E]">
                <MapPin size={13} /> {trip.destination}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#52665F]">
                {trip.durationDays} ngày {Math.max(1, trip.durationDays - 1)} đêm
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">
                {trip.tripType === 'beach'
                  ? '🌊 Đi biển'
                  : trip.tripType === 'winter'
                  ? '❄️ Xứ lạnh'
                  : trip.tripType === 'trekking'
                  ? '🥾 Dã ngoại'
                  : '🏖️ Nghỉ dưỡng'}
              </span>
            </div>

            <h2 className="font-serif-display text-2xl font-bold text-[#1F453E] sm:text-3xl">
              {trip.title}
            </h2>

            <div className="flex items-center gap-2 text-xs text-[#6B7B76]">
              <Calendar size={14} />
              <span>
                {new Date(trip.startDate).toLocaleDateString('vi-VN')} —{' '}
                {new Date(trip.endDate).toLocaleDateString('vi-VN')}
              </span>
            </div>

            {trip.notes && (
              <p className="text-xs text-[#52665F] italic bg-[#FAF9F5] p-2.5 rounded-xl border border-[#1F453E]/10">
                &ldquo;{trip.notes}&rdquo;
              </p>
            )}
          </div>

          {/* Cột 2: Thời tiết nơi đến (Tiêu điểm) */}
          <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-blue-50/60 p-5 text-sky-950">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                <CloudSun size={14} /> Thời tiết nơi đến
              </span>
              {weather?.isRaining && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  <Umbrella size={11} /> Có mưa
                </span>
              )}
            </div>

            {weather ? (
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-display text-4xl font-bold text-sky-950">
                    {weather.temp}°C
                  </span>
                  <span className="text-xs font-semibold text-sky-800 capitalize">
                    {weather.description}
                  </span>
                </div>
                <p className="mt-1 text-xs text-sky-700">
                  Cảm giác như {weather.feelsLike}°C · Độ ẩm {weather.humidity}%
                </p>

                {/* Lời khuyên thời tiết */}
                {suggestions?.weatherAdvice && (
                  <p className="mt-3 text-[11px] leading-relaxed text-sky-900 border-t border-sky-200/80 pt-2 font-medium">
                    💡 {suggestions.weatherAdvice}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-sky-700">
                Đang cập nhật dữ liệu thời tiết cho {trip.destination}...
              </p>
            )}
          </div>
        </div>

        {/* Thanh tiến độ đóng gói Vali */}
        <div className="mt-6 border-t border-[#1F453E]/10 pt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#1F453E]">
              Tiến độ đóng gói vali: {trip.packedItems} / {trip.totalItems} món ({trip.packedPercentage}%)
            </span>
            {isAllPacked && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 animate-in fade-in">
                <CheckCircle2 size={15} /> Vali đã đầy đủ 100%!
              </span>
            )}
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#E2ECC8]/60">
            <div
              className={`h-full transition-all duration-500 ${
                isAllPacked ? 'bg-emerald-600' : 'bg-[#1F453E]'
              }`}
              style={{ width: `${trip.packedPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* PANEL GỢI Ý ĐỒ TỪ TỦ ĐỒ (EXPANDABLE) */}
      {showSuggestionsTab && suggestions && (
        <div className="rounded-2xl border-2 border-[#1F453E]/30 bg-white p-6 shadow-md space-y-5 animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between border-b border-[#1F453E]/10 pb-3">
            <div className="flex items-center gap-2 text-[#1F453E]">
              <Sparkles size={20} className="text-amber-600" />
              <h3 className="font-serif-display text-lg font-bold">
                Gợi ý trang phục trong tủ hợp thời tiết {trip.destination} ({weather?.temp}°C)
              </h3>
            </div>
            <span className="text-xs text-[#6B7B76]">
              Tìm thấy {suggestions.totalMatchedWardrobeItems} món phù hợp
            </span>
          </div>

          {/* Gợi ý số lượng */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 text-center text-xs">
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Áo (Tops)</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.top} chiếc</p>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Quần / Váy</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.bottom} chiếc</p>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Áo khoác</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.outerwear} chiếc</p>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Giày dép</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.shoes} đôi</p>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Phụ kiện</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.accessory} món</p>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-2.5 border border-[#1F453E]/10">
              <span className="text-[10px] uppercase font-bold text-[#6B7B76]">Túi xách</span>
              <p className="font-bold text-base text-[#1F453E]">{suggestions.suggestedQuantities.bag} chiếc</p>
            </div>
          </div>

          {/* Lưới các món đồ trong tủ gợi ý */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F453E]">
              Bấm &ldquo;+ Xếp vào vali&rdquo; để thêm nhanh trang phục phù hợp:
            </h4>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(suggestions.wardrobeSuggestions).flatMap(([cat, catItems]) =>
                catItems.map((item) => {
                  const alreadyInTrip = trip.items.some(
                    (ti) => ti.clothingItem && String((ti.clothingItem as ClothingItem)._id || ti.clothingItem) === item._id
                  );

                  return (
                    <div
                      key={item._id}
                      className="flex items-center gap-2.5 rounded-xl border border-[#1F453E]/15 bg-[#FAF9F5] p-2 text-xs transition-all hover:shadow-xs"
                    >
                      <div className="h-12 w-12 shrink-0 grid place-items-center rounded-lg bg-white border border-[#CBD5E1]/60 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl || item.originalImageUrl}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#1F453E]" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#6B7B76]">
                          {CATEGORY_NAMES[item.category as TravelItemCategory] || item.category}
                        </p>
                        <button
                          type="button"
                          disabled={alreadyInTrip}
                          onClick={() => void handleAddWardrobeItem(item)}
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                            alreadyInTrip
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-[#1F453E] text-white hover:bg-[#16352F]'
                          }`}
                        >
                          {alreadyInTrip ? '✓ Đã có trong vali' : '+ Xếp vào vali'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Danh sách vật dụng thiết yếu chưa thêm */}
            <div className="border-t border-[#1F453E]/10 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F453E] mb-2.5">
                Vật dụng cá nhân thiết yếu gợi ý:
              </h4>
              <div className="flex flex-wrap gap-2">
                {suggestions.defaultEssentials.map((ess) => {
                  const alreadyInTrip = trip.items.some((ti) => ti.name.toLowerCase() === ess.name.toLowerCase());
                  return (
                    <button
                      key={ess.name}
                      type="button"
                      disabled={alreadyInTrip}
                      onClick={() => void handleAddEssentialItem(ess)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        alreadyInTrip
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 cursor-default'
                          : 'border-[#CBD5E1] bg-white text-[#1F453E] hover:border-[#1F453E]'
                      }`}
                    >
                      {alreadyInTrip ? <Check size={12} /> : <Plus size={12} />}
                      <span>{ess.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DANH SÁCH CHECKLIST TRANG PHỤC VÀ ĐỒ DÙNG */}
      <div className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-2xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F453E]/10 pb-4">
          {/* Lọc danh mục */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76] mr-1">
              Lọc danh sách:
            </span>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-[#1F453E] text-white'
                  : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
              }`}
            >
              Tất cả ({trip.items.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('clothing')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                categoryFilter === 'clothing'
                  ? 'bg-[#1F453E] text-white'
                  : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
              }`}
            >
              👗 Đồ mặc ({trip.items.filter((i) => ['top', 'bottom', 'outerwear', 'dress', 'shoes', 'bag', 'accessory'].includes(i.category)).length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('essentials')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                categoryFilter === 'essentials'
                  ? 'bg-[#1F453E] text-white'
                  : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
              }`}
            >
              💼 Đồ cá nhân &amp; Thiết yếu ({trip.items.filter((i) => ['personal', 'documents', 'electronics', 'medical'].includes(i.category)).length})
            </button>
          </div>

          <span className="text-xs font-medium text-[#52665F]">
            Đã xếp {trip.packedItems} / {trip.totalItems} món vào vali
          </span>
        </div>

        {/* Form thêm nhanh món đồ tự do */}
        <form onSubmit={handleAddCustomItem} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF9F5] p-3 border border-[#1F453E]/10">
          <input
            type="text"
            required
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="+ Thêm món đồ tự do cần mang theo (Ví dụ: Kính bơi, Áo mưa tiện lợi, Thuốc dị ứng...)"
            className="flex-1 min-w-[220px] rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#1F453E] focus:outline-none focus:border-[#1F453E]"
          />
          <select
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value as TravelItemCategory)}
            className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#1F453E] focus:outline-none"
          >
            {Object.entries(CATEGORY_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addingItem}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1F453E] px-4 py-2 text-xs font-bold text-white hover:bg-[#16352F] disabled:opacity-50"
          >
            <Plus size={14} /> Thêm vào vali
          </button>
        </form>

        {/* Danh sách các món đồ */}
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-[#6B7B76] text-xs">
            Chưa có món đồ nào trong danh mục này. Hãy bấm &ldquo;+ Thêm vào vali&rdquo; hoặc xem gợi ý đồ theo thời tiết!
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item._id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                  item.isPacked
                    ? 'border-emerald-200 bg-emerald-50/50 opacity-90'
                    : 'border-[#CBD5E1]/80 bg-white hover:border-[#1F453E]/40 shadow-2xs'
                }`}
              >
                {/* Checkbox & Thông tin */}
                <div
                  onClick={() => void handleTogglePacked(item)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                >
                  <button
                    type="button"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-all ${
                      item.isPacked
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-[#CBD5E1] bg-white hover:border-[#1F453E]'
                    }`}
                  >
                    {item.isPacked && <Check size={14} strokeWidth={3} />}
                  </button>

                  {/* Thumbnail nếu có */}
                  {item.imageUrl && (
                    <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-[#FAF9F5] border border-[#CBD5E1]/60 p-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-semibold ${
                        item.isPacked ? 'line-through text-[#6B7B76]' : 'text-[#1F453E]'
                      }`}
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#6B7B76]">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                        {CATEGORY_NAMES[item.category] || item.category}
                      </span>
                      {item.quantity > 1 && <span className="font-bold">x{item.quantity}</span>}
                      {item.note && <span className="truncate">· {item.note}</span>}
                    </div>
                  </div>
                </div>

                {/* Xóa */}
                <button
                  type="button"
                  onClick={() => void handleDeleteItem(item._id)}
                  className="text-slate-400 hover:text-red-500 p-1 shrink-0 transition-colors"
                  title="Xóa món này"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
