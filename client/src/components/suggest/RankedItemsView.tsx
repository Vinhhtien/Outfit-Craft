'use client';

import { useCallback, useState } from 'react';
import {
  ListOrdered,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { suggestionApi } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import type { Category, Occasion } from '@/types';

interface RankedItemsViewProps {
  city?: string;
  occasion?: Occasion;
  onOpenItem?: (itemId: string) => void;
}

export function RankedItemsView({
  city,
  occasion,
  onOpenItem,
}: RankedItemsViewProps) {
  const [category, setCategory] = useState<Category | 'all'>('all');

  const loader = useCallback(
    () =>
      suggestionApi.ranked({
        city: city?.trim() || undefined,
        occasion,
        category: category === 'all' ? undefined : category,
      }),
    [city, occasion, category]
  );

  const { data, loading, error, reload } = useResource(loader);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
                <ListOrdered size={16} />
              </span>
              <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
                Danh sách đồ đã chấm điểm
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
              Mỗi món đồ được thuật toán chấm điểm từ 0 – 100 dựa trên nhiệt độ ({data?.weather.temp ?? '—'}°C), thời tiết, mùa và dịp được chọn.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#FAF9F5] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#1F453E] transition-all hover:bg-[#E2ECC8]/60 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Cập nhật điểm
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E2ECC8]/80 pt-4">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${
              category === 'all'
                ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
                : 'border-[#869BB2]/50 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
            }`}
          >
            Tất cả ({data ? data.items.length : '—'})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${
                category === c
                  ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
                  : 'border-[#869BB2]/50 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Content states */}
      {error && <ErrorState message={error} onRetry={() => void reload()} busy={loading} />}
      {loading && !data && <LoadingState label="Đang chấm điểm các món đồ theo thời tiết…" />}

      {items.length === 0 && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-[#869BB2] bg-white p-10 text-center">
          <p className="font-serif-display text-lg font-semibold text-[#1F453E]">
            Không có món đồ nào trong danh mục này
          </p>
          <p className="mt-1 text-xs text-[#6B7B76]">
            Hãy chuyển sang danh mục khác hoặc thêm trang phục mới vào tủ đồ của bạn.
          </p>
        </div>
      )}

      {/* Scored Items Grid */}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ item, score, reasons }, index) => {
            const isHigh = score >= 80;
            const isMedium = score >= 60 && score < 80;

            const scoreBadgeStyle = isHigh
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : isMedium
              ? 'border-[#1F453E]/20 bg-[#E2ECC8] text-[#1F453E]'
              : 'border-amber-200 bg-amber-50 text-amber-800';

            const scoreLabel = isHigh ? 'Rất phù hợp' : isMedium ? 'Phù hợp' : 'Ít phù hợp';

            return (
              <div
                key={item._id}
                onClick={() => onOpenItem?.(item._id)}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#CBD5E1] bg-white p-4 shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-md cursor-pointer"
              >
                <div>
                  {/* Top Bar: Rank & Score */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FAF9F5] border border-[#CBD5E1] text-[11px] font-bold text-[#6B7B76]">
                      #{index + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${scoreBadgeStyle}`}
                    >
                      <span>{scoreLabel}</span>
                      <span>•</span>
                      <span>{score}/100</span>
                    </span>
                  </div>

                  {/* Item Image */}
                  <div className="my-3 grid aspect-square place-items-center rounded-xl bg-[#FAF9F5] p-3 transition-transform group-hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Name & Category */}
                  <h4 className="truncate text-base font-semibold text-[#1F453E] group-hover:underline">
                    {item.name}
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-[#FAF9F5] px-2 py-0.5 text-[11px] font-medium text-[#52665F]">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    {item.brand && (
                      <span className="truncate text-xs text-[#6B7B76]">
                        {item.brand}
                      </span>
                    )}
                  </div>

                  {/* Score Progress Bar */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2ECC8]/50">
                      <div
                        className="h-full rounded-full bg-[#1F453E] transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Reasons List */}
                <div className="mt-4 border-t border-[#E2ECC8]/80 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7B76]">
                    Lý do đánh giá:
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {reasons.length > 0 ? (
                      reasons.map((reason) => {
                        const isWarning =
                          reason.includes('hơi nóng') ||
                          reason.includes('hơi mỏng') ||
                          reason.includes('dễ bẩn');

                        return (
                          <li
                            key={reason}
                            className={`flex items-start gap-1.5 text-xs ${
                              isWarning ? 'text-amber-800' : 'text-[#2C4C45]'
                            }`}
                          >
                            {isWarning ? (
                              <AlertCircle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                            ) : (
                              <CheckCircle size={12} className="mt-0.5 shrink-0 text-[#1F453E]" />
                            )}
                            <span>{reason}</span>
                          </li>
                        );
                      })
                    ) : (
                      <li className="text-xs text-[#6B7B76] italic">Điểm số tiêu chuẩn</li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
