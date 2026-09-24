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
import { Button, Modal, Spinner, EmptyState } from '@/components/ui';
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
      alert(getErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkWorn = async (entry: ScheduleEntry) => {
    try {
      await scheduleApi.markWorn(entry._id);
      await load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleRemove = async (entry: ScheduleEntry) => {
    if (!confirm('Bỏ outfit khỏi ngày này?')) return;
    try {
      await scheduleApi.remove(entry._id);
      await load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <ProtectedLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lịch trang phục</h1>
          <p className="text-sm text-[var(--muted)]">
            Lên kế hoạch mặc gì cho từng ngày.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(addMonths(month, -1))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] hover:bg-black/5"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="w-32 text-center text-sm font-medium capitalize">
            {format(month, 'MMMM yyyy', { locale: vi })}
          </span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] hover:bg-black/5"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-medium text-[var(--muted)]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const entry = entryFor(day);
              const inMonth = isSameMonth(day, month);

              return (
                <div
                  key={day.toISOString()}
                  className={`group relative min-h-[92px] border-b border-r border-[var(--border)] p-1.5 ${
                    inMonth ? '' : 'opacity-40'
                  }`}
                >
                  <span
                    className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs ${
                      isToday(day)
                        ? 'bg-[var(--primary)] font-semibold text-white'
                        : 'text-[var(--muted)]'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {entry ? (
                    <div className="mt-1">
                      <div className="canvas-checker relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-[var(--border)]">
                        {entry.outfit?.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.outfit.thumbnailUrl}
                            alt={entry.outfit.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <CalendarDays size={16} className="text-[var(--muted)]" />
                        )}

                        {entry.isWorn && (
                          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-green-500 text-white">
                            <Check size={10} />
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-[10px]" title={entry.outfit?.name}>
                        {entry.outfit?.name}
                      </p>

                      <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!entry.isWorn && (
                          <button
                            onClick={() => void handleMarkWorn(entry)}
                            title="Đánh dấu đã mặc"
                            className="grid h-5 flex-1 place-items-center rounded bg-green-500 text-white"
                          >
                            <Check size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => void handleRemove(entry)}
                          title="Bỏ khỏi ngày này"
                          className="grid h-5 flex-1 place-items-center rounded bg-red-500 text-white"
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
                        className="mt-1 grid h-[58px] w-full place-items-center rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] opacity-0 transition-opacity hover:border-[var(--primary)] hover:text-[var(--primary)] group-hover:opacity-100"
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

      {/* Modal chon outfit */}
      <Modal
        open={Boolean(pickerDate)}
        onClose={() => setPickerDate(null)}
        title={
          pickerDate
            ? `Chọn outfit cho ${format(pickerDate, 'dd/MM/yyyy')}`
            : 'Chọn outfit'
        }
        wide
      >
        {outfits.length === 0 ? (
          <EmptyState
            title="Chưa có outfit nào"
            description="Hãy sang trang Phối đồ để tạo outfit đầu tiên."
          />
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {outfits.map((o) => (
              <button
                key={o._id}
                disabled={assigning}
                onClick={() => void handleAssign(o._id)}
                className="rounded-xl border border-[var(--border)] p-2 text-left transition-colors hover:border-[var(--primary)] disabled:opacity-50"
              >
                <div className="canvas-checker grid aspect-square place-items-center overflow-hidden rounded-lg">
                  {o.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.thumbnailUrl}
                      alt={o.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <CalendarDays size={20} className="text-[var(--muted)]" />
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{o.name}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </ProtectedLayout>
  );
}
