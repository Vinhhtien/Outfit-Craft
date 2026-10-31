'use client';
import { useCategoryLabels } from '@/store/categoryStore';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, CloudRain, Thermometer, Droplets, RefreshCw, Bot, ListOrdered, FolderPlus,
  CalendarCheck,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { VToast } from '@/components/ui/vintage';
import { CloudImage } from '@/components/ui/CloudImage';
import { useResource } from '@/hooks/useResource';
import { outfitApi, scheduleApi, suggestionApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { RankedItemsView } from '@/components/suggest/RankedItemsView';
import { SaveSuggestedOutfitModal } from '@/components/suggest/SaveSuggestedOutfitModal';
import { ItemDetailModal } from '@/components/wardrobe/ItemDetailModal';
import { OCCASIONS, OCCASION_LABELS, CATEGORY_Z_INDEX } from '@/types';
import type { ClothingItem, Occasion, Season } from '@/types';

function getDefaultSeason(temp?: number): Season[] {
  if (temp === undefined) return ['summer'];
  if (temp < 18) return ['winter'];
  if (temp <= 25) return ['autumn', 'spring'];
  return ['summer'];
}

export default function SuggestPage() {
  const CATEGORY_LABELS = useCategoryLabels();
  const user = useAuthStore((s) => s.user);

  /** null = chua go gi -> dung thanh pho mac dinh trong ho so. */
  const [cityInput, setCity] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<Occasion>('daily');
  const [viewMode, setViewMode] = useState<'outfit' | 'ranked'>('outfit');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [isScheduling, setIsScheduling] = useState(false);
  const [todayScheduled, setTodayScheduled] = useState(false);
  const [lastSavedOutfitId, setLastSavedOutfitId] = useState<string | null>(null);

  const city = cityInput ?? user?.defaultCity ?? '';
  const loader = useCallback((signal: AbortSignal) => suggestionApi.get({ city: city.trim() || undefined, occasion }, signal), [city, occasion]);
  const { data, loading, error, reload: fetchSuggestion } = useResource(loader, 500);

  const picks: { label: string; item?: ClothingItem }[] = data
    ? [
        { label: CATEGORY_LABELS.dress, item: data.suggestion.dress },
        { label: CATEGORY_LABELS.top, item: data.suggestion.top },
        { label: CATEGORY_LABELS.bottom, item: data.suggestion.bottom },
        { label: CATEGORY_LABELS.outerwear, item: data.suggestion.outerwear },
        { label: CATEGORY_LABELS.shoes, item: data.suggestion.shoes },
        { label: CATEGORY_LABELS.accessory, item: data.suggestion.accessory },
      ].filter((p) => p.item)
    : [];

  const handleScheduleToday = async () => {
    if (!data || picks.length === 0 || isScheduling) return;
    setIsScheduling(true);
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let outfitId = lastSavedOutfitId;
      if (!outfitId) {
        const outfitItems = picks.map(({ item }, index) => {
          let left = 200;
          let top = 200;

          switch (item!.category) {
            case 'dress':
            case 'top':
              left = 200;
              top = 130;
              break;
            case 'outerwear':
              left = 210;
              top = 140;
              break;
            case 'bottom':
              left = 200;
              top = 300;
              break;
            case 'shoes':
              left = 200;
              top = 450;
              break;
            case 'bag':
              left = 320;
              top = 260;
              break;
            case 'accessory':
              left = 320;
              top = 120;
              break;
            default:
              left = 150 + (index % 3) * 100;
              top = 150 + Math.floor(index / 3) * 120;
          }

          return {
            item: item!._id,
            left,
            top,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            zIndex: CATEGORY_Z_INDEX[item!.category] ?? 10,
          };
        });

        const tags = ['Gợi ý thời tiết', OCCASION_LABELS[occasion]];
        if (data.weather?.description) {
          tags.push(data.weather.description);
        }

        const created = await outfitApi.create({
          name: `Gợi ý ${OCCASION_LABELS[occasion]} • ${today.toLocaleDateString('vi-VN')}`,
          items: outfitItems,
          canvasJSON: {},
          seasons: getDefaultSeason(data.weather?.temp),
          occasions: [occasion],
          tags,
          isPublic: false,
        });

        outfitId = created._id;
        setLastSavedOutfitId(created._id);
      }

      await scheduleApi.set({
        outfit: outfitId,
        date: todayStr,
        note: `Gợi ý theo thời tiết ${data.weather.temp}°C (${data.weather.city})`,
      });

      setTodayScheduled(true);
      setToastVariant('success');
      setToastMessage('Đã thêm bộ đồ gợi ý vào lịch ngày hôm nay!');
    } catch (err) {
      setToastVariant('error');
      setToastMessage(getErrorMessage(err));
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner compact innerClassName="max-w-6xl items-center justify-between px-6 py-3.5">
          <div>
            <h1 className="font-serif-display text-2xl font-normal uppercase tracking-wider text-[#1F453E] sm:text-3xl">
              {viewMode === 'ranked' ? 'Bảng điểm món đồ' : 'Gợi ý trang phục'}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#2C4C45] sm:text-sm">
              {viewMode === 'ranked'
                ? 'Độ phù hợp từng trang phục theo thời tiết và dịp mặc'
                : 'Dựa trên thời tiết hiện tại và tủ đồ của bạn.'}
            </p>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center rounded-full border border-[#1F453E]/20 bg-white/80 p-1 shadow-2xs backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setViewMode('outfit')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'outfit'
                  ? 'bg-[#1F453E] text-white shadow-xs'
                  : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
              }`}
            >
              <Sparkles size={13} /> Bộ đồ gợi ý
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ranked')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'ranked'
                  ? 'bg-[#1F453E] text-white shadow-xs'
                  : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
              }`}
            >
              <ListOrdered size={13} /> Danh sách chấm điểm
            </button>
          </div>
        </ScallopBanner>

        <div className="mx-auto max-w-6xl px-6 pb-10 pt-5">
          {/* Bo loc: thanh pho + lam moi + dip mac */}
          <div className="mb-4 rounded-2xl border border-[#1F453E]/15 bg-white p-4 shadow-[0_4px_20px_rgba(31,69,62,0.03)] sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-full sm:w-64">
                <span className="mb-1.5 block text-xs font-semibold text-[#1F453E]">Thành phố</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void fetchSuggestion()}
                  placeholder="Hanoi"
                  className="w-full rounded-full border border-[#869BB2]/60 bg-[#FAF9F5] px-4 py-2 text-sm text-[#1F453E] transition-all placeholder:text-[#6B7B76] focus:border-[#1F453E] focus:bg-white focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => void fetchSuggestion()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-[#1F453E] px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#16352F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <RefreshCw size={14} /> Làm mới
              </button>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#E2ECC8]/80 pt-3.5">
              {OCCASIONS.map((o) => (
                <OccasionChip key={o} active={occasion === o} onClick={() => setOccasion(o)}>
                  {OCCASION_LABELS[o]}
                </OccasionChip>
              ))}
            </div>
          </div>

          {viewMode === 'ranked' ? (
            <RankedItemsView
              city={city}
              occasion={occasion}
              onOpenItem={(id) => setSelectedItemId(id)}
            />
          ) : (
            <>
              {error && <ErrorState message={error} onRetry={() => void fetchSuggestion()} busy={loading} />}
              {error && data && <p className="mb-3 text-xs text-[#52665F]">Đang hiển thị dữ liệu của lần tải thành công gần nhất.</p>}
              {loading && data && <LoadingState compact label="Đang cập nhật gợi ý…" />}
              {loading && !data ? <LoadingState label="Đang xem thời tiết và tìm trang phục phù hợp…" /> : error && !data ? null : !data ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#1F453E]/15 bg-white p-10 text-center shadow-[0_4px_24px_rgba(31,69,62,0.04)] sm:p-14">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#1F453E]/15 bg-[#E2ECC8] text-[#1F453E] shadow-2xs">
                    <Sparkles size={22} />
                  </span>
                  <p className="font-serif-display text-xl font-semibold text-[#1F453E]">Chưa có gợi ý</p>
                  <p className="mt-1 max-w-md text-xs text-[#6B7B76] sm:text-sm">
                    Nhập thành phố và bấm Làm mới để nhận gợi ý trang phục theo thời tiết.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                  {/* Thoi tiet + loi tu van */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#1F453E]/20 bg-[#E2ECC8]/45 p-5 text-[#1F453E]">
                      <p className="text-sm font-medium text-[#2C4C45]">{data.weather.city}</p>
                      <p className="mt-1 font-serif-display text-4xl font-semibold">{data.weather.temp}°C</p>
                      <p className="mt-1 text-sm capitalize">{data.weather.description}</p>

                      <div className="mt-3 space-y-1.5 border-t border-[#1F453E]/15 pt-3 text-sm text-[#2C4C45]">
                        <p className="flex items-center gap-2">
                          <Thermometer size={14} /> Cảm giác như {data.weather.feelsLike}°C
                        </p>
                        <p className="flex items-center gap-2">
                          <Droplets size={14} /> Độ ẩm {data.weather.humidity}%
                        </p>
                        {data.weather.isRaining && (
                          <p className="flex items-center gap-2 font-medium text-[#3F5F7A]">
                            <CloudRain size={14} /> Trời đang mưa
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-r-2xl border border-l-4 border-[#1F453E]/15 border-l-[#1F453E] bg-white p-5 text-[#1F453E] shadow-xs">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <Bot size={15} className="text-[#1F453E]" />
                        Stylist nói gì
                        <span className="ml-auto rounded-full border border-[#869BB2]/40 bg-[#869BB2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1F453E]">
                          {data.adviceSource === 'ai' ? 'AI' : 'Gợi ý theo quy tắc'}
                        </span>
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[#2C4C45]">{data.advice}</p>
                    </div>
                  </div>

                  {/* Bo do goi y */}
                  <div className="rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-serif-display text-lg font-semibold text-[#1F453E]">Bộ đồ gợi ý</h2>
                        <span className="rounded-full border border-[#1F453E]/15 bg-[#E2ECC8] px-3 py-1 text-xs font-semibold text-[#1F453E]">
                          Độ phù hợp {Math.min(100, Math.max(0, Math.round(data.suggestion.totalScore)))}/100
                        </span>
                      </div>

                      {picks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleScheduleToday()}
                            disabled={isScheduling || todayScheduled}
                            className={`inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider shadow-xs transition-all disabled:opacity-60 ${
                              todayScheduled
                                ? 'bg-[#E2ECC8] text-[#1F453E]'
                                : 'bg-[#E2ECC8] text-[#1F453E] hover:bg-[#d6e3b8]'
                            }`}
                          >
                            <CalendarCheck size={14} />
                            {todayScheduled ? '✓ Đã lên lịch hôm nay' : isScheduling ? 'Đang lên lịch...' : 'Mặc hôm nay'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsSaveModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#16352F]"
                          >
                            <FolderPlus size={14} /> Lưu bộ đồ này
                          </button>
                        </div>
                      )}
                    </div>

                    {picks.length === 0 ? (
                      <p className="py-10 text-center text-sm text-[#6B7B76]">
                        Tủ đồ chưa đủ món để ghép thành bộ. Hãy thêm vài món nữa.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                        {picks.map(({ label, item }) => (
                          <div
                            key={`${item!._id}-${label}`}
                            onClick={() => setSelectedItemId(item!._id)}
                            className="group cursor-pointer rounded-xl border border-[#CBD5E1] bg-white p-3 text-center shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-xs"
                          >
                            <div className="grid aspect-square place-items-center rounded-lg bg-[#FAF9F5] p-2 transition-transform group-hover:scale-105">
                              <CloudImage
                                src={item!.imageUrl}
                                alt={item!.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <p className="mt-2 truncate text-sm font-semibold text-[#1F453E] group-hover:underline" title={item!.name}>
                              {item!.name}
                            </p>
                            <p className="text-xs text-[#6B7B76]">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {data.suggestion.reasons.length > 0 && (
                      <ul className="mt-4 space-y-1 border-t border-[#E2ECC8] pt-3">
                        {data.suggestion.reasons.map((r, idx) => (
                          <li key={`${r}-${idx}`} className="flex gap-2 text-sm text-[#6B7B76]">
                            <span className="text-[#1F453E]">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedItemId && (
        <ItemDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onUpdated={() => void fetchSuggestion()}
        />
      )}

      {isSaveModalOpen && data && (
        <SaveSuggestedOutfitModal
          open={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          items={picks as { label: string; item: ClothingItem }[]}
          occasion={occasion}
          weather={data.weather}
          onSaved={(outfitId) => {
            setLastSavedOutfitId(outfitId);
            setToastVariant('success');
            setToastMessage('Đã lưu bộ đồ vào danh sách của bạn!');
          }}
        />
      )}

      <VToast
        message={toastMessage}
        variant={toastVariant}
        onClose={() => setToastMessage(null)}
      />
    </ProtectedLayout>
  );
}

/** Nut chon dip mac (nen kem, dong bo voi nut loc o trang Phoi do). */
function OccasionChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
          : 'border-[#869BB2]/50 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E] hover:bg-[#E2ECC8]/40'
      }`}
    >
      {children}
    </button>
  );
}
