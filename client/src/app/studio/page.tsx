'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Save, Trash2, ArrowUp, ArrowDown, FlipHorizontal,
  Layers, Eraser, Plus,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { OutfitCanvas, type OutfitCanvasHandle } from '@/components/canvas/OutfitCanvas';
import { VButton, VChip, VInput, VLabel, VModal, VSpinner } from '@/components/ui/vintage';
import { itemApi, outfitApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/fabricCanvas';
import { CATEGORIES, CATEGORY_LABELS, OCCASIONS, OCCASION_LABELS } from '@/types';
import type { Category, ClothingItem, Occasion } from '@/types';

export default function StudioPage() {
  const canvasRef = useRef<OutfitCanvasHandle>(null);
  const [fitRef, canvasScale] = useFitScale();

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
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner wide compact>
          <div>
            <h1 className="font-serif-display text-xl font-normal uppercase leading-tight tracking-wider text-[#1F453E] sm:text-2xl">
              Phối đồ
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#2C4C45]">
              Bấm vào món đồ bên trái để thêm lên canvas, rồi kéo-thả để sắp xếp.
            </p>
          </div>
          <button
            onClick={() => setSaveOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-all hover:bg-[#16352F]"
          >
            <Save size={14} /> Lưu outfit
          </button>
        </ScallopBanner>

        {error && !saveOpen && (
          <div className="mx-auto w-full max-w-7xl shrink-0 px-6 pt-3 lg:px-10">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-6 overflow-hidden px-6 py-3 lg:grid-cols-12 lg:grid-rows-1 lg:px-10">
          {/* Sidebar: tu do */}
          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#1F453E]/20 bg-white p-4 shadow-xs lg:col-span-4">
            <h2 className="mb-2.5 shrink-0 border-b border-[#E2ECC8] pb-2 font-serif-display text-base font-semibold text-[#1F453E]">
              Tủ đồ
            </h2>

            <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
              <SidebarChip active={category === 'all'} onClick={() => setCategory('all')}>
                Tất cả
              </SidebarChip>
              {CATEGORIES.map((c) => (
                <SidebarChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </SidebarChip>
              ))}
            </div>

            {/* Chi cuon ben trong khung nay, khong lam dai trang */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingItems ? (
                <div className="grid h-full place-items-center">
                  <VSpinner />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#869BB2]/50 bg-[#FAF9F5]/60 p-6 text-center">
                  <p className="mb-3 text-xs text-[#6B7B76]">Chưa có món đồ nào ở mục này.</p>
                  <Link
                    href="/wardrobe"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#1F453E] transition-colors hover:bg-[#1F453E] hover:text-white"
                  >
                    <Plus size={14} /> Thêm vào tủ đồ
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pr-1">
                  {filtered.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => void canvasRef.current?.addItem(item)}
                      title={`Thêm "${item.name}" lên canvas`}
                      className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] p-2 transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/30"
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
            </div>
          </aside>

          {/* Canvas + toolbar */}
          <section className="flex h-full min-h-0 flex-col items-center justify-between overflow-hidden py-1 lg:col-span-8">
            <div className="mb-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white p-1 shadow-sm">
              {toolbar.map(({ icon: Icon, label, action, needSel }) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={needSel && !hasSelection}
                  title={label}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-[#1F453E] transition-colors hover:bg-[#E2ECC8] active:bg-[#1F453E] active:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>

            {/* Vung con lai giua toolbar va dong meo: canvas tu scale cho vua */}
            <div ref={fitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
              <div className="rounded-2xl border-2 border-[#1F453E]/15 bg-white p-2 shadow-[0_8px_30px_rgba(31,69,62,0.06)]">
                <OutfitCanvas
                  ref={canvasRef}
                  onSelectionChange={handleSelectionChange}
                  scale={canvasScale}
                />
              </div>
            </div>

            <p className="mt-2 shrink-0 rounded-full border border-[#1F453E]/10 bg-[#E2ECC8]/50 px-3 py-1 text-center text-[11px] font-medium text-[#1F453E]">
              Mẹo: chọn một món rồi nhấn phím Delete để xóa nhanh khỏi canvas.
            </p>
          </section>
        </div>
      </div>

      {/* Modal luu outfit */}
      <VModal open={saveOpen} onClose={() => setSaveOpen(false)} title="Lưu outfit">
        <div className="space-y-4">
          <VInput
            label="Tên outfit"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Đi làm ngày mưa"
          />

          <div>
            <VLabel>Dịp mặc</VLabel>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <VChip
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
                </VChip>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1F453E]">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="h-4 w-4 accent-[#1F453E]"
            />
            Chia sẻ công khai lên feed OOTD
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <VButton variant="outline" onClick={() => setSaveOpen(false)} className="flex-1">
              Hủy
            </VButton>
            <VButton
              onClick={handleSave}
              loading={saving}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              Lưu
            </VButton>
          </div>
        </div>
      </VModal>
    </ProtectedLayout>
  );
}

/** Nut loc danh muc trong sidebar (nen kem, khac VChip o trang Tu do). */
function SidebarChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
        active
          ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
          : 'border-[#869BB2]/60 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E] hover:bg-[#E2ECC8]/40'
      }`}
    >
      {children}
    </button>
  );
}

/** Khung trang (p-2 + border-2) + vien net dut cua OutfitCanvas, tinh theo px. */
const CANVAS_FRAME = 22;

/**
 * Do vung trong con lai va tra ve ti le de canvas vua khit (toi da 1 = kich thuoc that).
 * Chi anh huong hien thi; Fabric van lam viec tren canvas CANVAS_WIDTH x CANVAS_HEIGHT.
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const fit = Math.min(
        1,
        (width - CANVAS_FRAME) / CANVAS_WIDTH,
        (height - CANVAS_FRAME) / CANVAS_HEIGHT
      );
      setScale(Math.max(0.2, fit));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, scale] as const;
}
