'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Clock,
  Wallet,
  Calendar,
} from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { itemApi } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { useCategoryLabels } from '@/store/categoryStore';
import type { ClothingItem, DormantItemInfo } from '@/types';

interface WardrobeDeclutterViewProps {
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (item: ClothingItem) => void;
  onSwitchToItems?: () => void;
  onItemActionSuccess?: (message: string) => void;
}

export function WardrobeDeclutterView({
  onOpenItem,
  onDeleteItem,
  onSwitchToItems,
  onItemActionSuccess,
}: WardrobeDeclutterViewProps) {
  const CATEGORY_LABELS = useCategoryLabels();
  const { data, loading, error, reload } = useResource(itemApi.declutter);
  const [filterTier, setFilterTier] = useState<'all' | 'warning' | 'danger'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (loading && !data) {
    return <LoadingState label="Đang quét các món đồ ngủ quên trong tủ..." />;
  }

  if (error && !data) {
    return (
      <div className="py-8">
        <ErrorState message={error} onRetry={() => void reload()} busy={loading} />
      </div>
    );
  }

  const {
    totalDormant = 0,
    totalDormantValue = 0,
    countWarning = 0,
    countDanger = 0,
    warningList = [],
    dangerList = [],
    allDormant = [],
  } = data || {};

  // Loc theo tier
  const displayedItems: DormantItemInfo[] =
    filterTier === 'warning'
      ? warningList
      : filterTier === 'danger'
      ? dangerList
      : allDormant;

  // Xu ly hanh dong: Danh dau da mac hom nay
  const handleMarkWorn = async (item: ClothingItem) => {
    try {
      setProcessingId(item._id);
      await itemApi.markWorn(item._id);
      onItemActionSuccess?.(`Tuyệt vời! Đã ghi nhận bạn diện "${item.name}" hôm nay.`);
      void reload();
    } catch {
      onItemActionSuccess?.('Không thể cập nhật trạng thái món đồ.');
    } finally {
      setProcessingId(null);
    }
  };

  // Xu ly hanh dong: Luu tru mon do
  const handleArchive = async (item: ClothingItem) => {
    try {
      setProcessingId(item._id);
      await itemApi.archive(item._id);
      onItemActionSuccess?.(`Đã lưu trữ "${item.name}" vào kho cất.`);
      void reload();
    } catch {
      onItemActionSuccess?.('Không thể lưu trữ món đồ.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. THẺ THỐNG KÊ TỔNG QUAN DỌN TỦ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Số món cần xử lý */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Đồ cần dọn dẹp
            </span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
              totalDormant > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <Clock size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
              {totalDormant}
            </span>
            <span className="text-xs font-medium text-[#52665F]">món &gt; 6 tháng</span>
          </div>
          <p className="mt-2 text-xs text-[#6B7B76]">
            {totalDormant > 0
              ? 'Chiếm diện tích và ít khi được bạn đụng tới'
              : 'Tủ đồ của bạn vô cùng tối ưu!'}
          </p>
          <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-amber-500/10" />
        </div>

        {/* Card 2: Giá trị tài sản đóng băng */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
              Giá trị bị đóng băng
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-800">
              <Wallet size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-serif-display text-2xl font-semibold text-[#1F453E] sm:text-3xl">
              {totalDormantValue.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-[#1F453E]">₫</span>
          </div>
          <p className="mt-2 truncate text-xs text-[#6B7B76]">
            Số tiền mua các món đang bị &quot;bỏ quên&quot;
          </p>
          <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-rose-500/10" />
        </div>

        {/* Card 3: Cảnh báo nhẹ (6-12 tháng) */}
        <div
          onClick={() => setFilterTier(filterTier === 'warning' ? 'all' : 'warning')}
          className={`relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md ${
            filterTier === 'warning'
              ? 'border-amber-600 bg-amber-50/60 shadow-sm ring-2 ring-amber-500/20'
              : 'border-[#1F453E]/15 bg-white shadow-[0_4px_20px_rgba(31,69,62,0.03)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Cần cân nhắc (6–12 tháng)
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Calendar size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-3xl font-semibold text-amber-900">
              {countWarning}
            </span>
            <span className="text-xs font-medium text-amber-800">món</span>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            Nên đưa vào Studio để phối outfit diện ngay
          </p>
        </div>

        {/* Card 4: Cảnh báo cao (> 12 tháng) */}
        <div
          onClick={() => setFilterTier(filterTier === 'danger' ? 'all' : 'danger')}
          className={`relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md ${
            filterTier === 'danger'
              ? 'border-rose-600 bg-rose-50/60 shadow-sm ring-2 ring-rose-500/20'
              : 'border-[#1F453E]/15 bg-white shadow-[0_4px_20px_rgba(31,69,62,0.03)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Bỏ quên (&gt; 1 năm)
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-800">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif-display text-3xl font-semibold text-rose-900">
              {countDanger}
            </span>
            <span className="text-xs font-medium text-rose-800">món</span>
          </div>
          <p className="mt-2 text-xs text-rose-700">
            Khuyên dùng: Thanh lý, tặng hoặc lưu trữ kho
          </p>
        </div>
      </section>

      {/* 2. KHÔNG CÓ MÓN ĐỒ NÀO BỊ LÃNG QUÊN (EMPTY STATE) */}
      {totalDormant === 0 ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-emerald-600/20 bg-white p-10 text-center shadow-[0_4px_24px_rgba(31,69,62,0.04)]">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-600/20 bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={32} />
          </span>
          <h3 className="font-serif-display text-2xl font-semibold text-[#1F453E]">
            Tủ đồ của bạn vô cùng ngăn nắp & tối ưu!
          </h3>
          <p className="mt-2 max-w-md text-sm text-[#52665F]">
            Không có món đồ nào bị lãng quên quá 6 tháng. Bạn đang quản lý và luân phiên diện trang phục rất hiệu quả!
          </p>
          {onSwitchToItems && (
            <button
              type="button"
              onClick={onSwitchToItems}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
            >
              Xem tủ đồ <ArrowRight size={14} />
            </button>
          )}
        </div>
      ) : (
        /* 3. DANH SÁCH MÓN ĐỒ CẦN DỌN DẸP */
        <section className="rounded-2xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <Sparkles size={16} />
                </span>
                <h2 className="font-serif-display text-xl font-semibold text-[#1F453E] sm:text-2xl">
                  Gợi ý xử lý đồ lãng quên
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#52665F] sm:text-sm">
                Hãy giải phóng không gian hoặc mang những món đồ này trở lại phong cách hàng ngày của bạn.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center rounded-full border border-[#1F453E]/15 bg-[#FAF9F5] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterTier('all')}
                className={`rounded-full px-3 py-1 transition-all ${
                  filterTier === 'all'
                    ? 'bg-[#1F453E] text-white shadow-xs'
                    : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
                }`}
              >
                Tất cả ({totalDormant})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier('warning')}
                className={`rounded-full px-3 py-1 transition-all ${
                  filterTier === 'warning'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-100'
                }`}
              >
                🟡 6–12 tháng ({countWarning})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier('danger')}
                className={`rounded-full px-3 py-1 transition-all ${
                  filterTier === 'danger'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-800 hover:bg-rose-100'
                }`}
              >
                🔴 &gt; 12 tháng ({countDanger})
              </button>
            </div>
          </div>

          {/* Grid đồ cần dọn dẹp */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedItems.map(({ item, daysInactive, tier, reason }) => {
              const isBusy = processingId === item._id;
              const isDanger = tier === 'danger';

              return (
                <div
                  key={item._id}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all hover:shadow-md ${
                    isDanger
                      ? 'border-rose-200 bg-rose-50/20 hover:border-rose-400'
                      : 'border-amber-200 bg-amber-50/20 hover:border-amber-400'
                  }`}
                >
                  <div>
                    {/* Header item: Badge thời gian ngủ quên */}
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isDanger
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Clock size={11} />
                        {daysInactive >= 365
                          ? `Hơn 1 năm không mặc (${Math.floor(daysInactive / 30)} tháng)`
                          : `${Math.floor(daysInactive / 30)} tháng chưa mặc`}
                      </span>

                      {item.purchasePrice && item.purchasePrice > 0 && (
                        <span className="text-xs font-semibold text-[#1F453E]">
                          {item.purchasePrice.toLocaleString('vi-VN')} ₫
                        </span>
                      )}
                    </div>

                    {/* Ảnh và thông tin món đồ */}
                    <div
                      onClick={() => onOpenItem?.(item._id)}
                      className="mt-3 flex cursor-pointer gap-3.5"
                    >
                      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#CBD5E1]/60 bg-[#FAF9F5] p-1.5 transition-transform group-hover:scale-105">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-[#1F453E] group-hover:underline">
                          {item.name}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7B76]">
                          <span className="rounded bg-[#869BB2]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#1F453E]">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                          {item.brand && <span>· {item.brand}</span>}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-snug text-[#52665F]">
                          {reason}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4 Nút hành động trực tiếp */}
                  <div className="mt-4 border-t border-[#1F453E]/10 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7B76]">
                      Lựa chọn dọn dẹp:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Action 1: Phối đồ ngay */}
                      <Link
                        href={`/studio?item=${item._id}`}
                        className="flex items-center justify-center gap-1 rounded-lg border border-[#1F453E] bg-[#1F453E] px-2.5 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-[#16352F]"
                        title="Đưa vào Studio để phối trang phục diện ngay"
                      >
                        <Sparkles size={12} /> Phối đồ
                      </Link>

                      {/* Action 2: Đã mặc hôm nay */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleMarkWorn(item)}
                        className="flex items-center justify-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        title="Đánh dấu vừa diện món này hôm nay"
                      >
                        <CheckCircle2 size={12} /> Đã diện
                      </button>

                      {/* Action 3: Lưu trữ kho */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleArchive(item)}
                        className="flex items-center justify-center gap-1 rounded-lg border border-[#869BB2]/40 bg-white px-2 py-1.5 text-xs font-semibold text-[#1F453E] transition-colors hover:bg-[#FAF9F5] disabled:opacity-50"
                        title="Cất vào kho lưu trữ (không hiển thị thường ngày)"
                      >
                        <Archive size={12} /> Lưu trữ
                      </button>

                      {/* Action 4: Thanh lý / Xóa */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDeleteItem?.(item)}
                        className="flex items-center justify-center gap-1 rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        title="Thanh lý, cho tặng hoặc xóa khỏi tủ đồ"
                      >
                        <Trash2 size={12} /> Thanh lý
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
