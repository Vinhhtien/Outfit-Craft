'use client';

import { useState, useCallback } from 'react';
import {
  Luggage,
  Plus,
  Calendar,
  MapPin,
  CloudSun,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Plane,
  Umbrella,
  Trash2,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { VButton, VToast } from '@/components/ui/vintage';
import { useResource } from '@/hooks/useResource';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { travelApi } from '@/lib/services';
import { CreateTripModal } from '@/components/travel/CreateTripModal';
import { TripPackingView } from '@/components/travel/TripPackingView';
import type { TravelTrip } from '@/types';

export default function TravelPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const loader = useCallback((signal: AbortSignal) => travelApi.list(signal), []);
  const { data: trips, loading, error, reload } = useResource(loader);

  const tripList = trips || [];

  // Thống kê tổng hợp
  const totalTrips = tripList.length;
  const totalAllItems = tripList.reduce((sum, t) => sum + t.totalItems, 0);
  const totalPacked = tripList.reduce((sum, t) => sum + t.packedItems, 0);
  const overallPackedPercent = totalAllItems > 0 ? Math.round((totalPacked / totalAllItems) * 100) : 0;

  // Tìm chuyến đi sắp diễn ra gần nhất
  const upcomingTrip = tripList
    .filter((t) => new Date(t.endDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

  const handleDeleteTrip = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa chuyến đi "${title}" không?`)) return;
    try {
      await travelApi.remove(id);
      setToast({ message: 'Đã xóa chuyến đi thành công.', variant: 'success' });
      void reload();
    } catch {
      setToast({ message: 'Không thể xóa chuyến đi.', variant: 'error' });
    }
  };

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        {/* Banner Scallop */}
        <ScallopBanner>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[#1F453E]">
                <Luggage size={15} />
              </span>
              <h1 className="font-serif-display text-4xl font-normal uppercase tracking-wide text-[#1F453E]">
                Vali Du Lịch &amp; Thời Tiết
              </h1>
            </div>
            <p className="mt-1 text-sm font-medium text-[#2C4C45]">
              Danh sách đồ mang theo khi đi du lịch · Tự động gợi ý trang phục theo thời tiết nơi đến
            </p>
          </div>
          <div>
            <VButton onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Lên kế hoạch chuyến đi
            </VButton>
          </div>
        </ScallopBanner>

        <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
          {/* NẾU ĐANG CHỌN 1 CHUYẾN ĐI -> HIỂN THỊ CHI TIẾT VALI */}
          {selectedTripId ? (
            <TripPackingView
              tripId={selectedTripId}
              onBack={() => {
                setSelectedTripId(null);
                void reload();
              }}
              onDeleted={() => {
                setSelectedTripId(null);
                setToast({ message: 'Đã xóa chuyến đi.', variant: 'success' });
                void reload();
              }}
            />
          ) : (
            <>
              {/* 1. THẺ THỐNG KÊ DU LỊCH & ĐÓNG GÓI */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Tổng chuyến đi */}
                <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                      Tổng chuyến đi
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
                      <Plane size={18} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
                      {totalTrips}
                    </span>
                    <span className="text-xs font-medium text-[#52665F]">chuyến hành trình</span>
                  </div>
                  <p className="mt-2 text-xs text-[#6B7B76]">
                    Kế hoạch đã &amp; đang chuẩn bị
                  </p>
                </div>

                {/* Card 2: Chuyến đi sắp tới */}
                <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                      Sắp khởi hành
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                      <Calendar size={18} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="truncate font-serif-display text-xl font-bold text-[#1F453E]">
                      {upcomingTrip ? upcomingTrip.destination : 'Chưa có chuyến mới'}
                    </p>
                    <p className="mt-1 text-xs text-[#52665F]">
                      {upcomingTrip
                        ? `Khởi hành: ${new Date(upcomingTrip.startDate).toLocaleDateString('vi-VN')}`
                        : 'Hãy tạo chuyến đi tiếp theo'}
                    </p>
                  </div>
                </div>

                {/* Card 3: Thời tiết điểm đến tiếp theo */}
                <div className="relative overflow-hidden rounded-2xl border border-sky-300 bg-sky-50/70 p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-900">
                      Thời tiết nơi đến
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-200 text-sky-900">
                      <CloudSun size={18} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-serif-display text-3xl font-semibold text-sky-950">
                      {upcomingTrip?.weatherSnapshot?.temp
                        ? `${upcomingTrip.weatherSnapshot.temp}°C`
                        : '--°C'}
                    </span>
                    <span className="text-xs font-medium text-sky-900 truncate capitalize">
                      {upcomingTrip?.weatherSnapshot?.description || 'Dự báo trực tiếp'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-sky-800">
                    {upcomingTrip?.weatherSnapshot?.isRaining ? '⚠️ Có mưa - nhớ mang ô' : 'Thời tiết thuận lợi'}
                  </p>
                </div>

                {/* Card 4: Tỉ lệ đóng gói vali */}
                <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                      Đã xếp vào vali
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={18} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
                      {overallPackedPercent}%
                    </span>
                    <span className="text-xs font-medium text-[#52665F]">
                      ({totalPacked}/{totalAllItems} món)
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#6B7B76]">
                    Tiến độ chuẩn bị hành trang
                  </p>
                </div>
              </section>

              {/* 2. NỘI DUNG CHÍNH (LOADING / ERROR / EMPTY / DANH SÁCH CHUYẾN ĐI) */}
              {loading && !trips && <LoadingState label="Đang tải kế hoạch du lịch..." />}

              {error && !trips && (
                <div className="py-8">
                  <ErrorState message={error} onRetry={() => void reload()} busy={loading} />
                </div>
              )}

              {!loading && tripList.length === 0 && (
                <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-[#1F453E]/15 bg-white p-10 text-center shadow-2xs">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
                    <Luggage size={28} />
                  </span>
                  <h3 className="font-serif-display text-2xl font-semibold text-[#1F453E]">
                    Chưa có chuyến du lịch nào
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-[#52665F]">
                    Hãy lên kế hoạch cho chuyến đi tiếp theo của bạn! Hệ thống sẽ tự động cập nhật thời tiết nơi đến và gợi ý những trang phục phù hợp nhất từ tủ đồ của bạn.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
                  >
                    + Lên kế hoạch ngay
                  </button>
                </div>
              )}

              {/* LƯỚI DANH SÁCH CÁC CHUYẾN ĐI */}
              {tripList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif-display text-xl font-bold text-[#1F453E]">
                      Hành trình của bạn
                    </h3>
                    <span className="text-xs text-[#6B7B76]">
                      {tripList.length} chuyến đi được lưu
                    </span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {tripList.map((trip) => {
                      const weather = trip.weatherSnapshot;
                      const isReady = trip.totalItems > 0 && trip.packedItems === trip.totalItems;

                      return (
                        <div
                          key={trip._id}
                          className="flex flex-col justify-between rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-2xs transition-all hover:shadow-md hover:border-[#1F453E]/30"
                        >
                          <div>
                            {/* Badges: Điểm đến & Phong cách */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#E2ECC8] px-2.5 py-0.5 text-xs font-bold text-[#1F453E]">
                                <MapPin size={12} /> {trip.destination}
                              </span>

                              <span className="text-[11px] font-semibold text-[#6B7B76]">
                                {trip.durationDays} ngày {Math.max(1, trip.durationDays - 1)} đêm
                              </span>
                            </div>

                            {/* Tiêu đề chuyến đi */}
                            <h4
                              onClick={() => setSelectedTripId(trip._id)}
                              className="mt-3 cursor-pointer font-serif-display text-lg font-bold text-[#1F453E] hover:underline"
                            >
                              {trip.title}
                            </h4>

                            {/* Ngày đi & ngày về */}
                            <p className="mt-1 flex items-center gap-1 text-xs text-[#52665F]">
                              <Calendar size={13} />
                              <span>
                                {new Date(trip.startDate).toLocaleDateString('vi-VN')} —{' '}
                                {new Date(trip.endDate).toLocaleDateString('vi-VN')}
                              </span>
                            </p>

                            {/* Thời tiết điểm đến preview */}
                            {weather && (
                              <div className="mt-3.5 flex items-center justify-between rounded-xl border border-sky-200/80 bg-sky-50/60 p-2.5 text-xs text-sky-950">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base">{weather.temp}°C</span>
                                  <span className="truncate capitalize text-[11px] text-sky-900">
                                    {weather.description}
                                  </span>
                                </div>
                                {weather.isRaining ? (
                                  <span className="text-[10px] font-bold text-amber-800 flex items-center gap-0.5">
                                    <Umbrella size={12} /> Có mưa
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-sky-700">Thời tiết tốt</span>
                                )}
                              </div>
                            )}

                            {/* Tiến độ đóng gói */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#6B7B76]">Đã xếp vali:</span>
                                <span className="font-bold text-[#1F453E]">
                                  {trip.packedItems}/{trip.totalItems} món ({trip.packedPercentage}%)
                                </span>
                              </div>
                              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E2ECC8]/60">
                                <div
                                  className={`h-full transition-all ${
                                    isReady ? 'bg-emerald-600' : 'bg-[#1F453E]'
                                  }`}
                                  style={{ width: `${trip.packedPercentage}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="mt-5 flex items-center justify-between border-t border-[#1F453E]/10 pt-3">
                            <button
                              type="button"
                              onClick={() => void handleDeleteTrip(trip._id, trip.title)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                              title="Xóa chuyến đi"
                            >
                              <Trash2 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTripId(trip._id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#16352F]"
                            >
                              <Luggage size={13} /> Mở vali &amp; Checklist <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL LÊN KẾ HOẠCH CHUYẾN ĐI MỚI */}
        <CreateTripModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(tripId) => {
            setToast({ message: 'Đã lên kế hoạch chuyến đi thành công!', variant: 'success' });
            setSelectedTripId(tripId);
            void reload();
          }}
        />

        {/* Toast Notification */}
        <VToast
          message={toast?.message ?? null}
          variant={toast?.variant}
          duration={4000}
          onClose={() => setToast(null)}
        />
      </div>
    </ProtectedLayout>
  );
}
