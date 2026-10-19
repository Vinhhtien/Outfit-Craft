'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ExternalLink,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';
import {
  VModal,
  VButton,
  VInput,
  VLabel,
  VChip,
} from '@/components/ui/vintage';
import { outfitApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import {
  SEASONS,
  SEASON_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  CATEGORY_Z_INDEX,
} from '@/types';
import type { ClothingItem, Occasion, Season, Weather } from '@/types';

interface SaveSuggestedOutfitModalProps {
  open: boolean;
  onClose: () => void;
  items: { label: string; item: ClothingItem }[];
  occasion: Occasion;
  weather?: Weather;
  onSaved?: (outfitId: string) => void;
}

function getDefaultSeason(temp?: number): Season[] {
  if (temp === undefined) return ['summer'];
  if (temp < 18) return ['winter'];
  if (temp <= 25) return ['autumn', 'spring'];
  return ['summer'];
}

export function SaveSuggestedOutfitModal({
  open,
  onClose,
  items,
  occasion,
  weather,
  onSaved,
}: SaveSuggestedOutfitModalProps) {
  const router = useRouter();

  const [name, setName] = useState(
    () => `Gợi ý ${OCCASION_LABELS[occasion]} • ${new Date().toLocaleDateString('vi-VN')}`
  );
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>(() =>
    getDefaultSeason(weather?.temp)
  );
  const [selectedOccasions, setSelectedOccasions] = useState<Occasion[]>([occasion]);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);

  const toggleSeason = (s: Season) => {
    setSelectedSeasons((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const toggleOccasion = (o: Occasion) => {
    setSelectedOccasions((prev) =>
      prev.includes(o) ? prev.filter((item) => item !== o) : [...prev, o]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên cho bộ đồ');
      return;
    }
    if (items.length === 0) {
      setError('Bộ đồ phải có ít nhất 1 món đồ');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Automatic canvas layout placement
      const outfitItems = items.map(({ item }, index) => {
        let left = 200;
        let top = 200;

        switch (item.category) {
          case 'dress':
          case 'top':
            left = 200;
            top = 130;
            break;
          case 'outerwear':
            left = 210;
            top = 140;
            break;
          case 'bottom':
            left = 200;
            top = 300;
            break;
          case 'shoes':
            left = 200;
            top = 450;
            break;
          case 'bag':
            left = 320;
            top = 260;
            break;
          case 'accessory':
            left = 320;
            top = 120;
            break;
          default:
            left = 150 + (index % 3) * 100;
            top = 150 + Math.floor(index / 3) * 120;
        }

        return {
          item: item._id,
          left,
          top,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          zIndex: CATEGORY_Z_INDEX[item.category] ?? 10,
        };
      });

      const tags = ['Gợi ý thời tiết', OCCASION_LABELS[occasion]];
      if (weather?.description) {
        tags.push(weather.description);
      }

      const created = await outfitApi.create({
        name: name.trim(),
        items: outfitItems,
        canvasJSON: {},
        seasons: selectedSeasons,
        occasions: selectedOccasions,
        tags,
        isPublic,
      });

      setSavedOutfitId(created._id);
      onSaved?.(created._id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInStudio = () => {
    if (savedOutfitId) {
      router.push(`/studio?outfit=${savedOutfitId}`);
    }
  };

  return (
    <VModal
      open={open}
      onClose={onClose}
      title={savedOutfitId ? 'Đã lưu bộ đồ thành công!' : 'Lưu bộ đồ từ gợi ý'}
      busy={saving}
      wide
      serifTitle
    >
      {savedOutfitId ? (
        <div className="space-y-6 py-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E2ECC8] text-[#1F453E]">
            <Check size={28} className="stroke-[2.5]" />
          </div>

          <div>
            <h3 className="font-serif-display text-xl font-bold text-[#1F453E]">
              {name}
            </h3>
            <p className="mt-1 text-sm text-[#52665F]">
              Bộ đồ đã được lưu vào danh sách của bạn. Bạn có thể mở nó trong Studio để tuỳ chỉnh vị trí, kích thước hoặc xem lại bất cứ lúc nào.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <VButton
              variant="primary"
              onClick={handleOpenInStudio}
              className="inline-flex items-center gap-2"
            >
              <ExternalLink size={14} /> Mở trong Studio để chỉnh sửa
            </VButton>
            <VButton variant="outline" onClick={onClose}>
              Đóng
            </VButton>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Items preview preview */}
          <div>
            <VLabel>Các món đồ trong bộ ({items.length} món):</VLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map(({ label, item }) => (
                <div
                  key={item._id}
                  className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#FAF9F5] p-2"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#1F453E]">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-[#6B7B76]">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outfit Name */}
          <div>
            <VLabel>Tên bộ đồ</VLabel>
            <VInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên bộ trang phục..."
              maxLength={100}
              autoFocus
              required
            />
          </div>

          {/* Occasions */}
          <div>
            <VLabel>Dịp phù hợp</VLabel>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((occ) => (
                <VChip
                  key={occ}
                  active={selectedOccasions.includes(occ)}
                  onClick={() => toggleOccasion(occ)}
                >
                  {OCCASION_LABELS[occ]}
                </VChip>
              ))}
            </div>
          </div>

          {/* Seasons */}
          <div>
            <VLabel>Mùa phù hợp</VLabel>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <VChip
                  key={s}
                  active={selectedSeasons.includes(s)}
                  onClick={() => toggleSeason(s)}
                >
                  {SEASON_LABELS[s]}
                </VChip>
              ))}
            </div>
          </div>

          {/* Public Sharing Option */}
          <div className="rounded-xl border border-[#1F453E]/15 bg-[#FAF9F5] p-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#1F453E]/30 text-[#1F453E] focus:ring-[#1F453E]"
              />
              <div>
                <p className="text-xs font-bold text-[#1F453E]">
                  Chia sẻ công khai lên Bảng tin OOTD
                </p>
                <p className="text-[11px] text-[#6B7B76]">
                  Những người dùng khác có thể nhìn thấy và thả tim bộ đồ này trong cộng đồng.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <VButton
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </VButton>
            <VButton
              type="submit"
              variant="primary"
              loading={saving}
              className="inline-flex items-center gap-1.5"
            >
              <FolderPlus size={14} /> Lưu bộ đồ
            </VButton>
          </div>
        </form>
      )}
    </VModal>
  );
}
