'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, CloudRain, Thermometer, Droplets, RefreshCw, Bot, TriangleAlert,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { VSpinner } from '@/components/ui/vintage';
import { suggestionApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { OCCASIONS, OCCASION_LABELS, CATEGORY_LABELS } from '@/types';
import type { ClothingItem, Occasion, Suggestion, Weather } from '@/types';

export default function SuggestPage() {
  const user = useAuthStore((s) => s.user);

  const [city, setCity] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('daily');
  const [data, setData] = useState<{
    weather: Weather;
    suggestion: Suggestion;
    advice: string;
    adviceSource: 'ai' | 'rule';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dat thanh pho mac dinh tu ho so nguoi dung.
  useEffect(() => {
    if (user?.defaultCity && !city) setCity(user.defaultCity);
  }, [user, city]);

  const fetchSuggestion = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await suggestionApi.get({ city: city || undefined, occasion }));
    } catch (err) {
      setError(getErrorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [city, occasion]);

  // Tu goi lan dau khi da biet thanh pho.
  useEffect(() => {
    if (city) void fetchSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, occasion]);

  const picks: { label: string; item?: ClothingItem }[] = data
    ? [
        { label: 'Váy liền', item: data.suggestion.dress },
        { label: CATEGORY_LABELS.top, item: data.suggestion.top },
        { label: CATEGORY_LABELS.bottom, item: data.suggestion.bottom },
        { label: CATEGORY_LABELS.outerwear, item: data.suggestion.outerwear },
        { label: CATEGORY_LABELS.shoes, item: data.suggestion.shoes },
        { label: CATEGORY_LABELS.accessory, item: data.suggestion.accessory },
      ].filter((p) => p.item)
    : [];

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner compact innerClassName="max-w-6xl items-center px-6 py-3.5">
          <div>
            <h1 className="font-serif-display text-2xl font-normal uppercase tracking-wider text-[#1F453E] sm:text-3xl">
              Gợi ý trang phục
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#2C4C45] sm:text-sm">
              Dựa trên thời tiết hiện tại và tủ đồ của bạn.
            </p>
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

          {error && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-[#E5A99E] bg-[#FDF2F0] px-4 py-2.5 text-xs text-[#8C2D19] shadow-2xs sm:text-sm">
              <p className="flex items-center gap-2">
                <TriangleAlert size={16} className="shrink-0" />
                {error}
              </p>
              <Link
                href="/wardrobe"
                className="ml-4 shrink-0 font-bold underline underline-offset-4 hover:text-[#5E1B0E]"
              >
                Đến Tủ đồ
              </Link>
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-20">
              <VSpinner />
            </div>
          ) : !data ? (
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
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-serif-display text-lg font-semibold text-[#1F453E]">Bộ đồ gợi ý</h2>
                  <span className="rounded-full border border-[#1F453E]/15 bg-[#E2ECC8] px-3 py-1 text-xs font-semibold text-[#1F453E]">
                    Độ phù hợp {data.suggestion.totalScore}/100
                  </span>
                </div>

                {picks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#6B7B76]">
                    Tủ đồ chưa đủ món để ghép thành bộ. Hãy thêm vài món nữa.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {picks.map(({ label, item }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[#CBD5E1] bg-white p-3 text-center shadow-2xs transition-all hover:border-[#1F453E]"
                      >
                        <div className="grid aspect-square place-items-center rounded-lg bg-[#FAF9F5] p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item!.imageUrl}
                            alt={item!.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-[#1F453E]">{item!.name}</p>
                        <p className="text-xs text-[#6B7B76]">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {data.suggestion.reasons.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-[#E2ECC8] pt-3">
                    {data.suggestion.reasons.map((r) => (
                      <li key={r} className="flex gap-2 text-sm text-[#6B7B76]">
                        <span className="text-[#1F453E]">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
