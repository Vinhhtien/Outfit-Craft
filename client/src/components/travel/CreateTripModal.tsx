'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Luggage,
  Calendar,
  MapPin,
  Sparkles,
  CloudSun,
  Umbrella,
  Check,
  AlertCircle,
} from 'lucide-react';
import { VModal, VInput, VSelect, VButton, VLabel } from '@/components/ui/vintage';
import { travelApi, weatherApi } from '@/lib/services';
import type { TripType, WeatherInfo } from '@/types';

const POPULAR_DESTINATIONS = [
  'Đà Nẵng',
  'Đà Lạt',
  'Hà Nội',
  'Sa Pa',
  'Phú Quốc',
  'Nha Trang',
  'Hội An',
  'Bangkok',
  'Tokyo',
];

const TRIP_TYPE_OPTIONS: { value: TripType; label: string }[] = [
  { value: 'leisure', label: '🏖️ Nghỉ dưỡng / Dạo phố' },
  { value: 'beach', label: '🌊 Đi biển / Du lịch hè' },
  { value: 'winter', label: '❄️ Mùa đông / Xứ lạnh' },
  { value: 'trekking', label: '🥾 Khám phá / Dã ngoại / Trekking' },
  { value: 'business', label: '💼 Công tác' },
  { value: 'other', label: '✨ Khác' },
];

export function CreateTripModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('Đà Nẵng');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripType, setTripType] = useState<TripType>('leisure');
  const [notes, setNotes] = useState('');
  const [autoAddEssentials, setAutoAddEssentials] = useState(true);

  // Weather preview state
  const [weatherPreview, setWeatherPreview] = useState<WeatherInfo | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const weatherTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set default dates: 3 days starting next Saturday
  useEffect(() => {
    if (open && !startDate) {
      const now = new Date();
      const start = new Date(now.getTime() + 86400000 * 3);
      const end = new Date(now.getTime() + 86400000 * 6);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [open, startDate]);

  // Debounced weather fetch when destination changes
  useEffect(() => {
    if (!open || !destination.trim()) return;
    if (weatherTimeoutRef.current) clearTimeout(weatherTimeoutRef.current);

    weatherTimeoutRef.current = setTimeout(async () => {
      try {
        setLoadingWeather(true);
        const data = await weatherApi.get(destination.trim());
        setWeatherPreview(data);
      } catch {
        setWeatherPreview(null);
      } finally {
        setLoadingWeather(false);
      }
    }, 400);

    return () => {
      if (weatherTimeoutRef.current) clearTimeout(weatherTimeoutRef.current);
    };
  }, [destination, open]);

  const reset = () => {
    setTitle('');
    setDestination('Đà Nẵng');
    setNotes('');
    setSaving(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError('Vui lòng nhập điểm đến.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Vui lòng chọn thời gian chuyến đi.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const tripTitle = title.trim() || `Chuyến đi ${destination.trim()}`;
      const res = await travelApi.create({
        title: tripTitle,
        destination: destination.trim(),
        startDate,
        endDate,
        tripType,
        notes: notes.trim() || undefined,
        autoAddEssentials,
      });

      onCreated(res._id);
      handleClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Không thể tạo chuyến đi. Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <VModal open={open} onClose={handleClose} title="Lên kế hoạch chuyến đi & Vali" wide busy={saving}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tên chuyến đi */}
        <VInput
          label="Tên chuyến đi (không bắt buộc)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Ví dụ: Kỳ nghỉ hè ${destination} 3 ngày 2 đêm`}
          maxLength={120}
        />

        {/* Điểm đến & gợi ý nhanh */}
        <div>
          <VInput
            label="Điểm đến (Thành phố / Tỉnh / Quốc gia)"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Ví dụ: Đà Lạt, Đà Nẵng, Sa Pa, Phú Quốc, Tokyo..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#6B7B76]">Gợi ý nhanh:</span>
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setDestination(dest)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  destination === dest
                    ? 'bg-[#1F453E] text-white'
                    : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
                }`}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>

        {/* Preview thời tiết nơi đến */}
        {destination.trim() && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-900 text-[10px]">
                <CloudSun size={14} /> Thời tiết dự báo tại nơi đến:
              </span>
              {loadingWeather && (
                <span className="text-[10px] text-sky-700 animate-pulse">Đang cập nhật...</span>
              )}
            </div>

            {weatherPreview ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-serif-display text-2xl font-bold text-sky-950">
                    {weatherPreview.temp}°C
                  </span>
                  <div className="text-[11px] text-sky-900 leading-tight">
                    <p className="font-semibold capitalize">{weatherPreview.description}</p>
                    <p className="text-[10px] text-sky-700">
                      Cảm giác như {weatherPreview.feelsLike}°C · Độ ẩm {weatherPreview.humidity}%
                    </p>
                  </div>
                </div>

                {weatherPreview.isRaining && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                    <Umbrella size={12} /> Có mưa
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-sky-800">
                Hệ thống sẽ tự động tổng hợp thời tiết và đề xuất quần áo thích hợp ngay sau khi tạo chuyến đi.
              </p>
            )}
          </div>
        )}

        {/* Ngày đi và ngày về */}
        <div className="grid gap-4 sm:grid-cols-2">
          <VInput
            label="Ngày khởi hành"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <VInput
            label="Ngày trở về"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Loại chuyến đi */}
        <VSelect
          label="Mục đích / Phong cách chuyến đi"
          value={tripType}
          onChange={(e) => setTripType(e.target.value as TripType)}
        >
          {TRIP_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </VSelect>

        {/* Tùy chọn tự động thêm đồ thiết yếu */}
        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-[#1F453E]/10 bg-[#FAF9F5] p-3 text-xs text-[#1F453E]">
          <input
            type="checkbox"
            checked={autoAddEssentials}
            onChange={(e) => setAutoAddEssentials(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#1F453E]"
          />
          <div>
            <span className="font-bold text-[#1F453E]">
              Tự động khởi tạo danh sách vật dụng thiết yếu
            </span>
            <p className="mt-0.5 text-[11px] text-[#6B7B76]">
              Bao gồm CCCD/Hộ chiếu, sạc điện thoại, pin dự phòng, kem chống nắng, đồ vệ sinh cá nhân và thuốc dự phòng.
            </p>
          </div>
        </label>

        {/* Ghi chú */}
        <VInput
          label="Ghi chú thêm (không bắt buộc)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ví dụ: Đi cùng công ty, có đêm gala dinner, cần 1 bộ váy trang trọng..."
          maxLength={500}
        />

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[#1F453E]/10">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-[#CBD5E1] px-5 py-2 text-xs font-semibold text-[#1F453E] hover:bg-[#FAF9F5]"
          >
            Hủy
          </button>
          <VButton type="submit" disabled={saving}>
            <Luggage size={14} />
            {saving ? 'Đang tạo...' : 'Tạo kế hoạch & Mở vali'}
          </VButton>
        </div>
      </form>
    </VModal>
  );
}
