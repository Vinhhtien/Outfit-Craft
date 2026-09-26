'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Shirt, Search } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { AddItemModal } from '@/components/wardrobe/AddItemModal';
import { ItemCard } from '@/components/wardrobe/ItemCard';
import { VButton, VChip, VSpinner } from '@/components/ui/vintage';
import { itemApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import type { Category, ClothingItem } from '@/types';

export default function WardrobePage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await itemApi.list({
        category: category === 'all' ? undefined : category,
        q: search.trim() || undefined,
        limit: 100,
      });
      setItems(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  // Debounce o tim kiem de khong goi API moi ky tu.
  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleDelete = async (item: ClothingItem) => {
    if (!confirm(`Xóa "${item.name}" khỏi tủ đồ?`)) return;
    try {
      const res = await itemApi.remove(item._id);
      if (res.message) alert(res.message);
      void load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        {/* Banner ke soc + vien luon song */}
        <section>
          <div className="bg-[repeating-linear-gradient(90deg,#E2ECC8_0px,#E2ECC8_28px,#EAF2D3_28px,#EAF2D3_56px)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-10">
              <div>
                <h1 className="font-serif-display text-4xl font-normal uppercase tracking-wide text-[#1F453E]">
                  Tủ đồ của tôi
                </h1>
                <p className="mt-1 text-sm font-medium text-[#2C4C45]">
                  {items.length} món đồ đã số hóa
                </p>
              </div>
              <VButton onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Thêm món đồ
              </VButton>
            </div>
          </div>
          <svg className="block h-4 w-full" aria-hidden="true">
            <defs>
              <pattern id="wardrobe-scallop" width="56" height="16" patternUnits="userSpaceOnUse">
                <path d="M0 0 A14 14 0 0 0 28 0" fill="#E2ECC8" stroke="#1F453E" strokeWidth="1.5" />
                <path d="M28 0 A14 14 0 0 0 56 0" fill="#EAF2D3" stroke="#1F453E" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="16" fill="url(#wardrobe-scallop)" />
          </svg>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 space-y-4">
            <div className="relative max-w-sm">
              <Search
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7B76]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc thương hiệu..."
                className="w-full rounded-full border border-[#9EB0A8] bg-white py-2.5 pl-10 pr-5 text-sm text-[#1F453E] shadow-sm transition-colors placeholder:text-[#6B7B76] focus:border-[#1F453E] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <VChip active={category === 'all'} onClick={() => setCategory('all')}>
                Tất cả
              </VChip>
              {CATEGORIES.map((c) => (
                <VChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </VChip>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {loading ? (
            <div className="grid place-items-center py-20">
              <VSpinner />
            </div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-[#869BB2] bg-white/80 p-12 text-center shadow-sm">
              <Shirt size={36} className="mb-3 text-[#869BB2]" />
              <p className="font-serif-display text-xl font-semibold text-[#1F453E]">
                {search || category !== 'all' ? 'Không tìm thấy món đồ nào' : 'Tủ đồ đang trống'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-[#6B7B76]">
                {search || category !== 'all'
                  ? 'Thử đổi bộ lọc hoặc từ khóa khác.'
                  : 'Thêm món đồ đầu tiên để bắt đầu phối outfit.'}
              </p>
              {!search && category === 'all' && (
                <VButton onClick={() => setModalOpen(true)} className="mt-5">
                  <Plus size={16} /> Thêm món đồ
                </VButton>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((item) => (
                <ItemCard key={item._id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />
    </ProtectedLayout>
  );
}
