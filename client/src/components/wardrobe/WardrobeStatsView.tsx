'use client';

import {
  BarChart3,
  Shirt,
  ArrowRight,
  Sparkles,
  Layers,
  Trophy,
} from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { itemApi } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import type { Category } from '@/types';

interface WardrobeStatsViewProps {
  onSelectCategory?: (category: Category) => void;
  onOpenItem?: (itemId: string) => void;
  onSwitchToItems?: () => void;
}

export function WardrobeStatsView({
  onSelectCategory,
  onOpenItem,
  onSwitchToItems,
}: WardrobeStatsViewProps) {
  const { data, loading, error, reload } = useResource(itemApi.stats);

  if (loading && !data) {
    return <LoadingState label="Đang tải dữ liệu thống kê tủ đồ…" />;
  }

  if (error && !data) {
    return (
      <div className="py-8">
        <ErrorState message={error} onRetry={() => void reload()} busy={loading} />
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-[#1F453E]/15 bg-white p-10 text-center shadow-[0_4px_24px_rgba(31,69,62,0.04)]">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#1F453E]/15 bg-[#E2ECC8] text-[#1F453E]">
          <BarChart3 size={28} />
        </span>
        <h3 className="font-serif-display text-2xl font-semibold text-[#1F453E]">
          Chưa có số liệu thống kê
        </h3>
        <p className="mt-2 max-w-md text-sm text-[#52665F]">
          Tủ đồ của bạn hiện đang trống. Hãy thêm các món đồ đầu tiên để hệ thống bắt đầu thống kê số lượng và danh mục.
        </p>
        {onSwitchToItems && (
          <button
            type="button"
            onClick={onSwitchToItems}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
          >
            Quay lại tủ đồ <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  const { total, byCategory, mostWorn } = data;

  // Task 50: Chuẩn bị phân bổ theo danh mục
  const categoryCountMap = new Map<Category, number>(
    byCategory.map((c) => [c._id, c.count])
  );
  const fullCategories = CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    count: categoryCountMap.get(cat) ?? 0,
    percent: total > 0 ? Math.round(((categoryCountMap.get(cat) ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // Task 51: Tính tỷ lệ mặc so với món mặc nhiều nhất
  const maxWearCount = mostWorn.length > 0 ? Math.max(...mostWorn.map((i) => i.wearCount), 1) : 1;

  return (
    <div className="space-y-8">
      {/* Task 49 + 51: Tổng số món đồ và Highlight món mặc nhiều nhất */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Tổng số món (Task 49) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Tổng món đồ trong tủ
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
              <Shirt size={20} />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-serif-display text-5xl font-semibold text-[#1F453E]">
              {total}
            </span>
            <span className="text-sm font-medium text-[#52665F]">món đã số hóa</span>
          </div>
          <p className="mt-3 text-xs text-[#6B7B76]">
            Toàn bộ trang phục và phụ kiện hiện có trong tủ đồ cá nhân
          </p>
          <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-[#E2ECC8]/20" />
        </div>

        {/* Card 2: Phân loại danh mục (Task 50) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Đa dạng danh mục
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2ECC8]/60 text-[#1F453E]">
              <Sparkles size={20} />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-serif-display text-5xl font-semibold text-[#1F453E]">
              {byCategory.length}
            </span>
            <span className="text-sm font-medium text-[#52665F]">nhóm danh mục</span>
          </div>
          <p className="mt-3 text-xs text-[#6B7B76]">
            Các món đồ được phân chia khoa học theo từng loại trang phục
          </p>
        </div>

        {/* Card 3: Top yêu thích nhất (Task 51) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Món mặc nhiều nhất
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Trophy size={20} />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-serif-display text-5xl font-semibold text-[#1F453E]">
              {mostWorn[0]?.wearCount ?? 0}
            </span>
            <span className="text-sm font-medium text-[#52665F]">lần diện đồ</span>
          </div>
          <p className="mt-3 truncate text-xs font-semibold text-[#1F453E]">
            {mostWorn[0] ? mostWorn[0].name : 'Chưa có lượt mặc'}
          </p>
        </div>
      </section>

      {/* Task 50: Thống kê theo danh mục */}
      <section className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
              Phân bố theo danh mục
            </h2>
            <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
              Tỷ lệ các loại trang phục trong tủ đồ. Bấm vào danh mục để xem các món tương ứng.
            </p>
          </div>
          <span className="rounded-full border border-[#1F453E]/15 bg-[#E2ECC8]/60 px-3.5 py-1 text-xs font-semibold text-[#1F453E]">
            {CATEGORIES.length} nhóm đồ
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fullCategories.map(({ category, label, count, percent }) => (
            <div
              key={category}
              onClick={() => onSelectCategory?.(category)}
              className="group relative cursor-pointer rounded-xl border border-[#CBD5E1]/80 bg-[#FAF9F5] p-4 transition-all hover:border-[#1F453E] hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F453E]/10 bg-white text-[#1F453E] group-hover:bg-[#E2ECC8]/40">
                    <Layers size={15} />
                  </span>
                  <span className="text-sm font-semibold text-[#1F453E] group-hover:underline">
                    {label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#1F453E]">{count}</span>
                  <span className="ml-1 text-xs text-[#6B7B76]">món</span>
                </div>
              </div>

              {/* Thanh tỷ trọng phần trăm */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[#6B7B76]">
                  <span>Tỷ trọng</span>
                  <span className="font-semibold text-[#1F453E]">{percent}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-[#CBD5E1]/60 bg-white">
                  <div
                    className="h-full rounded-full bg-[#1F453E] transition-all duration-500 group-hover:bg-[#16352F]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Task 51: Top 5 món đồ mặc nhiều nhất */}
      <section className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Trophy size={15} />
              </span>
              <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
                Top 5 món đồ mặc nhiều nhất
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
              Những món đồ được bạn ưu ái diện đi diện lại nhiều lần nhất.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#52665F]">
            Tự động tính từ số lần phối đồ & nhật ký lịch
          </span>
        </div>

        {mostWorn.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7B76]">
            Chưa có món đồ nào được ghi nhận lần mặc. Hãy lập lịch trang phục hoặc đánh dấu đã mặc!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {mostWorn.map((item, index) => {
              const rank = index + 1;
              const rankColor =
                rank === 1
                  ? 'bg-amber-400 text-amber-950 border-amber-300'
                  : rank === 2
                  ? 'bg-slate-300 text-slate-900 border-slate-200'
                  : rank === 3
                  ? 'bg-amber-700/80 text-white border-amber-600'
                  : 'bg-[#FAF9F5] text-[#1F453E] border-[#1F453E]/20';

              const wearRatio = Math.round((item.wearCount / maxWearCount) * 100);

              return (
                <div
                  key={item._id}
                  onClick={() => onOpenItem?.(item._id)}
                  className="group relative flex flex-col justify-between rounded-xl border border-[#CBD5E1] bg-white p-3.5 shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-md cursor-pointer"
                >
                  {/* Huy hiệu thứ hạng */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black shadow-xs ${rankColor}`}
                    >
                      #{rank}
                    </span>
                    <span className="rounded-full bg-[#E2ECC8] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1F453E]">
                      {item.wearCount} lần
                    </span>
                  </div>

                  {/* Ảnh sản phẩm */}
                  <div className="my-3 grid aspect-square place-items-center rounded-lg bg-[#FAF9F5] p-2 transition-transform group-hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Thông tin món đồ */}
                  <div>
                    <h4 className="truncate text-sm font-semibold text-[#1F453E] group-hover:underline">
                      {item.name}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#6B7B76]">
                      {CATEGORY_LABELS[item.category]}
                    </p>

                    {/* Thanh đo mức độ ưa chuộng */}
                    <div className="mt-2.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2ECC8]/60">
                        <div
                          className="h-full rounded-full bg-[#1F453E]"
                          style={{ width: `${wearRatio}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
