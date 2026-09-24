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
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-md">
      <div className="canvas-checker grid aspect-square place-items-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="border-t border-[var(--border)] p-2.5">
        <p className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">
            {CATEGORY_LABELS[item.category]}
          </span>
          <div className="flex gap-1">
            {item.colors.slice(0, 3).map((c) => (
              <span
                key={c}
                className="h-3 w-3 rounded-full border border-[var(--border)]"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {item.wearCount > 0 && (
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Đã mặc {item.wearCount} lần
          </p>
        )}
      </div>

      {/* Nut hanh dong chi hien khi hover */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onAdd && (
          <button
            onClick={() => onAdd(item)}
            title="Thêm vào canvas"
            className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary)] text-white shadow hover:bg-indigo-600"
          >
            <Plus size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(item)}
            title="Xóa"
            className="grid h-7 w-7 place-items-center rounded-lg bg-white text-red-500 shadow hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
