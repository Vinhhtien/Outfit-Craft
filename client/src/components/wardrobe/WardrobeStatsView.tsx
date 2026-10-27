'use client';

import Link from 'next/link';
import {
  BarChart3,
  Shirt,
  ArrowRight,
  Sparkles,
  Layers,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Coins,
  TrendingDown,
} from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { itemApi } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { CloudImage } from '@/components/ui/CloudImage';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import type { Category } from '@/types';

interface WardrobeStatsViewProps {
  onSelectCategory?: (category: Category) => void;
  onOpenItem?: (itemId: string) => void;
  onSwitchToItems?: () => void;
  onSwitchToDeclutter?: () => void;
}

export function WardrobeStatsView({
  onSelectCategory,
  onOpenItem,
  onSwitchToItems,
  onSwitchToDeclutter,
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

  const {
    total,
    byCategory,
    mostWorn,
    neverWorn,
    neverWornItems = [],
    financial,
    bestValueItems = [],
    wastefulItems = [],
  } = data;

  // Task 49 + 52: Tính tỷ lệ món đã mặc
  const wornCount = Math.max(0, total - neverWorn);
  const wornPercent = total > 0 ? Math.round((wornCount / total) * 100) : 0;

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
      {/* 1. KPI CARDS (Tasks 49, 51, 52 + Financial Value) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Tổng số món (Task 49) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Tổng món đồ
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
              <Shirt size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
              {total}
            </span>
            <span className="text-xs font-medium text-[#52665F]">món</span>
          </div>
          <p className="mt-2 text-xs text-[#6B7B76]">
            Phân bổ trên {byCategory.length} danh mục
          </p>
          <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-[#E2ECC8]/20" />
        </div>

        {/* Card 2: Giá trị tủ đồ (MỚI: Tài chính tủ đồ) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Giá trị tủ đồ
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Wallet size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-serif-display text-2xl font-semibold text-[#1F453E] sm:text-3xl">
              {financial?.totalValue ? financial.totalValue.toLocaleString('vi-VN') : '0'}
            </span>
            <span className="text-xs font-semibold text-[#1F453E]">₫</span>
          </div>
          <p className="mt-2 truncate text-xs text-[#6B7B76]">
            {financial?.pricedCount ? `${financial.pricedCount}/${total} món có giá` : 'Chưa cập nhật giá mua'}
          </p>
          <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-emerald-500/10" />
        </div>

        {/* Card 3: Đã từng mặc */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Đã diện qua
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2ECC8]/60 text-[#1F453E]">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
              {wornCount}
            </span>
            <span className="text-xs font-medium text-[#52665F]">món ({wornPercent}%)</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E2ECC8]/50">
            <div
              className="h-full rounded-full bg-[#1F453E] transition-all duration-500"
              style={{ width: `${wornPercent}%` }}
            />
          </div>
        </div>

        {/* Card 4: Món chưa mặc lần nào (Task 52) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Chưa mặc
            </span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
              neverWorn > 0 ? 'bg-amber-100 text-amber-800' : 'bg-[#E2ECC8] text-[#1F453E]'
            }`}>
              <AlertCircle size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
              {neverWorn}
            </span>
            <span className="text-xs font-medium text-[#52665F]">
              món ({total > 0 ? Math.round((neverWorn / total) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-2 text-xs text-[#6B7B76]">
            {neverWorn > 0 ? 'Cần được ưu tiên phối' : 'Tủ đồ không bị lãng phí'}
          </p>
        </div>

        {/* Card 5: Top yêu thích nhất (Task 51) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Mặc nhiều nhất
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Trophy size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
              {mostWorn[0]?.wearCount ?? 0}
            </span>
            <span className="text-xs font-medium text-[#52665F]">lần mặc</span>
          </div>
          <p className="mt-2 truncate text-xs font-semibold text-[#1F453E]">
            {mostWorn[0] ? mostWorn[0].name : 'Chưa có lượt mặc'}
          </p>
        </div>
      </section>

      {/* 2. THỐNG KÊ THEO DANH MỤC (Task 50) */}
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

      {/* 3. HIỆU QUẢ ĐẦU TƯ THỜI TRANG (COST PER WEAR - CPW) */}
      <section className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <Coins size={16} />
              </span>
              <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
                Hiệu quả đầu tư & Chi phí mỗi lần mặc (CPW)
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
              <strong className="font-semibold text-[#1F453E]">Cost Per Wear (CPW) = Giá mua ÷ Số lần mặc</strong>. Món đồ diện càng nhiều lần, chi phí cho mỗi lần diện càng tiết kiệm!
            </p>
          </div>
          {financial && financial.pricedCount > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50/70 px-3.5 py-1 text-xs font-semibold text-emerald-800">
              <TrendingDown size={14} />
              <span>Giá trung bình: ~{financial.avgPrice.toLocaleString('vi-VN')} ₫ / món</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cột 1: Món đồ sinh lời nhất (CPW rẻ nhất) */}
          <div className="rounded-xl border border-emerald-600/20 bg-[#F4F9F4]/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                  ✓
                </span>
                <h3 className="font-serif-display text-base font-semibold text-[#1F453E]">
                  Món đồ sinh lời nhất (Top Best Value)
                </h3>
              </div>
              <span className="text-xs text-emerald-800 font-medium">CPW thấp nhất</span>
            </div>

            {bestValueItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-xs text-[#6B7B76]">
                Chưa có dữ liệu món đồ vừa có giá mua vừa đã được mặc. Hãy thêm giá mua cho đồ trong tủ!
              </div>
            ) : (
              <div className="space-y-3">
                {bestValueItems.map((item, idx) => (
                  <div
                    key={item._id}
                    onClick={() => onOpenItem?.(item._id)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#CBD5E1]/60 bg-white p-3 shadow-2xs transition-all hover:border-emerald-600 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E2ECC8] text-[11px] font-bold text-[#1F453E]">
                        {idx + 1}
                      </span>
                      <div className="h-11 w-11 shrink-0 grid place-items-center rounded-lg bg-[#FAF9F5] p-1 border border-[#CBD5E1]/60">
                        <CloudImage src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-semibold text-[#1F453E] hover:underline">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-[#6B7B76]">
                          Giá {item.purchasePrice?.toLocaleString('vi-VN')} ₫ · {item.wearCount} lần mặc
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
                        ~{item.costPerWear?.toLocaleString('vi-VN')} ₫
                      </span>
                      <span className="block text-[10px] text-emerald-700 font-medium">/ lần mặc</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cột 2: Món đồ đầu tư cao nhưng ít mặc (Needs Love) */}
          <div className="rounded-xl border border-amber-500/20 bg-[#FDF8EE]/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold">
                  !
                </span>
                <h3 className="font-serif-display text-base font-semibold text-[#1F453E]">
                  Cần diện nhiều hơn (Đầu tư cao nhưng ít mặc)
                </h3>
              </div>
              <span className="text-xs text-amber-800 font-medium">Ưu tiên phối đồ</span>
            </div>

            {wastefulItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-xs text-[#6B7B76]">
                Tuyệt vời! Bạn không có món đồ giá trị cao nào bị bỏ quên.
              </div>
            ) : (
              <div className="space-y-3">
                {wastefulItems.map((item, idx) => (
                  <div
                    key={item._id}
                    onClick={() => onOpenItem?.(item._id)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#CBD5E1]/60 bg-white p-3 shadow-2xs transition-all hover:border-amber-500 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                        {idx + 1}
                      </span>
                      <div className="h-11 w-11 shrink-0 grid place-items-center rounded-lg bg-[#FAF9F5] p-1 border border-[#CBD5E1]/60">
                        <CloudImage src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-semibold text-[#1F453E] hover:underline">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-[#6B7B76]">
                          {CATEGORY_LABELS[item.category]} {item.brand ? `· ${item.brand}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-xs font-bold text-[#1F453E]">
                        {item.purchasePrice?.toLocaleString('vi-VN')} ₫
                      </span>
                      <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        {item.wearCount === 0 ? 'Chưa mặc' : 'Mới mặc 1 lần'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. TOP 5 MÓN ĐỒ MẶC NHIỀU NHẤT (Task 51) */}
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
                    <CloudImage
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

      {/* 4. MÓN ĐỒ CHƯA MẶC LẦN NÀO (Task 52) */}
      <section className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-800">
                <AlertCircle size={15} />
              </span>
              <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
                Món đồ chưa mặc lần nào ({neverWorn})
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
              Những món đồ đang &quot;ngủ quên&quot; trong tủ. Hãy đưa chúng vào Studio để tạo outfit mới!
            </p>
          </div>
          {neverWorn > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {onSwitchToDeclutter && (
                <button
                  type="button"
                  onClick={onSwitchToDeclutter}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-600 bg-amber-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 transition-colors hover:bg-amber-100"
                >
                  <Sparkles size={13} /> Gợi ý dọn tủ
                </button>
              )}
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
              >
                <Sparkles size={13} /> Phối đồ ngay
              </Link>
            </div>
          )}
        </div>

        {neverWorn === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#E2ECC8] bg-[#E2ECC8]/30 p-4 text-[#1F453E]">
            <CheckCircle2 size={22} className="text-[#1F453E]" />
            <p className="text-sm font-medium">
              Thật tuyệt vời! Toàn bộ món đồ trong tủ của bạn đều đã từng được diện ít nhất một lần.
            </p>
          </div>
        ) : neverWornItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {neverWornItems.map((item) => (
              <div
                key={item._id}
                onClick={() => onOpenItem?.(item._id)}
                className="group relative cursor-pointer rounded-xl border border-[#CBD5E1] bg-white p-3 shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-sm"
              >
                <div className="grid aspect-square place-items-center rounded-lg bg-[#FAF9F5] p-2 transition-transform group-hover:scale-105">
                  <CloudImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <h4 className="mt-2 truncate text-xs font-semibold text-[#1F453E] group-hover:underline">
                  {item.name}
                </h4>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-[#6B7B76]">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                    0 lần
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B7B76]">
            Có {neverWorn} món đồ chưa mặc lần nào.
          </p>
        )}
      </section>
    </div>
  );
}
