'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Heart,
  Loader2,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  RotateCcw,
} from 'lucide-react';
import { VModal, VInput, VSelect, VButton, VLabel } from '@/components/ui/vintage';
import { wishlistApi } from '@/lib/services';
import { useCategoryLabels } from '@/store/categoryStore';
import { CATEGORIES } from '@/types';
import type { Category, ClothingItem, WishlistPriority } from '@/types';
import { resizeImage } from '@/lib/backgroundRemoval';
import { extractColors } from '@/lib/colorExtract';

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
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');

  // Image handling: Direct upload or URL
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageFileSize, setImageFileSize] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Duplicate warning state
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<ClothingItem[]>([]);
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced check duplicates whenever category or name change
  useEffect(() => {
    if (!open) return;
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    checkTimeoutRef.current = setTimeout(async () => {
      if (!name || name.trim().length < 2) {
        setDuplicates([]);
        setHasDuplicate(false);
        return;
      }

      try {
        setChecking(true);
        const res = await wishlistApi.checkDuplicates({ category, name });
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
  }, [category, name, open]);

  const toggleColor = (hex: string) => {
    const lower = hex.toLowerCase();
    setColors((prev) =>
      prev.includes(lower) ? prev.filter((c) => c !== lower) : [...prev, lower].slice(0, 5)
    );
  };

  /** Xử lý file ảnh tải lên trực tiếp */
  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh tải lên không được vượt quá 10MB.');
      return;
    }

    setProcessingImage(true);
    setError('');
    try {
      // Tối ưu và thu nhỏ ảnh về kích thước tối đa 800px để lưu trữ nhẹ và tải cực nhanh
      const resizedBlob = await resizeImage(file, 800);

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setImageUrl(dataUrl);
        setImageFileName(file.name);
        setImageFileSize(`${(file.size / 1024).toFixed(0)} KB`);

        // Gợi ý tên món đồ từ tên file nếu người dùng chưa nhập tên
        if (!name.trim()) {
          const suggestedName = file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
            .trim();
          if (suggestedName) setName(suggestedName);
        }

        // Tự động phân tích màu sắc chủ đạo nếu chưa chọn màu
        if (colors.length === 0) {
          try {
            const extracted = await extractColors(resizedBlob, 2);
            if (extracted.length > 0) {
              setColors(extracted);
            }
          } catch {
            // silent fail
          }
        }
        setProcessingImage(false);
      };

      reader.onerror = () => {
        setError('Không thể đọc file ảnh.');
        setProcessingImage(false);
      };

      reader.readAsDataURL(resizedBlob);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Xử lý ảnh thất bại.');
      setProcessingImage(false);
    }
  };

  const handleClearImage = () => {
    setImageUrl('');
    setImageFileName('');
    setImageFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const reset = () => {
    setName('');
    setCategory('top');
    setPrice('');
    setColors([]);
    setPriority('medium');
    setProductUrl('');
    setImageUrl('');
    setImageMode('upload');
    setImageFileName('');
    setImageFileSize('');
    setProcessingImage(false);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      const normalizeUrl = (u: string) => {
        const trimmed = u.trim();
        if (!trimmed) return undefined;
        // Data URL giữ nguyên, không gắn https://
        if (trimmed.startsWith('data:image/')) return trimmed;
        if (!/^https?:\/\//i.test(trimmed)) {
          return `https://${trimmed}`;
        }
        return trimmed;
      };

      const parsedPrice = price.trim() ? Number(price) : undefined;
      await wishlistApi.create({
        name: name.trim(),
        category,
        price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
        colors,
        priority,
        productUrl: normalizeUrl(productUrl),
        imageUrl: normalizeUrl(imageUrl),
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
          <VLabel>Màu sắc chính</VLabel>
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

        {/* CẢNH BÁO MUA TRÙNG REAL-TIME */}
        {hasDuplicate && duplicates.length > 0 && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold">
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-amber-950">
                  Cảnh báo: Món đồ này đã có trong tủ đồ!
                </h4>
                <p className="mt-0.5 text-xs text-amber-900 leading-relaxed">
                  Bạn đang có <strong className="font-semibold underline">{duplicates.length} món đồ tương tự</strong> trong tủ đồ thuộc danh mục <strong className="font-semibold">[{CATEGORY_LABELS[category]}]</strong>:
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

                <p className="mt-2 text-[11px] text-amber-800">
                  💡 <strong>Lưu ý:</strong> Món đồ này chỉ được lưu trong danh sách Wishlist (không tự động xếp vào tủ đồ). Cảnh báo này chỉ nhằm đối chiếu giúp bạn cân nhắc trước khi chi tiền mua thêm.
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

        {/* Link mua hàng */}
        <VInput
          label="Link mua hàng (Shopee, Lazada, Zara... - không bắt buộc)"
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://shopee.vn/..."
        />

        {/* PHẦN ẢNH SẢN PHẨM: TẢI TRỰC TIẾP HOẶC DÁN LINK */}
        <div className="rounded-xl border border-[#CBD5E1]/80 bg-[#FAF9F5]/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <VLabel className="!mb-0 text-xs font-semibold text-[#1F453E] flex items-center gap-1.5">
              <ImageIcon size={14} className="text-[#1F453E]" />
              Ảnh minh họa món đồ
            </VLabel>

            {/* Chuyển đổi giữa Tải ảnh trực tiếp và Dán link ảnh */}
            <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-white p-0.5 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setImageMode('upload')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  imageMode === 'upload'
                    ? 'bg-[#1F453E] text-white shadow-xs'
                    : 'text-[#6B7B76] hover:text-[#1F453E]'
                }`}
              >
                <Upload size={12} />
                Thêm ảnh trực tiếp
              </button>
              <button
                type="button"
                onClick={() => setImageMode('url')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  imageMode === 'url'
                    ? 'bg-[#1F453E] text-white shadow-xs'
                    : 'text-[#6B7B76] hover:text-[#1F453E]'
                }`}
              >
                <LinkIcon size={12} />
                Dán link ảnh
              </button>
            </div>
          </div>

          {imageMode === 'upload' ? (
            <div>
              {imageUrl ? (
                /* Card khi đã chọn hoặc tải ảnh lên */
                <div className="flex items-center gap-3.5 rounded-lg border border-[#CBD5E1] bg-white p-3 shadow-2xs">
                  <div className="h-16 w-16 shrink-0 grid place-items-center overflow-hidden rounded-md border border-[#CBD5E1]/60 bg-[#FAF9F5] p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Xem trước ảnh sản phẩm"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#1F453E]">
                      {imageFileName || 'Ảnh đã thêm thành công'}
                    </p>
                    {imageFileSize && (
                      <p className="text-[10px] text-[#6B7B76] mt-0.5">{imageFileSize}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-[#FAF9F5] px-2.5 py-1 text-[11px] font-medium text-[#1F453E] hover:bg-white"
                      >
                        <RotateCcw size={11} /> Đổi ảnh khác
                      </button>
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
                      >
                        <X size={11} /> Xóa ảnh
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dropzone khi chưa có ảnh */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-5 px-4 text-center transition-all ${
                    isDragging
                      ? 'border-[#1F453E] bg-[#E2ECC8]/30 scale-[0.99]'
                      : 'border-[#CBD5E1] bg-white hover:border-[#1F453E]/60 hover:bg-[#FAF9F5]'
                  }`}
                >
                  {processingImage ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 size={24} className="animate-spin text-[#1F453E]" />
                      <p className="text-xs font-medium text-[#1F453E]">Đang xử lý & tối ưu ảnh...</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FAF9F5] text-[#1F453E] shadow-2xs">
                        <Upload size={18} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#1F453E]">
                        Nhấn để chọn ảnh từ máy hoặc kéo thả ảnh vào đây
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7B76]">
                        Hỗ trợ JPG, PNG, WebP · tự động trích xuất màu sắc & gợi ý tên
                      </p>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            /* Chế độ dán URL ảnh */
            <div className="space-y-2">
              <VInput
                label="Đường dẫn URL ảnh sản phẩm"
                type="url"
                value={imageUrl.startsWith('data:image/') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... hoặc link ảnh online"
              />
              {imageUrl && !imageUrl.startsWith('data:image/') && (
                <div className="flex items-center gap-2.5 rounded-lg border border-[#CBD5E1]/60 bg-white p-2 shadow-2xs">
                  <div className="h-10 w-10 shrink-0 grid place-items-center rounded bg-[#FAF9F5] border border-[#CBD5E1]/40 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Xem trước URL"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#6B7B76] truncate">Xem trước ảnh từ link URL</span>
                </div>
              )}
            </div>
          )}
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
