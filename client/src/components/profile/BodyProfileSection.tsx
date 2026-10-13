'use client';

// ===== NEW: Body Profile =====
// Phan "Dang nguoi" trong trang Ho so.
// Bang chinh thong so (BodyControlsPanel) + bong nguoi SVG xem truoc (MannequinPreview).
import { useEffect, useMemo, useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { bodyProfileApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { MannequinPreview } from '@/components/profile/MannequinPreview';
import { VButton, VModal, VSpinner } from '@/components/ui/vintage';
import { BodyControlsPanel } from '@/components/body/BodyControlsPanel';
import {
  bodyStateFromProfile, bodyStateToMannequin, bodyStateToProfile, type BodyState,
} from '@/lib/bodyMetrics';
import type { BodyProfile } from '@/types';

export function BodyProfileSection({
  onSuccess,
  cardClassName,
}: {
  onSuccess: (msg: string) => void;
  cardClassName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<BodyProfile | null>(null);
  const [body, setBody] = useState<BodyState>(() => bodyStateFromProfile(null));
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const profile = await bodyProfileApi.get();
        setSaved(profile);
        setBody(bodyStateFromProfile(profile));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mannequin = useMemo(() => bodyStateToMannequin(body), [body]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      // PUT gop: so do chua nhap khong gui -> du lieu khac trong ho so giu nguyen.
      const profile = await bodyProfileApi.save(bodyStateToProfile(body));
      setSaved(profile);
      setBody(bodyStateFromProfile(profile));
      onSuccess('Đã lưu dáng người.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await bodyProfileApi.remove();
      setSaved(null);
      setBody(bodyStateFromProfile(null));
      setConfirmOpen(false);
      onSuccess('Đã xóa dữ liệu dáng người.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section id="body" className={`${cardClassName} scroll-mt-24`}>
      <div className="mb-6 border-b border-dashed border-[#869BB2]/50 pb-4">
        <h2 className="font-serif-display text-xl font-medium uppercase tracking-wide text-[#1F453E]">
          Dáng người
        </h2>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-[#869BB2]">
          <Lock size={12} className="mt-0.5 shrink-0" />
          Không bắt buộc. Chỉ dùng để hiển thị người mẫu khi phối đồ và gợi ý trang phục hợp với bạn, không bao giờ được chia sẻ công khai. Cân nặng và số đo vòng không bao giờ được gửi cho AI gợi ý.
        </p>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center">
          <VSpinner />
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <BodyControlsPanel
              value={body}
              onChange={setBody}
              disabled={saving}
              footer={
                <>
                  {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                  <div className="flex flex-col-reverse items-center justify-between gap-3 pt-2 sm:flex-row">
                    {saved ? (
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C2D19] underline underline-offset-2"
                      >
                        <Trash2 size={13} /> Xóa dữ liệu dáng người
                      </button>
                    ) : (
                      <span className="text-xs text-[#869BB2]">Chưa lưu - đang dùng dáng mặc định.</span>
                    )}
                    <VButton onClick={handleSave} loading={saving} className="px-8 py-3">
                      {saving ? 'Đang lưu...' : 'Lưu dáng người'}
                    </VButton>
                  </div>
                </>
              }
            />
          </div>

          {/* Xem truoc song */}
          <div className="flex flex-col items-center gap-2 md:sticky md:top-24 md:self-start">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
              <MannequinPreview profile={mannequin} className="h-80 w-40" title="Xem trước dáng người" />
            </div>
            <span className="text-[11px] text-[#869BB2]">Xem trước - cập nhật ngay khi kéo thanh trượt</span>
          </div>
        </div>
      )}

      <VModal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Xóa dữ liệu dáng người?">
        <p className="mb-5 text-sm text-[#2C4C45]">
          Giới tính, dáng, cân nặng và toàn bộ số đo sẽ bị xóa khỏi tài khoản. Người mẫu sẽ dùng lại dáng mặc định.
          Các outfit đã lưu không bị ảnh hưởng.
        </p>
        <div className="flex gap-2">
          <VButton variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1">
            Hủy
          </VButton>
          <VButton onClick={handleDelete} loading={deleting} className="flex-1 !border-[#8C2D19] !bg-[#8C2D19]">
            Xóa
          </VButton>
        </div>
      </VModal>
    </section>
  );
}
// ===== END NEW =====
