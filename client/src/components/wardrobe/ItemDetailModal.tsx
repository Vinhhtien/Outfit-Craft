'use client';
import { useCategoryLabels } from '@/store/categoryStore';

// ===== NEW: Xem/Sua Item =====
import { useCallback, useRef, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { VButton, VInput, VSelect, VChip, VModal, VLabel, VSpinner } from '@/components/ui/vintage';
import { CloudImage } from '@/components/ui/CloudImage';
import { useResource } from '@/hooks/useResource';
import { ErrorState } from '@/components/ui/AsyncState';
import { itemApi } from '@/lib/services';
import type { UpdateItemPayload } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import {
  CATEGORIES, STYLES, SEASONS, SEASON_LABELS,
  OCCASIONS, OCCASION_LABELS,
} from '@/types';
import type { Category, ClothingItem, Style, Season, Occasion } from '@/types';

const MAX_COLORS = 5;

type FormState = {
  name: string;
  category: Category;
  colors: string[];
  styles: Style[];
  seasons: Season[];
  occasions: Occasion[];
  brand: string;
  notes: string;
  purchasePrice: string;
};

const MAX_NOTES = 500;

function toForm(item: ClothingItem): FormState {
  return {
    name: item.name,
    category: item.category,
    colors: [...item.colors],
    styles: [...item.styles],
    seasons: [...item.seasons],
    occasions: [...item.occasions],
    brand: item.brand ?? '',
    notes: item.notes ?? '',
    purchasePrice: typeof item.purchasePrice === 'number' ? String(item.purchasePrice) : '',
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Tag chi doc o View Mode - cung dang vien thuoc voi VChip nhung khong bam duoc. */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#869BB2] bg-[#869BB2]/15 px-3 py-1 text-xs font-semibold text-[#1F453E]">
      {children}
    </span>
  );
}

function ViewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#869BB2]">
        {label}
      </p>
      {children}
    </div>
  );
}

function TagList<T extends string>({ values, labels }: { values: T[]; labels?: Record<T, string> }) {
  if (values.length === 0) return <p className="text-sm text-[#6B7B76]">Chưa có</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Tag key={v}>{labels ? labels[v] : v}</Tag>
      ))}
    </div>
  );
}

