'use client';

import { useState, useRef } from 'react';
import { Upload, Wand2, X } from 'lucide-react';
import { Button, Input, Select, Chip, Modal } from '@/components/ui';
import { removeBackground, resizeImage } from '@/lib/backgroundRemoval';
import { extractColors } from '@/lib/colorExtract';
import { itemApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import {
  CATEGORIES, CATEGORY_LABELS, STYLES, SEASONS, SEASON_LABELS,
  OCCASIONS, OCCASION_LABELS,
} from '@/types';
import type { Category, Style, Season, Occasion } from '@/types';

type Step = 'pick' | 'processing' | 'form';

/** Nhiet do goi y mac dinh theo danh muc (C) - user van sua duoc. */
const DEFAULT_TEMP: Record<Category, { min: number; max: number }> = {
  top: { min: 18, max: 35 },
  bottom: { min: 15, max: 35 },
  outerwear: { min: -5, max: 20 },
  dress: { min: 20, max: 38 },
  shoes: { min: 0, max: 40 },
  bag: { min: 0, max: 40 },
  accessory: { min: 0, max: 40 },
};

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
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState({ value: 0, stage: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Ket qua sau khi tach nen
  const [originalFile, setOriginalFile] = useState<Blob | null>(null);
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: 'top' as Category,
    colors: [] as string[],
    styles: [] as Style[],
    seasons: [] as Season[],
    occasions: [] as Occasion[],
    brand: '',
  });

  const reset = () => {
    setStep('pick');
    setProgress({ value: 0, stage: '' });
    setError('');
    setOriginalFile(null);
    setCutoutBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setForm({
      name: '', category: 'top', colors: [], styles: [], seasons: [], occasions: [], brand: '',
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /** Chon file -> thu nho -> tach nen -> lay mau chu dao. */
  const handleFile = async (file: File) => {
    setError('');
    setStep('processing');

    try {
      const resized = await resizeImage(file, 1024);
      setOriginalFile(resized);

      const cutout = await removeBackground(resized, {
        onProgress: (value, stage) => setProgress({ value, stage }),
      });
      setCutoutBlob(cutout);

      const url = URL.createObjectURL(cutout);
      setPreviewUrl(url);

      // Tu dong dien mau chu dao va ten goi y.
      const colors = await extractColors(cutout, 3);
      setForm((f) => ({
        ...f,
        colors,
        name: f.name || file.name.replace(/\.[^.]+$/, ''),
      }));

      setStep('form');
    } catch (err) {
      setError(getErrorMessage(err));
      setStep('pick');
    }
  };

  /** Upload ca 2 anh len Cloudinary roi luu metadata. */
  const handleSave = async () => {
    if (!cutoutBlob || !originalFile) return;
    setSaving(true);
    setError('');

    try {
      const [cutoutUp, originalUp] = await Promise.all([
        itemApi.upload(cutoutBlob, 'cutout.png'),
        itemApi.upload(originalFile, 'original.jpg'),
      ]);

      await itemApi.create({
        name: form.name.trim(),
        category: form.category,
        imageUrl: cutoutUp.url,
        imagePublicId: cutoutUp.publicId,
        originalImageUrl: originalUp.url,
        colors: form.colors,
        styles: form.styles,
        seasons: form.seasons,
        occasions: form.occasions,
        tempRange: DEFAULT_TEMP[form.category],
        brand: form.brand.trim() || undefined,
      });

      onCreated();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Thêm món đồ mới" wide>
      {step === 'pick' && (
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="grid w-full place-items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] py-12 transition-colors hover:border-[var(--primary)]"
          >
            <Upload size={28} className="text-[var(--muted)]" />
            <span className="font-medium">Chọn ảnh món đồ</span>
            <span className="text-xs text-[var(--muted)]">
              JPG, PNG hoặc WebP · tối đa 10MB
            </span>
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
            <Wand2 size={13} />
            Nền ảnh sẽ được tách tự động ngay trên trình duyệt
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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="font-medium">{progress.stage || 'Đang xử lý'}...</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-[var(--primary)] transition-all"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
          <p className="max-w-xs text-center text-xs text-[var(--muted)]">
            Lần đầu sử dụng cần tải model AI nên có thể mất một chút thời gian.
          </p>
        </div>
      )}

      {step === 'form' && (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="canvas-checker grid aspect-square place-items-center overflow-hidden rounded-xl border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Ảnh đã tách nền" className="max-h-full object-contain" />
            </div>
            <button
              onClick={reset}
              className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-[var(--muted)] hover:text-red-500"
            >
              <X size={12} /> Chọn ảnh khác
            </button>
          </div>

          <div className="space-y-3">
            <Input
              label="Tên món đồ"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Áo sơ mi trắng"
            />

            <Select
              label="Danh mục"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </Select>

            <Input
              label="Thương hiệu (không bắt buộc)"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />

            {form.colors.length > 0 && (
              <div>
                <span className="mb-1 block text-sm font-medium">Màu chủ đạo</span>
                <div className="flex gap-2">
                  {form.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="h-7 w-7 rounded-full border border-[var(--border)]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-sm font-medium">Phong cách</span>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <Chip
                    key={s}
                    active={form.styles.includes(s)}
                    onClick={() => setForm({ ...form, styles: toggle(form.styles, s) })}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium">Mùa phù hợp</span>
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <Chip
                    key={s}
                    active={form.seasons.includes(s)}
                    onClick={() => setForm({ ...form, seasons: toggle(form.seasons, s) })}
                  >
                    {SEASON_LABELS[s]}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium">Dịp mặc</span>
              <div className="flex flex-wrap gap-1.5">
                {OCCASIONS.map((o) => (
                  <Chip
                    key={o}
                    active={form.occasions.includes(o)}
                    onClick={() => setForm({ ...form, occasions: toggle(form.occasions, o) })}
                  >
                    {OCCASION_LABELS[o]}
                  </Chip>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!form.name.trim()}
                className="flex-1"
              >
                Lưu vào tủ
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
