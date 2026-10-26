'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Heart,
  Loader2,
} from 'lucide-react';
import { VModal, VInput, VSelect, VButton, VLabel } from '@/components/ui/vintage';
import { wishlistApi } from '@/lib/services';
import { useCategoryLabels } from '@/store/categoryStore';
import { CATEGORIES } from '@/types';
import type { Category, ClothingItem, WishlistPriority } from '@/types';

const POPULAR_COLORS = [
  { name: 'Trắng', hex: '#ffffff' },
  { name: 'Đen', hex: '#000000' },
  { name: 'Xanh Pastel', hex: '#93c5fd' },
  { name: 'Indigo / Denim', hex: '#1e3a8a' },
  { name: 'Be / Kem', hex: '#faf9f5' },
  { name: 'Nâu đất', hex: '#78350f' },
  { name: 'Hồng pastel', hex: '#fecdd3' },
  { name: 'Xanh rừng', hex: '#1f453e' },
  { name: 'Vàng mù tạt', hex: '#d97706' },
  { name: 'Xám khói', hex: '#869bb2' },
];

export function AddWishlistModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('top');
  const [price, setPrice] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [customHex, setCustomHex] = useState('#1f453e');
  const [priority, setPriority] = useState<WishlistPriority>('medium');
  const [productUrl, setProductUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Duplicate warning state
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<ClothingItem[]>([]);
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced check duplicates whenever category or colors change
  useEffect(() => {
    if (!open) return;
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        setChecking(true);
        const res = await wishlistApi.checkDuplicates({ category, colors });
        setDuplicates(res.duplicates || []);
        setHasDuplicate(res.hasDuplicate);
      } catch {
        // silent fail
      } finally {
        setChecking(false);
      }
    }, 250);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [category, colors, open]);

  const toggleColor = (hex: string) => {
    const lower = hex.toLowerCase();
    setColors((prev) =>
      prev.includes(lower) ? prev.filter((c) => c !== lower) : [...prev, lower].slice(0, 5)
    );
  };

  const reset = () => {
    setName('');
    setCategory('top');
    setPrice('');
    setColors([]);
    setPriority('medium');
    setProductUrl('');
    setImageUrl('');
    setBrand('');
    setNotes('');
    setDuplicates([]);
    setHasDuplicate(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên món đồ.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const parsedPrice = price.trim() ? Number(price) : undefined;
      await wishlistApi.create({
        name: name.trim(),
        category,
        price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
        colors,
        priority,
        productUrl: productUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        brand: brand.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onCreated();
      handleClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể thêm vào Wishlist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VModal open={open} onClose={handleClose} title="Thêm món đồ muốn mua (Wishlist)" wide busy={saving}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Tên món đồ */}
          <VInput
            label="Tên món đồ"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Áo sơ mi lụa cổ V"
          />

          {/* Danh mục */}
          <VSelect
            label="Danh mục"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </VSelect>
        </div>

        {/* Màu sắc & Palette */}
        <div>
          <VLabel>Màu sắc chính (Hỗ trợ đối chiếu chống mua trùng)</VLabel>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {POPULAR_COLORS.map((pc) => {
              const active = colors.includes(pc.hex.toLowerCase());
              return (
                <button
                  key={pc.hex}
                  type="button"
                  onClick={() => toggleColor(pc.hex)}
                  title={pc.name}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                    active
                      ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
                      : 'border-[#CBD5E1] bg-white text-[#1F453E] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                    style={{ backgroundColor: pc.hex }}
                  />
                  <span>{pc.name}</span>
                </button>
              );
            })}
          </div>

          {/* Chọn mã màu tùy ý */}
          <div className="mt-2.5 flex items-center gap-2">
            <input
              type="color"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[#CBD5E1] bg-transparent p-0.5"
            />
            <button
              type="button"
              onClick={() => toggleColor(customHex)}
              className="rounded-lg border border-[#869BB2]/40 bg-[#FAF9F5] px-2.5 py-1 text-xs font-semibold text-[#1F453E] hover:bg-white"
            >
              + Thêm mã màu {customHex}
            </button>
          </div>
        </div>

        {checking && (
          <div className="flex items-center gap-2 text-xs text-[#869BB2]">
            <Loader2 size={13} className="animate-spin text-[#1F453E]" />
            <span>Đang đối chiếu với tủ đồ của bạn...</span>
          </div>
        )}

        {/* 🔥 HỘP CẢNH BÁO MUA TRÙNG REAL-TIME */}
        {hasDuplicate && duplicates.length > 0 && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold">
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-amber-950">
                  Cảnh báo mua trùng đồ!
                </h4>
                <p className="mt-0.5 text-xs text-amber-900 leading-relaxed">
                  Bạn đang có <strong className="font-semibold underline">{duplicates.length} món đồ</strong> trong tủ cùng danh mục <strong className="font-semibold">[{CATEGORY_LABELS[category]}]</strong> và tone màu tương tự:
                </p>

                {/* Danh sách các món đồ trùng trong tủ */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {duplicates.map((dup) => (
                    <div
                      key={dup._id}
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white p-2 text-xs shadow-2xs"
                    >
                      <div className="h-10 w-10 shrink-0 grid place-items-center rounded bg-[#FAF9F5] border border-[#CBD5E1]/60 p-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={dup.imageUrl} alt={dup.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#1F453E] max-w-[140px]" title={dup.name}>
                          {dup.name}
                        </p>
                        <p className="text-[10px] text-[#6B7B76]">
                          Đã mặc {dup.wearCount} lần {dup.brand ? `· ${dup.brand}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-[11px] italic text-amber-800">
                  💡 Bạn có thực sự cần mua thêm món này không? Hãy cân nhắc để tránh lãng phí ngân sách nhé.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Giá dự kiến */}
          <VInput
            label="Giá dự kiến (VNĐ)"
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ví dụ: 450000"
          />

          {/* Mức độ ưu tiên */}
          <VSelect
            label="Mức độ ưu tiên mua"
            value={priority}
            onChange={(e) => setPriority(e.target.value as WishlistPriority)}
          >
            <option value="high">🔥 Ưu tiên cao (Cần mua sớm)</option>
            <option value="medium">⭐ Ưu tiên vừa (Khi có đợt giảm giá)</option>
            <option value="low">🌱 Ưu tiên thấp (Tham khảo thêm)</option>
          </VSelect>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Link mua hàng */}
          <VInput
            label="Link sản phẩm (Shopee, Lazada, Zara...)"
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://..."
          />

          {/* Link ảnh sản phẩm */}
          <VInput
            label="Link ảnh sản phẩm (không bắt buộc)"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <VInput
            label="Thương hiệu (không bắt buộc)"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Uniqlo, Zara, Shein..."
          />

          <VInput
            label="Ghi chú cá nhân"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lý do muốn mua, dịp diện, size..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#1F453E]/10">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-[#CBD5E1] px-5 py-2 text-xs font-semibold text-[#1F453E] hover:bg-[#FAF9F5]"
          >
            Hủy
          </button>
          <VButton type="submit" disabled={saving}>
            <Heart size={14} className="fill-white" />
            {saving ? 'Đang thêm...' : 'Lưu vào Wishlist'}
          </VButton>
        </div>
      </form>
    </VModal>
  );
}