export function ItemDetailModal({
  itemId,
  onClose,
  onUpdated,
}: {
  /** Trang cha render kem key={itemId} -> doi item la mount lai, state tu reset. */
  itemId: string;
  onClose: () => void;
  /** Goi sau khi luu thanh cong de trang cha cap nhat luoi ngay. */
  onUpdated: (item: ClothingItem) => void;
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  const loader = useCallback((signal: AbortSignal) => itemApi.get(itemId, signal), [itemId]);
  const { data: item, setData: setItem, loading, error: loadError, reload } = useResource(loader);
  const savingRef = useRef(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [newColor, setNewColor] = useState('#1f453e');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const startEdit = () => {
    if (!item) return;
    setForm(toForm(item));
    setSaveError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
    setSaveError('');
  };

  const addColor = () => {
    if (!form) return;
    const c = newColor.toLowerCase();
    if (form.colors.includes(c) || form.colors.length >= MAX_COLORS) return;
    setForm({ ...form, colors: [...form.colors, c] });
  };

  const handleSave = async () => {
    if (!item || !form || savingRef.current) return;
    const name = form.name.trim();
    if (!name) {
      setSaveError('Tên món đồ không được để trống');
      return;
    }

    const trimmedPrice = form.purchasePrice.trim();
    const priceNum = trimmedPrice ? Number(trimmedPrice) : null;
    const payload: UpdateItemPayload = {
      name,
      category: form.category,
      colors: form.colors,
      styles: form.styles,
      seasons: form.seasons,
      occasions: form.occasions,
      brand: form.brand.trim(),
      notes: form.notes.trim(),
      purchasePrice: priceNum !== null && !isNaN(priceNum) ? priceNum : null,
    };

    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await itemApi.update(item._id, payload);
      setItem(updated);
      setEditing(false);
      setForm(null);
      onUpdated(updated);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <VModal open onClose={onClose} busy={saving} title="Chi tiết món đồ" wide serifTitle>
      {loading && (
        <div className="grid place-items-center py-16">
          <VSpinner />
        </div>
      )}

      {loadError && (
        <ErrorState message={loadError} onRetry={() => void reload()} />
      )}

      {item && (
        <div className="grid gap-6 md:grid-cols-5">
          {/* Cot trai (40%): anh + so lan mac */}
          <div className="md:col-span-2">
            <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border border-[#CBD5E1] bg-[#F8F9F5] p-4">
              <CloudImage
                src={item.imageUrl}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute left-3 top-3 rounded-full border border-[#869BB2] bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-[#1F453E] shadow-sm">
                Đã mặc {item.wearCount} lần
              </span>
            </div>
          </div>

          {/* Cot phai (60%): thong tin / form */}
          <div className="md:col-span-3">
            {!editing ? (
              /* ---------- View Mode ---------- */
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif-display text-2xl font-semibold leading-tight text-[#1F453E]">
                    {item.name}
                  </h3>
                  <button
                    type="button"
                    onClick={startEdit}
                    title="Chỉnh sửa"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1F453E] px-3 py-1.5 text-xs font-semibold text-[#1F453E] transition-colors hover:bg-[#E2ECC8]/50"
                  >
                    <Pencil size={12} /> Chỉnh sửa
                  </button>
                </div>

                <ViewRow label="Danh mục">
                  <Tag>{CATEGORY_LABELS[item.category]}</Tag>
                </ViewRow>

                <ViewRow label="Thương hiệu">
                  <p className={`text-sm ${item.brand ? 'font-medium text-[#1F453E]' : 'text-[#6B7B76]'}`}>
                    {item.brand || 'Chưa có'}
                  </p>
                </ViewRow>

                <ViewRow label="Giá mua & Chi phí mỗi lần mặc (CPW)">
                  {typeof item.purchasePrice === 'number' && item.purchasePrice > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#1F453E]">
                        {item.purchasePrice.toLocaleString('vi-VN')} ₫
                      </span>
                      {item.wearCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/20 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          ~{Math.round(item.purchasePrice / item.wearCount).toLocaleString('vi-VN')} ₫ / lần mặc
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Chưa mặc lần nào
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B7B76]">Chưa cập nhật giá mua</p>
                  )}
                </ViewRow>

                <ViewRow label="Màu sắc">
                  {item.colors.length === 0 ? (
                    <p className="text-sm text-[#6B7B76]">Chưa có</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {item.colors.map((c) => (
                        <span
                          key={c}
                          title={c}
                          className="h-7 w-7 rounded-full border border-[#CBD5E1]"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </ViewRow>

                <ViewRow label="Phong cách">
                  <TagList values={item.styles} />
                </ViewRow>

                <ViewRow label="Mùa phù hợp">
                  <TagList values={item.seasons} labels={SEASON_LABELS} />
                </ViewRow>

                <ViewRow label="Dịp mặc">
                  <TagList values={item.occasions} labels={OCCASION_LABELS} />
                </ViewRow>

                <ViewRow label="Ghi chú">
                  <p
                    className={`whitespace-pre-line break-words text-sm ${
                      item.notes ? 'text-[#2C4C45]' : 'text-[#6B7B76]'
                    }`}
                  >
                    {item.notes || 'Chưa có'}
                  </p>
                </ViewRow>
              </div>
            ) : (
              form && (
                /* ---------- Edit Mode ---------- */
                <div className="space-y-3">
                  <VInput
                    label="Tên món đồ"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />

                  <VSelect
                    label="Danh mục"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </VSelect>

                  <VInput
                    label="Thương hiệu (không bắt buộc)"
                    maxLength={100}
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Uniqlo, Zara..."
                  />

                  <VInput
                    label="Giá mua (VNĐ)"
                    type="number"
                    min={0}
                    step={1000}
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    placeholder="Ví dụ: 350000"
                  />

                  <div>
                    <VLabel>Màu sắc (tối đa {MAX_COLORS})</VLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      {form.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={`Bỏ màu ${c}`}
                          onClick={() =>
                            setForm({ ...form, colors: form.colors.filter((x) => x !== c) })
                          }
                          className="group/color relative h-7 w-7 rounded-full border border-[#CBD5E1]"
                          style={{ backgroundColor: c }}
                        >
                          <span className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 place-items-center rounded-full bg-white text-[#1F453E] shadow group-hover/color:grid">
                            <X size={9} />
                          </span>
                        </button>
                      ))}

                      {form.colors.length < MAX_COLORS && (
                        <div className="flex items-center gap-1.5 rounded-full border border-[#9EB0A8] py-0.5 pl-1 pr-1">
                          <input
                            type="color"
                            value={newColor}
                            onChange={(e) => setNewColor(e.target.value)}
                            title="Chọn màu"
                            className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                          />
                          <button
                            type="button"
                            onClick={addColor}
                            title="Thêm màu"
                            className="grid h-6 w-6 place-items-center rounded-full bg-[#1F453E] text-white hover:bg-[#16352F]"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <VLabel>Phong cách</VLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLES.map((s) => (
                        <VChip
                          key={s}
                          active={form.styles.includes(s)}
                          onClick={() => setForm({ ...form, styles: toggle(form.styles, s) })}
                        >
                          {s}
                        </VChip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <VLabel>Mùa phù hợp</VLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {SEASONS.map((s) => (
                        <VChip
                          key={s}
                          active={form.seasons.includes(s)}
                          onClick={() => setForm({ ...form, seasons: toggle(form.seasons, s) })}
                        >
                          {SEASON_LABELS[s]}
                        </VChip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <VLabel>Dịp mặc</VLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {OCCASIONS.map((o) => (
                        <VChip
                          key={o}
                          active={form.occasions.includes(o)}
                          onClick={() => setForm({ ...form, occasions: toggle(form.occasions, o) })}
                        >
                          {OCCASION_LABELS[o]}
                        </VChip>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <VLabel>Ghi chú (không bắt buộc)</VLabel>
                    <textarea
                      rows={3}
                      maxLength={MAX_NOTES}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Chất liệu, cách giặt, size..."
                      className="w-full resize-none rounded-lg border border-[#9EB0A8] bg-white px-3.5 py-2.5 text-sm text-[#1F453E] placeholder:text-[#6B7B76] transition-colors focus:border-[#1F453E] focus:outline-none"
                    />
                    <span className="mt-1 block text-right text-[10px] text-[#869BB2]">
                      {form.notes.length}/{MAX_NOTES}
                    </span>
                  </label>

                  {saveError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <VButton variant="outline" onClick={cancelEdit} disabled={saving} className="flex-1">
                      Hủy
                    </VButton>
                    <VButton
                      onClick={handleSave}
                      loading={saving}
                      disabled={!form.name.trim()}
                      className="flex-1"
                    >
                      Lưu thay đổi
                    </VButton>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </VModal>
  );
}
// ===== END NEW =====
