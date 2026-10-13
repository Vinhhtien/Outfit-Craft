'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, Check, Trash2, Plus,
} from 'lucide-react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { VModal, VSpinner, VToast } from '@/components/ui/vintage';
// ===== NEW: Delete Confirmation Popup =====
import { DeleteConfirmModal } from '@/components/wardrobe/DeleteConfirmModal';
// ===== END NEW =====
import { outfitApi, scheduleApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import type { Outfit, ScheduleEntry } from '@/types';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function SchedulePage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const [assigning, setAssigning] = useState(false);
  // ===== NEW: Delete Confirmation Popup =====
  const [entryToRemove, setEntryToRemove] = useState<ScheduleEntry | null>(null);
  const [removing, setRemoving] = useState(false);
  const closeRemoveConfirm = useCallback(() => setEntryToRemove(null), []);
  // ===== END NEW =====
  // ===== NEW: Toast thay alert() =====
  const [toastError, setToastError] = useState<string | null>(null);
  const closeToast = useCallback(() => setToastError(null), []);
  // ===== END NEW =====

  // Luoi lich luon bat dau tu thu 2 va phu day 6 tuan.
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [scheduleRes, outfitRes] = await Promise.all([
        scheduleApi.list(
          format(gridStart, 'yyyy-MM-dd'),
          format(gridEnd, 'yyyy-MM-dd')
        ),
        outfitApi.list({ page: 1 }),
      ]);
      setEntries(scheduleRes);
      setOutfits(outfitRes.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    // Nap du lieu khi doi thang: bat loading ngay trong effect la co chu y.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const entryFor = (day: Date) =>
    entries.find((e) => isSameDay(new Date(e.date), day));

  const handleAssign = async (outfitId: string) => {
    if (!pickerDate) return;
    setAssigning(true);
    try {
      await scheduleApi.set({
        outfit: outfitId,
        date: format(pickerDate, 'yyyy-MM-dd'),
      });
      setPickerDate(null);
      await load();
    } catch (err) {
      setToastError(getErrorMessage(err)); // ===== NEW: Toast thay alert() =====
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkWorn = async (entry: ScheduleEntry) => {
    try {
      await scheduleApi.markWorn(entry._id);
      await load();
    } catch (err) {
      setToastError(getErrorMessage(err)); // ===== NEW: Toast thay alert() =====
    }
  };

  // ===== NEW: Delete Confirmation Popup =====
  /** Chi goi khi nguoi dung bam xac nhan tren popup (thay cho window.confirm). */
  const handleRemove = async (entry: ScheduleEntry) => {
    setRemoving(true);
    try {
      await scheduleApi.remove(entry._id);
      setEntryToRemove(null);
      await load();
    } catch (err) {
      setEntryToRemove(null);
      setToastError(getErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };
  // ===== END NEW =====

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex min-h-[calc(100dvh-64px)] flex-1 flex-col bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner compact innerClassName="max-w-7xl items-center px-6 py-3 lg:px-10">
          <div>
            <h1 className="font-serif-display text-2xl font-normal uppercase leading-tight tracking-wider text-[#1F453E] sm:text-3xl">
              Lịch trang phục
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#2C4C45]">
              Lên kế hoạch mặc gì cho từng ngày.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#1F453E]/25 bg-white/95 px-2 py-1.5 shadow-2xs">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-[#1F453E] transition-colors hover:bg-[#1F453E] hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[120px] px-3 text-center text-xs font-bold capitalize tracking-wide text-[#1F453E] sm:text-sm">
              {format(month, 'MMMM yyyy', { locale: vi })}
            </span>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-[#1F453E] transition-colors hover:bg-[#1F453E] hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </ScallopBanner>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-4 lg:px-10">
          {error && (
            <p className="mb-4 rounded-xl border border-[#E5A99E] bg-[#FDF2F0] px-4 py-2.5 text-sm text-[#8C2D19]">
              {error}
            </p>
          )}

          {loading ? (
            <div className="grid flex-1 place-items-center py-20">
              <VSpinner />
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#1F453E]/20 bg-white shadow-[0_6px_24px_rgba(31,69,62,0.05)]">
              <div className="grid grid-cols-7 border-b border-[#1F453E]/15 bg-[#E2ECC8]/55">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="border-r border-[#1F453E]/10 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-[#1F453E] last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid flex-1 auto-rows-fr grid-cols-7">
                {days.map((day) => {
                  const entry = entryFor(day);
                  const inMonth = isSameMonth(day, month);
                  const today = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`group relative min-h-[92px] border-b border-r border-[#1F453E]/10 p-2 transition-colors sm:min-h-[105px] [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 ${
                        !inMonth
                          ? 'bg-[#F6F5F0]/80 text-[#869BB2]/70'
                          : today
                            ? 'bg-[#E2ECC8]/15 hover:bg-[#FAF9F5]'
                            : 'bg-white hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          today
                            ? 'bg-[#1F453E] font-bold text-white shadow-2xs'
                            : inMonth
                              ? 'font-semibold text-[#1F453E]'
                              : 'font-semibold'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>

                      {entry ? (
                        <div className={`mt-1 ${inMonth ? '' : 'opacity-60'}`}>
                          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-[#1F453E]/15 bg-[#FAF9F5] p-1">
                            {entry.outfit?.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entry.outfit.thumbnailUrl}
                                alt={entry.outfit.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <CalendarDays size={16} className="text-[#869BB2]" />
                            )}

                            {entry.isWorn && (
                              <span
                                title="Đã mặc"
                                className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#1F453E] text-[#E2ECC8] shadow-2xs"
                              >
                                <Check size={10} />
                              </span>
                            )}
                          </div>

                          <p
                            className="mt-0.5 truncate text-[10px] font-medium text-[#1F453E]"
                            title={entry.outfit?.name}
                          >
                            {entry.outfit?.name}
                          </p>

                          <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {!entry.isWorn && (
                              <button
                                onClick={() => void handleMarkWorn(entry)}
                                title="Đánh dấu đã mặc"
                                className="grid h-5 flex-1 place-items-center rounded-full border border-[#869BB2] bg-white text-[10px] text-[#1F453E] hover:bg-[#E2ECC8]/50"
                              >
                                <Check size={11} />
                              </button>
                            )}
                            <button
                              // ===== NEW: Delete Confirmation Popup ===== mo popup thay vi xoa ngay
                              onClick={() => setEntryToRemove(entry)}
                              title="Bỏ khỏi ngày này"
                              className="grid h-5 flex-1 place-items-center rounded-full border border-[#E5A99E] bg-[#FDF2F0] text-[#8C2D19] hover:bg-[#F9E1DC]"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        inMonth && (
                          <button
                            onClick={() => setPickerDate(day)}
                            title="Gán outfit cho ngày này"
                            className="mt-1 grid h-[58px] w-full cursor-pointer place-items-center rounded-lg border border-dashed border-[#869BB2]/60 text-[#869BB2] opacity-0 transition-opacity hover:border-[#1F453E] hover:text-[#1F453E] group-hover:opacity-100"
                          >
                            <Plus size={14} />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal chon outfit */}
      <VModal
        open={Boolean(pickerDate)}
        onClose={() => setPickerDate(null)}
        title={
          pickerDate
            ? `Chọn outfit cho ${format(pickerDate, 'dd/MM/yyyy')}`
            : 'Chọn outfit'
        }
        wide
        serifTitle
      >
        {outfits.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[#869BB2] bg-[#FAF9F5] py-12 text-center">
            <p className="font-serif-display text-lg font-semibold text-[#1F453E]">Chưa có outfit nào</p>
            <p className="mt-1 max-w-sm text-sm text-[#6B7B76]">
              Hãy sang trang Phối đồ để tạo outfit đầu tiên.
            </p>
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {outfits.map((o) => (
              <button
                key={o._id}
                disabled={assigning}
                onClick={() => void handleAssign(o._id)}
                className="rounded-xl border border-[#CBD5E1] bg-[#FAF9F5] p-2.5 text-left transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/30 disabled:opacity-50"
              >
                <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-white">
                  {o.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.thumbnailUrl}
                      alt={o.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <CalendarDays size={20} className="text-[#869BB2]" />
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-[#1F453E]">{o.name}</p>
              </button>
            ))}
          </div>
        )}
      </VModal>

      {/* ===== NEW: Delete Confirmation Popup ===== */}
      <DeleteConfirmModal
        open={Boolean(entryToRemove)}
        title="Bỏ outfit khỏi lịch?"
        description={
          <>
            Bạn có chắc chắn muốn gỡ bộ trang phục
            {entryToRemove?.outfit?.name ? <> &ldquo;{entryToRemove.outfit.name}&rdquo;</> : null}{' '}
            khỏi ngày
            {entryToRemove ? ` ${format(new Date(entryToRemove.date), 'dd/MM/yyyy')}` : ' đã chọn'}{' '}
            không?
          </>
        }
        confirmLabel="Gỡ khỏi lịch"
        deleting={removing}
        onCancel={closeRemoveConfirm}
        onConfirm={() => entryToRemove && void handleRemove(entryToRemove)}
      />

      {/* ===== NEW: Toast thay alert() ===== */}
      <VToast message={toastError} variant="error" duration={4000} onClose={closeToast} />
    </ProtectedLayout>
  );
}
