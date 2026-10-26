'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  Plus,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Wallet,
  ShoppingBag,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { AddWishlistModal } from '@/components/wishlist/AddWishlistModal';
import { VButton, VToast } from '@/components/ui/vintage';
import { useResource } from '@/hooks/useResource';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { wishlistApi } from '@/lib/services';
import { useCategoryLabels } from '@/store/categoryStore';
import { CATEGORIES } from '@/types';
import type { WishlistItem } from '@/types';

export default function WishlistPage() {
  const CATEGORY_LABELS = useCategoryLabels();
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [purchasedFilter, setPurchasedFilter] = useState<string>('false'); // default: chua mua

  // Detail duplicate preview popup
  const [viewingDuplicatesItem, setViewingDuplicatesItem] = useState<WishlistItem | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) =>
      wishlistApi.list(
        {
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          priority: priorityFilter === 'all' ? undefined : priorityFilter,
          purchased: purchasedFilter,
        },
        signal
      ),
    [categoryFilter, priorityFilter, purchasedFilter]
  );

  const { data, loading, error, reload } = useResource(loader);

  const items = data?.items || [];
  const stats = data?.stats || {
    totalItems: 0,
    unpurchasedCount: 0,
    totalEstimatedBudget: 0,
    duplicateWarningCount: 0,
  };

  // Moving to wardrobe state
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());

  const handleMoveToWardrobe = async (item: WishlistItem) => {
    if (movingIds.has(item._id)) return;
    setMovingIds((prev) => new Set(prev).add(item._id));
    try {
      const res = await wishlistApi.moveToWardrobe(item._id);
      setToast({
        message: res.message || `Đã chuyển "${item.name}" vào tủ đồ thành công!`,
        variant: 'success',
      });
      void reload();
    } catch {
      setToast({ message: 'Không thể chuyển vào tủ đồ.', variant: 'error' });
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  };

  const handleDelete = async (item: WishlistItem) => {
    try {
      await wishlistApi.remove(item._id);
      setToast({ message: `Đã xóa "${item.name}" khỏi wishlist.`, variant: 'success' });
      void reload();
    } catch {
      setToast({ message: 'Không thể xóa món đồ.', variant: 'error' });
    }
  };

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        {/* Banner Scallop */}
        <ScallopBanner>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Heart size={15} className="fill-rose-700" />
              </span>
              <h1 className="font-serif-display text-4xl font-normal uppercase tracking-wide text-[#1F453E]">
                Wishlist &amp; Chống Mua Trùng
              </h1>
            </div>
            <p className="mt-1 text-sm font-medium text-[#2C4C45]">
              Lên danh sách đồ mong muốn · Tự động đối chiếu màu sắc &amp; danh mục để tránh mua lặp
            </p>
          </div>
          <div>
            <VButton onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Thêm vào Wishlist
            </VButton>
          </div>
        </ScallopBanner>

        <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
          {/* 1. THẺ THỐNG KÊ NGÂN SÁCH & CẢNH BÁO */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Tổng số món dự định mua */}
            <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                  Đang mong muốn
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
                  <ShoppingBag size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
                  {stats.unpurchasedCount}
                </span>
                <span className="text-xs font-medium text-[#52665F]">món dự định mua</span>
              </div>
              <p className="mt-2 text-xs text-[#6B7B76]">
                Tổng {stats.totalItems} món trong danh sách
              </p>
            </div>

            {/* Card 2: Dự toán ngân sách */}
            <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                  Dự toán ngân sách
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <Wallet size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-serif-display text-2xl font-semibold text-[#1F453E] sm:text-3xl">
                  {stats.totalEstimatedBudget.toLocaleString('vi-VN')}
                </span>
                <span className="text-xs font-semibold text-[#1F453E]">₫</span>
              </div>
              <p className="mt-2 text-xs text-[#6B7B76]">
                Tổng chi phí dự kiến cho các món
              </p>
            </div>

            {/* Card 3: Cảnh báo mua trùng (TIÊU ĐIỂM) */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/70 p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Cảnh báo mua trùng
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-900">
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif-display text-4xl font-semibold text-amber-950">
                  {stats.duplicateWarningCount}
                </span>
                <span className="text-xs font-medium text-amber-900">món có nguy cơ lặp</span>
              </div>
              <p className="mt-2 text-xs text-amber-800">
                Đã có món tương đồng danh mục &amp; màu sắc trong tủ
              </p>
            </div>

            {/* Card 4: Đã mua thành công */}
            <div className="relative overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white p-5 shadow-[0_4px_20px_rgba(31,69,62,0.03)] transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76]">
                  Đã mua thành công
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif-display text-4xl font-semibold text-[#1F453E]">
                  {Math.max(0, stats.totalItems - stats.unpurchasedCount)}
                </span>
                <span className="text-xs font-medium text-[#52665F]">món đã chuyển vào tủ</span>
              </div>
              <p className="mt-2 text-xs text-[#6B7B76]">
                Đã thành trang phục thực tế
              </p>
            </div>
          </section>

          {/* 2. THANH LỌC VÀ ĐIỀU HƯỚNG */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1F453E]/15 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7B76] mr-1">
                Lọc danh mục:
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-[#1F453E] text-white'
                    : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
                }`}
              >
                Tất cả
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    categoryFilter === cat
                      ? 'bg-[#1F453E] text-white'
                      : 'border border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Loc trang thai */}
              <select
                value={purchasedFilter}
                onChange={(e) => setPurchasedFilter(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F453E] focus:outline-none"
              >
                <option value="false">Chưa mua (Đang mong muốn)</option>
                <option value="true">Đã mua thành công</option>
                <option value="all">Tất cả trạng thái</option>
              </select>

              {/* Loc muc do uu tien */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F453E] focus:outline-none"
              >
                <option value="all">Tất cả ưu tiên</option>
                <option value="high">🔥 Ưu tiên cao</option>
                <option value="medium">⭐ Ưu tiên vừa</option>
                <option value="low">🌱 Ưu tiên thấp</option>
              </select>
            </div>
          </div>

          {/* 3. NỘI DUNG CHÍNH (LOADING / ERROR / EMPTY / GRID) */}
          {loading && !data && <LoadingState label="Đang tải danh sách Wishlist..." />}

          {error && !data && (
            <div className="py-8">
              <ErrorState message={error} onRetry={() => void reload()} busy={loading} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-[#1F453E]/15 bg-white p-10 text-center shadow-2xs">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                <Heart size={28} />
              </span>
              <h3 className="font-serif-display text-2xl font-semibold text-[#1F453E]">
                Wishlist đang trống
              </h3>
              <p className="mt-2 max-w-md text-sm text-[#52665F]">
                Hãy thêm những món đồ bạn đang ngắm nghía hoặc có dự định mua sắm để hệ thống giúp bạn theo dõi ngân sách và cảnh báo chống mua trùng!
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F]"
              >
                + Thêm món đầu tiên
              </button>
            </div>
          )}

          {/* LƯỚI DANH SÁCH MÓN ĐỒ WISHLIST */}
          {items.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const isHigh = item.priority === 'high';
                const isLow = item.priority === 'low';

                return (
                  <div
                    key={item._id}
                    className={`relative flex flex-col justify-between rounded-2xl border p-5 shadow-2xs transition-all hover:shadow-md ${
                      item.isPurchased
                        ? 'border-[#CBD5E1] bg-[#FAF9F5]/70 opacity-80'
                        : item.hasDuplicate
                        ? 'border-amber-400 bg-white ring-1 ring-amber-300'
                        : 'border-[#1F453E]/15 bg-white'
                    }`}
                  >
                    <div>
                      {/* Header Card: Ưu tiên & Trạng thái */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            item.isPurchased
                              ? 'bg-emerald-100 text-emerald-800'
                              : isHigh
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.isPurchased
                            ? '✓ Đã sở hữu'
                            : isHigh
                            ? '🔥 Cần mua sớm'
                            : isLow
                            ? '🌱 Tham khảo'
                            : '⭐ Đang cân nhắc'}
                        </span>

                        <span className="text-xs font-bold text-[#1F453E]">
                          {item.price ? `${item.price.toLocaleString('vi-VN')} ₫` : 'Chưa có giá'}
                        </span>
                      </div>

                      {/* Cảnh báo mua trùng đồ nếu có */}
                      {!item.isPurchased && item.hasDuplicate && (
                        <div
                          onClick={() => setViewingDuplicatesItem(item)}
                          className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 transition-colors hover:bg-amber-100"
                        >
                          <div className="flex items-center gap-1.5 truncate font-medium">
                            <AlertTriangle size={13} className="shrink-0 text-amber-700" />
                            <span className="truncate">
                              Trùng màu &amp; loại với {item.duplicates?.length || 1} món trong tủ
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold underline">Xem</span>
                        </div>
                      )}

                      {/* Ảnh & Thông tin */}
                      <div className="mt-3.5 flex gap-3.5">
                        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#CBD5E1]/60 bg-[#FAF9F5] p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-base text-[#1F453E]" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7B76]">
                            <span className="rounded bg-[#869BB2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1F453E]">
                              {CATEGORY_LABELS[item.category]}
                            </span>
                            {item.brand && <span>· {item.brand}</span>}
                          </div>

                          {/* Màu sắc đã chọn */}
                          {item.colors.length > 0 && (
                            <div className="mt-2 flex items-center gap-1">
                              <span className="text-[10px] text-[#6B7B76] mr-1">Màu:</span>
                              {item.colors.map((c) => (
                                <span
                                  key={c}
                                  title={c}
                                  className="h-3.5 w-3.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-[#52665F]">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#1F453E]/10 pt-3">
                      <div>
                        {item.productUrl ? (
                          <a
                            href={item.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F453E] hover:underline"
                          >
                            <ExternalLink size={13} /> Link mua
                          </a>
                        ) : (
                          <span className="text-xs text-[#869BB2]">Chưa gắn link</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!item.isPurchased ? (
                          <button
                            type="button"
                            disabled={movingIds.has(item._id)}
                            onClick={() => void handleMoveToWardrobe(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Đánh dấu đã mua và tự động thêm vào tủ đồ"
                          >
                            {movingIds.has(item._id) ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Đang chuyển...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} /> Đã mua
                              </>
                            )}
                          </button>
                        ) : (
                          <Link
                            href="/wardrobe"
                            className="inline-flex items-center gap-1 rounded-lg border border-[#1F453E]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F453E] hover:bg-[#FAF9F5]"
                          >
                            Xem trong tủ <ArrowRight size={12} />
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50"
                          title="Xóa khỏi Wishlist"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL THÊM MỚI WISHLIST ITEM */}
        <AddWishlistModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setToast({ message: 'Đã thêm món đồ vào Wishlist thành công!', variant: 'success' });
            void reload();
          }}
        />

        {/* MODAL CHI TIẾT CÁC MÓN TRÙNG LẶP */}
        {viewingDuplicatesItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setViewingDuplicatesItem(null)}
                className="absolute right-4 top-4 rounded-full p-1 text-[#6B7B76] hover:bg-[#FAF9F5]"
              >
                ✕
              </button>

              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={20} className="text-amber-600" />
                <h3 className="font-serif-display text-lg font-semibold">
                  Đối chiếu món đồ trong tủ
                </h3>
              </div>

              <p className="mt-2 text-xs text-[#52665F]">
                Món đồ dự định mua: <strong className="text-[#1F453E]">{viewingDuplicatesItem.name}</strong> ({CATEGORY_LABELS[viewingDuplicatesItem.category]}).
              </p>

              <div className="mt-4 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7B76]">
                  Các món đang có trong tủ cùng loại &amp; màu:
                </p>
                {viewingDuplicatesItem.duplicates?.map((dup) => (
                  <div
                    key={dup._id}
                    className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 text-xs"
                  >
                    <div className="h-12 w-12 shrink-0 grid place-items-center rounded-lg bg-white border border-[#CBD5E1]/60 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dup.imageUrl} alt={dup.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#1F453E]">{dup.name}</p>
                      <p className="text-[11px] text-[#6B7B76]">
                        {CATEGORY_LABELS[dup.category]} {dup.brand ? `· ${dup.brand}` : ''}
                      </p>
                      <p className="text-[10px] font-medium text-emerald-800">
                        Đã mặc {dup.wearCount} lần {dup.purchasePrice ? `· Giá ${dup.purchasePrice.toLocaleString('vi-VN')} ₫` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingDuplicatesItem(null)}
                  className="rounded-full border border-[#1F453E] bg-[#1F453E] px-5 py-1.5 text-xs font-semibold text-white hover:bg-[#16352F]"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}

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
