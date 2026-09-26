'use client';

import { Trash2, Plus } from 'lucide-react';
import { CATEGORY_LABELS } from '@/types';
import type { ClothingItem } from '@/types';

export function ItemCard({
  item,
  onDelete,
  onAdd,
}: {
  item: ClothingItem;
  onDelete?: (item: ClothingItem) => void;
  onAdd?: (item: ClothingItem) => void;
}) {
  return (
    <div className="group relative rounded-xl border border-[#CBD5E1] bg-white p-3 text-[#1F453E] shadow-sm transition-all hover:border-[#1F453E]">
      <div className="grid aspect-square place-items-center rounded-lg bg-[#F8F9F5] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
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
        {item.wearCount > 0 && (
          <p className="mt-1.5 inline-block rounded-full bg-[#869BB2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1F453E]">
            Đã mặc {item.wearCount} lần
          </p>
        )}
      </div>

      {/* Nut hanh dong chi hien khi hover */}
      <div className="absolute right-5 top-5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onAdd && (
          <button
            onClick={() => onAdd(item)}
            title="Thêm vào canvas"
            className="grid h-7 w-7 place-items-center rounded-full bg-[#1F453E] text-white shadow hover:bg-[#16352F]"
          >
            <Plus size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(item)}
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
