'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Heart,
  MessageCircle,
  ExternalLink,
  Search,
  Layers,
  X,
  Plus,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { VButton, VModal } from '@/components/ui/vintage';
import { useResource } from '@/hooks/useResource';
import { outfitApi } from '@/lib/services';
import {
  SEASONS,
  SEASON_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  CATEGORY_LABELS,
} from '@/types';
import type { Category, Occasion, Season } from '@/types';

interface FeedOwner {
  _id: string;
  displayName: string;
  avatarUrl?: string;
}

interface FeedItemDetail {
  _id: string;
  name: string;
  imageUrl: string;
  category: Category;
  brand?: string;
}

interface FeedOutfit {
  _id: string;
  name: string;
  thumbnailUrl?: string;
  tags: string[];
  seasons: Season[];
  occasions: Occasion[];
  likeCount: number;
  createdAt: string;
  owner: FeedOwner | string;
  items?: { item: FeedItemDetail }[];
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateString).toLocaleDateString('vi-VN');
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'U';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function OotdFeedPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<Season | 'all'>('all');
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | 'all'>('all');
  const [selectedOutfit, setSelectedOutfit] = useState<FeedOutfit | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) =>
      outfitApi.feed(
        {
          page,
          limit: 12,
          season: selectedSeason === 'all' ? undefined : selectedSeason,
          occasion: selectedOccasion === 'all' ? undefined : selectedOccasion,
          q: searchQuery.trim() || undefined,
        },
        signal
      ),
    [page, selectedSeason, selectedOccasion, searchQuery]
  );

  const { data: res, loading, error, reload } = useResource(loader);

  const outfits = (res?.data ?? []) as unknown as FeedOutfit[];
  const pagination = res?.pagination;

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner compact innerClassName="max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
                <Compass size={18} />
              </span>
              <h1 className="font-serif-display text-2xl font-normal uppercase tracking-wider text-[#1F453E] sm:text-3xl">
                Bảng tin OOTD
              </h1>
            </div>
            <p className="mt-1 text-xs font-medium text-[#2C4C45] sm:text-sm">
              Khám phá và học hỏi các phong cách phối đồ ấn tượng từ cộng đồng OutfitCraft.
            </p>
          </div>

          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#16352F]"
          >
            <Plus size={15} /> Tạo bản phối mới
          </Link>
        </ScallopBanner>

        <div className="mx-auto max-w-6xl px-6 pb-12 pt-6">
          {/* Filters & Search */}
          <div className="mb-6 rounded-2xl border border-[#1F453E]/15 bg-white p-4 shadow-[0_4px_20px_rgba(31,69,62,0.03)] sm:p-5">
            <div className="flex flex-col gap-4">
              {/* Search bar */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#869BB2]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm kiếm outfit theo tên..."
                  className="w-full rounded-full border border-[#869BB2]/50 bg-[#FAF9F5] py-2 pl-10 pr-4 text-sm text-[#1F453E] transition-all placeholder:text-[#6B7B76] focus:border-[#1F453E] focus:bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#869BB2] hover:text-[#1F453E]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Occasion chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-[#869BB2]">Dịp mặc:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOccasion('all');
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    selectedOccasion === 'all'
                      ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-2xs'
                      : 'border-[#869BB2]/40 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
                  }`}
                >
                  Tất cả
                </button>
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => {
                      setSelectedOccasion(occ);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      selectedOccasion === occ
                        ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-2xs'
                        : 'border-[#869BB2]/40 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
                    }`}
                  >
                    {OCCASION_LABELS[occ]}
                  </button>
                ))}
              </div>

              {/* Season chips */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E2ECC8]/60 pt-3">
                <span className="mr-1 text-xs font-semibold text-[#869BB2]">Mùa:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeason('all');
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    selectedSeason === 'all'
                      ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-2xs'
                      : 'border-[#869BB2]/40 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
                  }`}
                >
                  Tất cả
                </button>
                {SEASONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedSeason(s);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      selectedSeason === s
                        ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-2xs'
                        : 'border-[#869BB2]/40 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E]'
                    }`}
                  >
                    {SEASON_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feed Content */}
          {error && <ErrorState message={error} onRetry={() => void reload()} busy={loading} />}

          {loading && !res && <LoadingState label="Đang tải bảng tin OOTD..." />}

          {outfits.length === 0 && !loading && !error && (
            <div className="rounded-2xl border border-dashed border-[#869BB2] bg-white p-12 text-center">
              <Compass size={36} className="mx-auto text-[#869BB2]" />
              <h3 className="mt-3 font-serif-display text-lg font-bold text-[#1F453E]">
                Chưa có bản phối nào phù hợp
              </h3>
              <p className="mt-1 text-xs text-[#6B7B76]">
                Hãy thử thay đổi tiêu chí lọc hoặc phối một bộ đồ mới và chia sẻ lên cộng đồng!
              </p>
              <Link
                href="/studio"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white"
              >
                <Plus size={14} /> Phối đồ ngay
              </Link>
            </div>
          )}

          {outfits.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {outfits.map((outfit) => {
                const owner = typeof outfit.owner === 'object' ? outfit.owner : null;
                const ownerName = owner?.displayName || 'Người dùng ẩn danh';
                const ownerAvatar = owner?.avatarUrl;

                return (
                  <article
                    key={outfit._id}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-md"
                  >
                    <div>
                      {/* Post Header: Author info */}
                      <div className="flex items-center justify-between border-b border-[#FAF9F5] p-3.5">
                        <Link
                          href={`/profile/${owner?._id || ''}`}
                          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                        >
                          {ownerAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ownerAvatar}
                              alt={ownerName}
                              className="h-8 w-8 rounded-full border border-[#1F453E]/20 object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2ECC8] text-xs font-bold text-[#1F453E]">
                              {getInitials(ownerName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#1F453E]">
                              {ownerName}
                            </p>
                            <p className="text-[10px] text-[#6B7B76]">
                              {timeAgo(outfit.createdAt)}
                            </p>
                          </div>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setSelectedOutfit(outfit)}
                          className="rounded-full p-1 text-[#869BB2] transition-colors hover:bg-[#FAF9F5] hover:text-[#1F453E]"
                          title="Xem chi tiết"
                        >
                          <Layers size={16} />
                        </button>
                      </div>

                      {/* Outfit Canvas Thumbnail Preview */}
                      <div
                        onClick={() => setSelectedOutfit(outfit)}
                        className="group relative aspect-[3/4] cursor-pointer overflow-hidden bg-[#FAF9F5] p-2"
                      >
                        {outfit.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={outfit.thumbnailUrl}
                            alt={outfit.name}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#869BB2]">
                            Bản phối chưa có ảnh thumbnail
                          </div>
                        )}
                      </div>

                      {/* Outfit Title & Tags */}
                      <div className="p-3.5 pb-2">
                        <h3
                          onClick={() => setSelectedOutfit(outfit)}
                          className="cursor-pointer font-serif-display text-base font-semibold text-[#1F453E] hover:underline"
                        >
                          {outfit.name}
                        </h3>

                        {/* Badges: Occasions & Seasons */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {outfit.occasions?.map((occ) => (
                            <span
                              key={occ}
                              className="rounded-full bg-[#E2ECC8]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#1F453E]"
                            >
                              {OCCASION_LABELS[occ] || occ}
                            </span>
                          ))}
                          {outfit.seasons?.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-[#FAF9F5] border border-[#CBD5E1] px-2 py-0.5 text-[10px] font-medium text-[#52665F]"
                            >
                              {SEASON_LABELS[s] || s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between border-t border-[#E2ECC8]/60 bg-[#FAF9F5]/40 px-3.5 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Heart / Like display */}
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#869BB2]">
                          <Heart size={15} className="text-[#869BB2]" />
                          <span>{outfit.likeCount || 0}</span>
                        </span>

                        {/* Comment icon */}
                        <button
                          type="button"
                          onClick={() => setSelectedOutfit(outfit)}
                          className="flex items-center gap-1 text-xs text-[#869BB2] transition-colors hover:text-[#1F453E]"
                        >
                          <MessageCircle size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/studio?outfit=${outfit._id}`)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F453E] transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/50"
                        >
                          <ExternalLink size={11} /> Thử trong Studio
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <VButton
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </VButton>
              <span className="text-xs font-bold text-[#1F453E]">
                Trang {pagination.page} / {pagination.pages}
              </span>
              <VButton
                variant="outline"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              >
                Trang sau
              </VButton>
            </div>
          )}
        </div>
      </div>

      {/* Outfit Detail Modal */}
      {selectedOutfit && (
        <VModal
          open={!!selectedOutfit}
          onClose={() => setSelectedOutfit(null)}
          title={selectedOutfit.name}
          wide
          serifTitle
        >
          <div className="grid gap-6 md:grid-cols-2">
            {/* Visual preview */}
            <div className="grid aspect-[3/4] place-items-center rounded-2xl bg-[#FAF9F5] p-3">
              {selectedOutfit.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedOutfit.thumbnailUrl}
                  alt={selectedOutfit.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-[#869BB2]">Không có ảnh</span>
              )}
            </div>

            {/* Meta details */}
            <div className="flex flex-col justify-between space-y-4">
              <div>
                {/* Author info */}
                <div className="flex items-center gap-2.5 border-b border-[#E2ECC8]/70 pb-3">
                  {typeof selectedOutfit.owner === 'object' && selectedOutfit.owner?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedOutfit.owner.avatarUrl}
                      alt={selectedOutfit.owner.displayName}
                      className="h-10 w-10 rounded-full border border-[#1F453E]/20 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2ECC8] text-sm font-bold text-[#1F453E]">
                      {getInitials(
                        typeof selectedOutfit.owner === 'object'
                          ? selectedOutfit.owner?.displayName || 'U'
                          : 'U'
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-[#1F453E]">
                      {typeof selectedOutfit.owner === 'object'
                        ? selectedOutfit.owner?.displayName
                        : 'Người dùng'}
                    </p>
                    <p className="text-xs text-[#6B7B76]">
                      Đăng lúc {new Date(selectedOutfit.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#869BB2]">
                      Dịp phù hợp:
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedOutfit.occasions?.map((occ) => (
                        <span
                          key={occ}
                          className="rounded-full bg-[#E2ECC8] px-3 py-1 text-xs font-semibold text-[#1F453E]"
                        >
                          {OCCASION_LABELS[occ] || occ}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#869BB2]">
                      Mùa thích hợp:
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedOutfit.seasons?.map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-[#CBD5E1] bg-[#FAF9F5] px-3 py-1 text-xs font-medium text-[#52665F]"
                        >
                          {SEASON_LABELS[s] || s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Items used breakdown */}
                  {selectedOutfit.items && selectedOutfit.items.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#869BB2]">
                        Các món đồ trong bản phối ({selectedOutfit.items.length}):
                      </p>
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                        {selectedOutfit.items.map(({ item }) =>
                          item ? (
                            <div
                              key={item._id}
                              className="flex items-center gap-2.5 rounded-xl border border-[#CBD5E1] bg-[#FAF9F5] p-2"
                            >
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white p-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[#1F453E]">
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-[#6B7B76]">
                                  {CATEGORY_LABELS[item.category] || item.category}
                                  {item.brand ? ` • ${item.brand}` : ''}
                                </p>
                              </div>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[#E2ECC8]/70 pt-4">
                <VButton variant="outline" onClick={() => setSelectedOutfit(null)}>
                  Đóng
                </VButton>
                <VButton
                  variant="primary"
                  onClick={() => router.push(`/studio?outfit=${selectedOutfit._id}`)}
                  className="inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Mở trong Studio
                </VButton>
              </div>
            </div>
          </div>
        </VModal>
      )}
    </ProtectedLayout>
  );
}
