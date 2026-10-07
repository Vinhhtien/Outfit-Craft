'use client';

// ===== NEW: Body 3D =====
// Xem truoc nguoi mau 3D o trang Ho so (khong co mon do). Nap bang next/dynamic ssr:false.
import { useMemo } from 'react';
import { computeBodyGeometry, type BodyModelInput } from '@/lib/bodyModel';
import type { BodyState } from '@/lib/bodyMetrics';
import { Body3D } from './Body3D';
import { BodyScene } from './BodyScene';
import { useFrameThrottled } from './useFrameThrottled';

export function BodyPreview3D({ body }: { body: BodyState }) {
  const throttled = useFrameThrottled(body);
  const input: BodyModelInput = useMemo(
    () => ({ gender: throttled.gender, metrics: throttled.metrics, shoulderCm: throttled.shoulderCm }),
    [throttled.gender, throttled.metrics, throttled.shoulderCm]
  );
  const geo = useMemo(() => computeBodyGeometry(input), [input]);

  return (
    <BodyScene heightM={geo.heightM}>
      <Body3D geo={geo} input={input} hue={throttled.hue} />
    </BodyScene>
  );
}
// ===== END NEW =====
