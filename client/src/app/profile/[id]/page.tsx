'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart,
  Layers,
  Calendar,
  ExternalLink,
  ArrowLeft,
  Settings,
  Sparkles,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { VButton, VModal } from '@/components/ui/vintage';
import { useResource } from '@/hooks/useResource';
import { userApi } from '@/lib/services';
import { useAuthStore } from '@/store/authStore';
import {
  SEASON_LABELS,
  OCCASION_LABELS,
  CATEGORY_LABELS,
} from '@/types';
import type { Category, Outfit } from '@/types';

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'U';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface ItemDetail {
  _id: string;
  name: string;
  imageUrl: string;
  category: Category;
  brand?: string;
}

export default function UserPublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const currentUser = useAuthStore((s) => s.user);

  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) => userApi.getPublicProfile(userId, signal),
    [userId]
  );

  const { data, loading, error, reload } = useResource(loader);

  const isMe = currentUser?.id === userId;

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        {/* Banner */}
        <ScallopBanner compact innerClassName="max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="grid h-8 w-8 place-items-center rounded-full border border-[#1F453E]/20 bg-white/80 text-[#1F453E] transition-all hover:bg-white"
              title="Quay lại"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-serif-display text-2xl font-normal uppercase tracking-wider text-[#1F453E] sm:text-3xl">
                Trang cá nhân
              </h1>
              <p className="text-xs font-medium text-[#2C4C45]">
                {data ? `Bản phối và phong cách của ${data.user.displayName}` : 'Hồ sơ người dùng'}
              </p>
            </div>
          </div>

          <Link
            href="/ootd"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E]/30 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1F453E] shadow-2xs transition-all hover:bg-white"
          >
            Về Bảng tin OOTD
          </Link>
        </ScallopBanner>

        <div className="mx-auto max-w-6xl px-6 pb-12 pt-6">
          {error && <ErrorState message={error} onRetry={() => void reload()} busy={loading} />}

          {loading && !data && <LoadingState label="Đang tải thông tin trang cá nhân..." />}

          {data && (
            <div className="space-y-8">
              {/* Profile Card Header */}
              <div className="relative overflow-hidden rounded-3xl border border-[#1F453E]/15 bg-white p-6 shadow-[0_4px_24px_rgba(31,69,62,0.04)] sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  {/* User info */}
                  <div className="flex items-center gap-5">
                    {data.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.user.avatarUrl}
                        alt={data.user.displayName}
                        className="h-20 w-20 rounded-full border-2 border-[#1F453E]/20 object-cover shadow-sm sm:h-24 sm:w-24"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#1F453E]/20 bg-[#E2ECC8] font-serif-display text-2xl font-bold text-[#1F453E] shadow-sm sm:h-24 sm:w-24 sm:text-3xl">
                        {getInitials(data.user.displayName)}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-serif-display text-2xl font-bold text-[#1F453E] sm:text-3xl">
                          {data.user.displayName}
                        </h2>
                        {isMe && (
                          <span className="rounded-full bg-[#E2ECC8] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1F453E]">
                            Bạn
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 text-xs text-[#6B7B76]">
                        <Calendar size={13} />
                        <span>
                          Thành viên từ{' '}
                          {new Date(data.user.createdAt).toLocaleDateString('vi-VN', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Edit if isMe */}
                  {isMe ? (
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#FAF9F5] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#1F453E] transition-all hover:bg-[#E2ECC8]/60"
                    >
                      <Settings size={14} /> Chỉnh sửa hồ sơ của tôi
                    </Link>
                  ) : null}
                </div>

                {/* Stats KPIs */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#E2ECC8]/80 pt-6 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#1F453E]/10 bg-[#FAF9F5] p-4 text-center">
                    <p className="font-serif-display text-2xl font-bold text-[#1F453E] sm:text-3xl">
                      {data.stats.publicOutfitCount}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B7B76]">
                      Bản phối công khai
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#1F453E]/10 bg-[#FAF9F5] p-4 text-center">
                    <p className="font-serif-display text-2xl font-bold text-rose-600 sm:text-3xl">
                      {data.stats.totalLikesReceived}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B7B76]">
                      Lượt thích nhận được
                    </p>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-[#1F453E]/10 bg-[#FAF9F5] p-4 text-center sm:col-span-1">
                    <p className="font-serif-display text-2xl font-bold text-[#1F453E] sm:text-3xl">
                      {data.outfits.length > 0
                        ? new Set(data.outfits.flatMap((o) => o.occasions || [])).size
                        : 0}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B7B76]">
                      Dịp phối đồ đa dạng
                    </p>
                  </div>
                </div>
              </div>

              {/* Public Outfits Gallery */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-[#1F453E]" />
                    <h3 className="font-serif-display text-xl font-bold text-[#1F453E]">
                      Bộ sưu tập bản phối ({data.outfits.length})
                    </h3>
                  </div>
                </div>

                {data.outfits.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#869BB2] bg-white p-12 text-center">
                    <Layers size={36} className="mx-auto text-[#869BB2]" />
                    <h4 className="mt-3 font-serif-display text-base font-bold text-[#1F453E]">
                      Chưa có bản phối công khai nào
                    </h4>
                    <p className="mt-1 text-xs text-[#6B7B76]">
                      {isMe
                        ? 'Bạn chưa chia sẻ bản phối nào lên cộng đồng. Hãy phối đồ và chọn Công khai!'
                        : 'Người dùng này chưa chia sẻ bản phối nào lên cộng đồng.'}
                    </p>
                    {isMe && (
                      <Link
                        href="/studio"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white"
                      >
                        Phối đồ ngay
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {data.outfits.map((outfit) => (
                      <article
                        key={outfit._id}
                        onClick={() => setSelectedOutfit(outfit)}
                        className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xs transition-all hover:border-[#1F453E] hover:shadow-md"
                      >
                        <div>
                          {/* Image Thumbnail */}
                          <div className="aspect-[3/4] overflow-hidden bg-[#FAF9F5] p-3">
                            {outfit.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={outfit.thumbnailUrl}
                                alt={outfit.name}
                                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-[#869BB2]">
                                Không có ảnh thumbnail
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4 pb-2">
                            <h4 className="font-serif-display text-base font-semibold text-[#1F453E] group-hover:underline">
                              {outfit.name}
                            </h4>

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
                                  className="rounded-full border border-[#CBD5E1] bg-[#FAF9F5] px-2 py-0.5 text-[10px] font-medium text-[#52665F]"
                                >
                                  {SEASON_LABELS[s] || s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Bottom bar */}
                        <div className="flex items-center justify-between border-t border-[#E2ECC8]/60 bg-[#FAF9F5]/40 px-4 py-2.5">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                            <Heart size={14} className="fill-rose-500 text-rose-500" />
                            <span>{outfit.likeCount || 0}</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/studio?outfit=${outfit._id}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F453E] transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/50"
                          >
                            <ExternalLink size={11} /> Thử trong Studio
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outfit Modal */}
      {selectedOutfit && (
        <VModal
          open={!!selectedOutfit}
          onClose={() => setSelectedOutfit(null)}
          title={selectedOutfit.name}
          wide
          serifTitle
        >
          <div className="grid gap-6 md:grid-cols-2">
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

            <div className="flex flex-col justify-between space-y-4">
              <div>
                <p className="font-serif-display text-xl font-bold text-[#1F453E]">
                  {selectedOutfit.name}
                </p>
                <p className="mt-1 text-xs text-[#6B7B76]">
                  Tạo bởi {data?.user.displayName} • {new Date(selectedOutfit.createdAt).toLocaleDateString('vi-VN')}
                </p>

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

                  {selectedOutfit.items && selectedOutfit.items.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#869BB2]">
                        Các món đồ ({selectedOutfit.items.length}):
                      </p>
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                        {selectedOutfit.items.map(({ item }) => {
                          const it = item as unknown as ItemDetail;
                          return it ? (
                            <div
                              key={it._id}
                              className="flex items-center gap-2.5 rounded-xl border border-[#CBD5E1] bg-[#FAF9F5] p-2"
                            >
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white p-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={it.imageUrl}
                                  alt={it.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[#1F453E]">
                                  {it.name}
                                </p>
                                <p className="text-[10px] text-[#6B7B76]">
                                  {CATEGORY_LABELS[it.category] || it.category}
                                  {it.brand ? ` • ${it.brand}` : ''}
                                </p>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
