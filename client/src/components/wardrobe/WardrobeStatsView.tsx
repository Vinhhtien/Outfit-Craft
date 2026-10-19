'use client';

import {
  BarChart3,
  Shirt,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { itemApi } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';

interface WardrobeStatsViewProps {
  onSwitchToItems?: () => void;
}

export function WardrobeStatsView({
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

  const { total, byCategory } = data;

  return (
    <div className="space-y-8">
      {/* Task 49: Tổng số món đồ trong tủ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Tổng số món */}
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

        {/* Card 2: Phân loại danh mục */}
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
      </section>
    </div>
  );
}
