'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Shirt, Search } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { AddItemModal } from '@/components/wardrobe/AddItemModal';
import { ItemCard } from '@/components/wardrobe/ItemCard';
import { Button, Chip, EmptyState, Input, Spinner } from '@/components/ui';
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
    <ProtectedLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tủ đồ của tôi</h1>
          <p className="text-sm text-[var(--muted)]">
            {items.length} món đồ đã số hóa
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Thêm món đồ
        </Button>
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc thương hiệu..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>
            Tất cả
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Shirt size={36} />}
          title={search || category !== 'all' ? 'Không tìm thấy món đồ nào' : 'Tủ đồ đang trống'}
          description={
            search || category !== 'all'
              ? 'Thử đổi bộ lọc hoặc từ khóa khác.'
              : 'Thêm món đồ đầu tiên để bắt đầu phối outfit.'
          }
          action={
            !search && category === 'all' ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Thêm món đồ
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <ItemCard key={item._id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AddItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />
    </ProtectedLayout>
  );
}
