'use client';
import { useCategoryLabels } from '@/store/categoryStore';

import { Trash2, Plus } from 'lucide-react';
import { CloudImage } from '@/components/ui/CloudImage';
import type { ClothingItem } from '@/types';

export function ItemCard({
  item,
  onDelete,
  onAdd,
  onClick,
}: {
  item: ClothingItem;
  onDelete?: (item: ClothingItem) => void;
  onAdd?: (item: ClothingItem) => void;
  // ===== NEW: Xem/Sua Item =====
  /** Bam vao the -> mo ItemDetailModal. */
  onClick?: (item: ClothingItem) => void;
  // ===== END NEW =====
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  return (
    <div
      // ===== NEW: Xem/Sua Item =====
      onClick={onClick ? () => onClick(item) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onClick(item);
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      // ===== END NEW =====
      className={`group relative rounded-xl border border-[#CBD5E1] bg-white p-3 text-[#1F453E] shadow-sm transition-all hover:border-[#1F453E] ${
        onClick ? 'cursor-pointer focus:outline-none focus-visible:border-[#1F453E]' : ''
      }`}
    >
      <div className="grid aspect-square place-items-center rounded-lg bg-[#F8F9F5] p-3">
        <CloudImage
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="mt-3">
        <p className="truncate text-sm font-semibold" title={item.name}>
          {item.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate rounded-full border border-[#869BB2] bg-[#869BB2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1F453E]">
            {CATEGORY_LABELS[item.category]}
          </span>
          <div className="flex shrink-0 gap-1">
            {item.colors.slice(0, 3).map((c) => (
              <span
                key={c}
                className="h-3 w-3 rounded-full border border-[#CBD5E1]"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.wearCount > 0 && (
            <span className="rounded-full bg-[#869BB2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1F453E]">
              Đã mặc {item.wearCount} lần
            </span>
          )}
          {typeof item.purchasePrice === 'number' && item.purchasePrice > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                item.wearCount > 0
                  ? 'border border-emerald-600/20 bg-emerald-50 text-emerald-800'
                  : 'border border-[#869BB2]/30 bg-white text-[#52665F]'
              }`}
              title={
                item.wearCount > 0
                  ? `Giá mua: ${item.purchasePrice.toLocaleString('vi-VN')} ₫ · Chi phí mỗi lần mặc: ~${Math.round(
                      item.purchasePrice / item.wearCount
                    ).toLocaleString('vi-VN')} ₫/lần`
                  : `Giá mua: ${item.purchasePrice.toLocaleString('vi-VN')} ₫ (Chưa mặc lần nào)`
              }
            >
              {item.wearCount > 0
                ? `~${Math.round(item.purchasePrice / item.wearCount).toLocaleString('vi-VN')} ₫/lần`
                : `${item.purchasePrice.toLocaleString('vi-VN')} ₫`}
            </span>
          )}
        </div>
      </div>

      {/* Nut hanh dong chi hien khi hover */}
      <div className="absolute right-5 top-5 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {onAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // ===== NEW: Xem/Sua Item ===== khong mo modal
              onAdd(item);
            }}
            title="Thêm vào canvas"
            className="grid h-7 w-7 place-items-center rounded-full bg-[#1F453E] text-white shadow hover:bg-[#16352F]"
          >
            <Plus size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // ===== NEW: Xem/Sua Item ===== khong mo modal
              onDelete(item);
            }}
            title="Xóa"
            className="grid h-7 w-7 place-items-center rounded-full border border-[#CBD5E1] bg-white text-red-500 shadow hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
