'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, CloudRain, Thermometer, Droplets, RefreshCw, Bot } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Button, Chip, EmptyState, Input, Spinner } from '@/components/ui';
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
    <ProtectedLayout>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Gợi ý trang phục</h1>
        <p className="text-sm text-[var(--muted)]">
          Dựa trên thời tiết hiện tại và tủ đồ của bạn.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Input
            label="Thành phố"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void fetchSuggestion()}
            placeholder="Hanoi"
          />
        </div>
        <Button variant="secondary" onClick={() => void fetchSuggestion()} loading={loading}>
          <RefreshCw size={15} /> Làm mới
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {OCCASIONS.map((o) => (
          <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>
            {OCCASION_LABELS[o]}
          </Chip>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : !data ? (
        <EmptyState
          icon={<Sparkles size={36} />}
          title="Chưa có gợi ý"
          description="Nhập thành phố và bấm Làm mới để nhận gợi ý trang phục theo thời tiết."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Thoi tiet + loi tu van */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-sm text-[var(--muted)]">{data.weather.city}</p>
              <p className="mt-1 text-4xl font-semibold">{data.weather.temp}°C</p>
              <p className="mt-1 text-sm capitalize">{data.weather.description}</p>

              <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">
                <p className="flex items-center gap-2">
                  <Thermometer size={14} /> Cảm giác như {data.weather.feelsLike}°C
                </p>
                <p className="flex items-center gap-2">
                  <Droplets size={14} /> Độ ẩm {data.weather.humidity}%
                </p>
                {data.weather.isRaining && (
                  <p className="flex items-center gap-2 text-blue-500">
                    <CloudRain size={14} /> Trời đang mưa
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Bot size={15} className="text-[var(--primary)]" />
                Stylist nói gì
                <span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-[var(--muted)]">
                  {data.adviceSource === 'ai' ? 'AI' : 'Gợi ý theo quy tắc'}
                </span>
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{data.advice}</p>
            </div>
          </div>

          {/* Bo do goi y */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Bộ đồ gợi ý</h2>
              <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
                Độ phù hợp {data.suggestion.totalScore}/100
              </span>
            </div>

            {picks.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--muted)]">
                Tủ đồ chưa đủ món để ghép thành bộ. Hãy thêm vài món nữa.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {picks.map(({ label, item }) => (
                  <div key={label} className="text-center">
                    <div className="canvas-checker grid aspect-square place-items-center rounded-xl border border-[var(--border)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item!.imageUrl}
                        alt={item!.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium">{item!.name}</p>
                    <p className="text-xs text-[var(--muted)]">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {data.suggestion.reasons.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-[var(--border)] pt-3">
                {data.suggestion.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-[var(--muted)]">
                    <span className="text-[var(--primary)]">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
