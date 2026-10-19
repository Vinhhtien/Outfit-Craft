'use client';
import { useCategoryLabels } from '@/store/categoryStore';

import { useCallback, useRef, useState } from 'react';
import { Plus, Shirt, Search } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { AddItemModal } from '@/components/wardrobe/AddItemModal';
import { ItemCard } from '@/components/wardrobe/ItemCard';
// ===== NEW: Xem/Sua Item =====
import { ItemDetailModal } from '@/components/wardrobe/ItemDetailModal';
// ===== END NEW =====
// ===== NEW: Delete Confirmation Popup =====
import { DeleteConfirmModal } from '@/components/wardrobe/DeleteConfirmModal';
// ===== END NEW =====
import { VButton, VChip, VToast } from '@/components/ui/vintage';
import { useResource } from '@/hooks/useResource';
import { CardSkeletons, LoadingState, ErrorState } from '@/components/ui/AsyncState';
import { itemApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { CATEGORIES } from '@/types';
import type { Category, ClothingItem } from '@/types';

export default function WardrobePage() {
  const CATEGORY_LABELS = useCategoryLabels();
  const deletingRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  // ===== NEW: Xem/Sua Item =====
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // ===== END NEW =====
  // ===== NEW: Delete Confirmation Popup =====
  const [itemToDelete, setItemToDelete] = useState<ClothingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // ===== END NEW =====
  // ===== NEW: Toast thay alert() =====
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );
  // ===== END NEW =====

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');

  const loader = useCallback((signal: AbortSignal) => itemApi.list({
    category: category === 'all' ? undefined : category, q: search.trim() || undefined, limit: 100,
  }, signal).then((response) => response.data), [category, search]);
  const { data, setData: setItems, loading, error, reload: load } = useResource(loader, 300);
  const items = data ?? [];

  // ===== NEW: Delete Confirmation Popup =====
  /** Chi goi khi nguoi dung bam "Xac nhan xoa" tren popup (thay cho window.confirm). */
  const handleDelete = async (item: ClothingItem) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      const res = await itemApi.remove(item._id);
      setItemToDelete(null);
      // ===== NEW: Toast thay alert() =====
      if (res.message) setToast({ message: res.message, variant: 'success' });
      setItems((previous) => previous?.filter((value) => value._id !== item._id) ?? null);
      void load();
    } catch (err) {
      setItemToDelete(null);
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const closeDeleteConfirm = useCallback(() => { if (!deletingRef.current) setItemToDelete(null); }, []);
  // ===== END NEW =====
  // ===== NEW: Toast thay alert() =====
  const closeToast = useCallback(() => setToast(null), []);
  // ===== END NEW =====

  // ===== NEW: Xem/Sua Item =====
  /** Cap nhat local state thay vi re-fetch -> luoi khong nhay spinner sau modal. */
  const handleItemUpdated = (updated: ClothingItem) => {
    setItems((prev) =>
      (prev ?? [])
        .map((it) => (it._id === updated._id ? updated : it))
        // Dang loc theo danh muc ma doi sang danh muc khac -> an khoi luoi.
        .filter((it) => category === 'all' || it.category === category)
    );
    void load();
  };
  // ===== END NEW =====

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex-1 bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        {/* Banner ke soc + vien luon song */}
        <ScallopBanner>
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
        </ScallopBanner>

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

          {error && <ErrorState message={error} onRetry={() => void load()} busy={loading} />}
          {error && data && <p className="mb-3 text-xs text-[#52665F]">Đang hiển thị dữ liệu của lần tải thành công gần nhất.</p>}
          {loading && data !== null && <LoadingState compact label="Đang cập nhật tủ đồ…" />}
          {loading && data === null ? <CardSkeletons /> : error && data === null ? null : items.length === 0 ? (
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
                <ItemCard
                  key={item._id}
                  item={item}
                  // ===== NEW: Delete Confirmation Popup ===== mo popup thay vi xoa ngay
                  onDelete={setItemToDelete}
                  // ===== NEW: Xem/Sua Item =====
                  onClick={(it) => setSelectedItemId(it._id)}
                />

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

      {/* ===== NEW: Xem/Sua Item ===== */}
      {selectedItemId && (
        <ItemDetailModal
          key={selectedItemId}
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onUpdated={handleItemUpdated}
        />
      )}

      {/* ===== NEW: Delete Confirmation Popup ===== */}
      <DeleteConfirmModal
        open={Boolean(itemToDelete)}
        title="Xóa món đồ?"
        description={
          <>
            Bạn có chắc chắn muốn xóa &ldquo;{itemToDelete?.name}&rdquo; khỏi tủ đồ không? Nếu
            món đồ này đang được dùng trong Outfit nào đó, hệ thống sẽ tự động chuyển nó sang
            kho lưu trữ (Archived) thay vì xóa vĩnh viễn để không làm hỏng bộ phối.
          </>
        }
        deleting={deleting}
        onCancel={closeDeleteConfirm}
        onConfirm={() => itemToDelete && void handleDelete(itemToDelete)}
      />

      {/* ===== NEW: Toast thay alert() ===== */}
      <VToast
        message={toast?.message ?? null}
        variant={toast?.variant}
        duration={4000}
        onClose={closeToast}
      />
    </ProtectedLayout>
  );
}
