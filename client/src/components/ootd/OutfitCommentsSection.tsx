'use client';

import { useCallback, useState } from 'react';
import { Send, Trash2, MessageCircle, AlertCircle } from 'lucide-react';
import { useResource } from '@/hooks/useResource';
import { commentApi } from '@/lib/services';
import type { CommentItem } from '@/lib/services';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';

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

interface OutfitCommentsSectionProps {
  outfitId: string;
  outfitOwnerId?: string;
  onCommentCountChange?: (delta: number) => void;
}

export function OutfitCommentsSection({
  outfitId,
  outfitOwnerId,
  onCommentCountChange,
}: OutfitCommentsSectionProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);

  const loader = useCallback(
    (signal: AbortSignal) => commentApi.list(outfitId, signal),
    [outfitId]
  );

  const { data: comments, setData: setComments, loading, error, reload } = useResource(loader);

  const [inputContent, setInputContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputContent.trim();
    if (!content) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const newComment = await commentApi.create(outfitId, content);
      setInputContent('');
      setComments((prev) => [...(prev || []), newComment]);
      onCommentCountChange?.(1);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);

    try {
      await commentApi.remove(outfitId, commentId);
      setComments((prev) => (prev || []).filter((c) => c._id !== commentId));
      onCommentCountChange?.(-1);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const list = comments || [];

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center gap-2 border-b border-[#E2ECC8]/70 pb-2">
        <MessageCircle size={16} className="text-[#1F453E]" />
        <h4 className="font-serif-display text-sm font-bold text-[#1F453E]">
          Bình luận ({list.length})
        </h4>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0 text-red-600" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Comments List */}
      <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
        {loading && list.length === 0 && (
          <p className="py-4 text-center text-xs text-[#869BB2]">Đang tải bình luận...</p>
        )}

        {error && !loading && (
          <div className="py-3 text-center text-xs text-red-600">
            Không thể tải bình luận.{' '}
            <button
              type="button"
              onClick={() => void reload()}
              className="underline hover:text-red-800"
            >
              Thử lại
            </button>
          </div>
        )}

        {!loading && list.length === 0 && !error && (
          <p className="py-6 text-center text-xs text-[#869BB2]">
            Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ về bản phối này!
          </p>
        )}

        {list.map((c: CommentItem) => {
          const isAuthor = currentUserId === c.user?._id;
          const isOutfitOwner = currentUserId === outfitOwnerId;
          const canDelete = isAuthor || isOutfitOwner;

          return (
            <div
              key={c._id}
              className="group flex items-start justify-between gap-2.5 rounded-xl border border-[#CBD5E1]/60 bg-[#FAF9F5] p-2.5 transition-colors hover:border-[#1F453E]/30"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {c.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.user.avatarUrl}
                    alt={c.user.displayName}
                    className="h-7 w-7 shrink-0 rounded-full border border-[#1F453E]/20 object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E2ECC8] text-[10px] font-bold text-[#1F453E]">
                    {getInitials(c.user?.displayName || 'U')}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-bold text-[#1F453E]">
                      {c.user?.displayName || 'Người dùng'}
                    </span>
                    <span className="text-[10px] text-[#869BB2]">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#2C4C45] break-words whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDeleteComment(c._id)}
                  disabled={deletingId === c._id}
                  className="rounded p-1 text-[#869BB2] opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                  title="Xóa bình luận"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Input box */}
      <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Thêm lời nhận xét hoặc góp ý..."
          maxLength={500}
          disabled={submitting}
          className="flex-1 rounded-full border border-[#869BB2]/50 bg-white px-4 py-2 text-xs text-[#1F453E] transition-all placeholder:text-[#6B7B76] focus:border-[#1F453E] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!inputContent.trim() || submitting}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F453E] text-white transition-all hover:bg-[#16352F] disabled:cursor-not-allowed disabled:opacity-40"
          title="Gửi bình luận"
        >
          <Send size={13} className={submitting ? 'animate-pulse' : ''} />
        </button>
      </form>
    </div>
  );
}
