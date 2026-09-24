'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Save, Trash2, ArrowUp, ArrowDown, FlipHorizontal,
  Layers, Eraser, Shirt,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { OutfitCanvas, type OutfitCanvasHandle } from '@/components/canvas/OutfitCanvas';
import { Button, Chip, Input, Modal, Spinner, EmptyState } from '@/components/ui';
import { itemApi, outfitApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABELS, OCCASIONS, OCCASION_LABELS } from '@/types';
import type { Category, ClothingItem, Occasion } from '@/types';

export default function StudioPage() {
  const canvasRef = useRef<OutfitCanvasHandle>(null);

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [hasSelection, setHasSelection] = useState(false);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    occasions: [] as Occasion[],
    isPublic: false,
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await itemApi.list({ limit: 100 });
        setItems(res.data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  const filtered =
    category === 'all' ? items : items.filter((i) => i.category === category);

  const handleSelectionChange = useCallback((v: boolean) => setHasSelection(v), []);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { items: outfitItems, canvasJSON } = canvas.serialize();
    if (outfitItems.length === 0) {
      setError('Hãy thêm ít nhất một món đồ lên canvas trước khi lưu.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await outfitApi.create({
        name: form.name.trim(),
        items: outfitItems,
        canvasJSON,
        thumbnailDataUrl: canvas.exportThumbnail(),
        occasions: form.occasions,
        isPublic: form.isPublic,
      });

      setSaveOpen(false);
      setForm({ name: '', occasions: [], isPublic: false });
      canvas.clear();
      alert('Đã lưu outfit vào bộ sưu tập!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toolbar = [
    { icon: ArrowUp, label: 'Đưa lên trên', action: () => canvasRef.current?.bringForward(), needSel: true },
    { icon: ArrowDown, label: 'Đưa xuống dưới', action: () => canvasRef.current?.sendBackward(), needSel: true },
    { icon: FlipHorizontal, label: 'Lật ngang', action: () => canvasRef.current?.flipSelected(), needSel: true },
    { icon: Trash2, label: 'Xóa khỏi canvas', action: () => canvasRef.current?.removeSelected(), needSel: true },
    { icon: Layers, label: 'Tự sắp lớp theo loại', action: () => canvasRef.current?.autoArrange(), needSel: false },
    { icon: Eraser, label: 'Xóa toàn bộ canvas', action: () => canvasRef.current?.clear(), needSel: false },
  ];

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Phối đồ</h1>
          <p className="text-sm text-[var(--muted)]">
            Bấm vào món đồ bên trái để thêm lên canvas, rồi kéo-thả để sắp xếp.
          </p>
        </div>
        <Button onClick={() => setSaveOpen(true)}>
          <Save size={16} /> Lưu outfit
        </Button>
      </div>

      {error && !saveOpen && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: tu do */}
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
          <h2 className="mb-2 text-sm font-semibold">Tủ đồ</h2>

          <div className="mb-3 flex flex-wrap gap-1">
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>
              Tất cả
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>

          {loadingItems ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              Chưa có món đồ nào ở mục này.
            </p>
          ) : (
            <div className="grid max-h-[560px] grid-cols-3 gap-2 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item._id}
                  onClick={() => void canvasRef.current?.addItem(item)}
                  title={`Thêm "${item.name}" lên canvas`}
                  className="canvas-checker grid aspect-square place-items-center rounded-lg border border-[var(--border)] p-1 transition-colors hover:border-[var(--primary)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Canvas + toolbar */}
        <section className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-1.5">
            {toolbar.map(({ icon: Icon, label, action, needSel }) => (
              <button
                key={label}
                onClick={action}
                disabled={needSel && !hasSelection}
                title={label}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          <OutfitCanvas ref={canvasRef} onSelectionChange={handleSelectionChange} />

          <p className="text-xs text-[var(--muted)]">
            Mẹo: chọn một món rồi nhấn phím Delete để xóa nhanh khỏi canvas.
          </p>
        </section>
      </div>

      {/* Modal luu outfit */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Lưu outfit">
        <div className="space-y-3">
          <Input
            label="Tên outfit"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Đi làm ngày mưa"
          />

          <div>
            <span className="mb-1.5 block text-sm font-medium">Dịp mặc</span>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o}
                  active={form.occasions.includes(o)}
                  onClick={() =>
                    setForm({
                      ...form,
                      occasions: form.occasions.includes(o)
                        ? form.occasions.filter((x) => x !== o)
                        : [...form.occasions, o],
                    })
                  }
                >
                  {OCCASION_LABELS[o]}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Chia sẻ công khai lên feed OOTD
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSaveOpen(false)} className="flex-1">
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              Lưu
            </Button>
          </div>
        </div>
      </Modal>
    </ProtectedLayout>
  );
}
