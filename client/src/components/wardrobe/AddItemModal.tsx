'use client';
import { useCategoryLabels } from '@/store/categoryStore';

import { useState, useRef, useEffect } from 'react';
import { Upload, Wand2, X } from 'lucide-react';
import { VButton, VInput, VSelect, VChip, VModal, VLabel } from '@/components/ui/vintage';
import { removeBackground, resizeImage } from '@/lib/backgroundRemoval';
import { extractColors } from '@/lib/colorExtract';
import { itemApi } from '@/lib/services';
import { getErrorMessage, getFieldErrors } from '@/lib/api';
import {
  CATEGORIES, STYLES, SEASONS, SEASON_LABELS,
  OCCASIONS, OCCASION_LABELS,
} from '@/types';
import type { Category, Style, Season, Occasion } from '@/types';

type Step = 'pick' | 'processing' | 'form';


function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AddItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  const fileRef = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const savingRef = useRef(false);
  const creationKey = useRef('');
  const [saveStage, setSaveStage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState({ value: 0, stage: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Ket qua sau khi tach nen
  const [originalFile, setOriginalFile] = useState<Blob | null>(null);
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [autoTagState, setAutoTagState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');

  const [form, setForm] = useState({
    name: '',
    category: 'top' as Category,
    colors: [] as string[],
    styles: [] as Style[],
    seasons: [] as Season[],
    occasions: [] as Occasion[],
    brand: '',
    purchasePrice: '',
  });

  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const reset = () => {
    if (savingRef.current) return;
    operation.current++;
    creationKey.current = '';
    setFieldErrors({});
    setSaveStage('');
    setStep('pick');
    setProgress({ value: 0, stage: '' });
    setError('');
    setOriginalFile(null);
    setCutoutBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setAutoTagState('idle');
    setForm({
      name: '', category: 'top', colors: [], styles: [], seasons: [], occasions: [], brand: '', purchasePrice: '',
    });
  };

  const handleClose = () => {
    if (savingRef.current) return;
    reset();
    onClose();
  };

  /** Chay nen, khong chan form. Chi dien nhom user chua chon; loi thi de user chon tay. */
  const suggestTags = async (image: Blob, current: number) => {
    setAutoTagState('loading');
    try {
      const tags = await itemApi.autoTag(image);
      if (current !== operation.current) return;
      setForm((f) => ({
        ...f,
        styles: f.styles.length > 0 ? f.styles : tags.styles,
        seasons: f.seasons.length > 0 ? f.seasons : tags.seasons,
        occasions: f.occasions.length > 0 ? f.occasions : tags.occasions,
      }));
      setAutoTagState('done');
    } catch {
      if (current === operation.current) setAutoTagState('failed');
    }
  };

  /** Chon file -> thu nho -> tach nen -> lay mau chu dao. */
  const handleFile = async (file: File) => {
    if (savingRef.current) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Ảnh phải có dung lượng từ 1 byte đến 10 MB.'); return; }
    const current = ++operation.current;
    creationKey.current = crypto.randomUUID();
    setError('');
    setProgress({ value: 0, stage: 'Đang chuẩn bị ảnh' });
    setStep('processing');

    try {
      const resized = await resizeImage(file, 1024);
      if (current !== operation.current) return;
      setOriginalFile(resized);

      const cutout = await removeBackground(resized, {
        onProgress: (value, stage) => { if (current === operation.current) setProgress({ value, stage }); },
      });
      if (current !== operation.current) return;
      setCutoutBlob(cutout);

      const url = URL.createObjectURL(cutout);
      setPreviewUrl(url);

      // Tu dong dien mau chu dao va ten goi y.
      const colors = await extractColors(cutout, 3);
      if (current !== operation.current) return;
      setForm((f) => ({
        ...f,
        colors,
        name: f.name || file.name.replace(/\.[^.]+$/, ''),
      }));

      setStep('form');
      void suggestTags(cutout, current);
    } catch (err) {
      if (current !== operation.current) return;
      setError(getErrorMessage(err));
      setStep('pick');
    }
  };

  /** Upload ca 2 anh len Cloudinary roi luu metadata. */
  const handleSave = async () => {
    if (!cutoutBlob || !originalFile || savingRef.current) return;
    if (!form.name.trim() || form.name.trim().length > 100) { setFieldErrors({ name: 'Tên món đồ cần từ 1 đến 100 ký tự.' }); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    setFieldErrors({});
    setSaveStage('Đang tải ảnh…');
    try {
      const parsedPrice = form.purchasePrice ? Number(form.purchasePrice) : undefined;
      await itemApi.createWithImages({
        name: form.name.trim(), category: form.category, colors: form.colors,
        styles: form.styles, seasons: form.seasons, occasions: form.occasions,
        brand: form.brand.trim() || undefined,
        purchasePrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      }, cutoutBlob, originalFile, creationKey.current, (event) => {
        const percent = event.total ? Math.min(100, Math.round(event.loaded / event.total * 100)) : null;
        setSaveStage(percent === 100 ? 'Đang lưu ảnh và món đồ…' : `Đang tải ảnh${percent === null ? '…' : ` ${percent}%…`}`);
      });
      savingRef.current = false;
      onCreated();
      handleClose();
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSaveStage('');
    }
  };

  return (
    <VModal open={open} onClose={handleClose} title="Thêm món đồ mới" wide busy={saving}>
      {step === 'pick' && (
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="grid w-full place-items-center gap-2 rounded-xl border-2 border-dashed border-[#869BB2] bg-[#FAF9F5] py-12 transition-colors hover:border-[#1F453E]"
          >
            <Upload size={28} className="text-[#869BB2]" />
            <span className="font-semibold text-[#1F453E]">Chọn ảnh món đồ</span>
            <span className="text-xs text-[#6B7B76]">
              JPG, PNG hoặc WebP · tối đa 10MB
            </span>
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#6B7B76]">
            <Wand2 size={13} />
            Nền ảnh được tách ngay trên trình duyệt, sau đó ảnh đã tách nền được gửi cho Google Gemini để gợi ý thông tin món đồ
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="grid place-items-center gap-3 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1F453E] border-t-transparent" />
          <p className="font-semibold text-[#1F453E]">{progress.stage || 'Đang xử lý'}...</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-[#E2ECC8]">
            <div
              className="h-full bg-[#1F453E] transition-all"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
          <p className="max-w-xs text-center text-xs text-[#6B7B76]">
            Lần đầu sử dụng cần tải model AI nên có thể mất một chút thời gian.
          </p>
        </div>
      )}

      {step === 'form' && (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="canvas-checker grid aspect-square place-items-center overflow-hidden rounded-xl border border-[#CBD5E1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Ảnh đã tách nền" className="max-h-full object-contain" />
            </div>
            <button
              onClick={reset}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-[#6B7B76] hover:text-red-500"
            >
              <X size={12} /> Chọn ảnh khác
            </button>
          </div>

          <fieldset disabled={saving} className="space-y-3">
            <VInput
              label="Tên món đồ"
              required
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'item-name-error' : undefined}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Áo sơ mi trắng"
            />

            {fieldErrors.name && <p id="item-name-error" role="alert" className="text-sm text-red-700">{fieldErrors.name}</p>}
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
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />

            <VInput
              label="Giá mua (VNĐ - không bắt buộc)"
              type="number"
              min={0}
              step={1000}
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              placeholder="Ví dụ: 350000 (để tính chi phí mỗi lần mặc CPW)"
            />

            {form.colors.length > 0 && (
              <div>
                <VLabel>Màu chủ đạo</VLabel>
                <div className="flex gap-2">
                  {form.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="h-7 w-7 rounded-full border border-[#CBD5E1]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {autoTagState !== 'idle' && (
              <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-[#52665F]">
                <Wand2 size={13} className="shrink-0" />
                {autoTagState === 'loading' && 'Đang gửi ảnh cho Google Gemini để gợi ý phong cách, mùa và dịp mặc…'}
                {autoTagState === 'done' && 'AI đã gợi ý phong cách, mùa và dịp mặc. Bạn kiểm tra và sửa lại nếu cần nhé.'}
                {autoTagState === 'failed' && 'Chưa thể tự gợi ý lúc này, bạn chọn thủ công nhé.'}
              </p>
            )}

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

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            {saving && <p role="status" aria-live="polite" className="text-sm text-[#52665F]">{saveStage}</p>}
            <div className="flex gap-2 pt-1">
              <VButton variant="outline" onClick={handleClose} className="flex-1">
                Hủy
              </VButton>
              <VButton
                onClick={handleSave}
                loading={saving}
                disabled={!form.name.trim()}
                className="flex-1"
              >
                {saving ? saveStage : 'Lưu vào tủ'}
              </VButton>
            </div>
          </fieldset>
        </div>
      )}
    </VModal>
  );
}
