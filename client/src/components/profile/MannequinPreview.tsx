// ===== NEW: Body Profile =====
import { useMemo } from 'react';
import { buildMannequin } from '@/lib/mannequin';
import type { MannequinProfile } from '@/types';

/** Bong nguoi SVG sinh tu buildMannequin - cung hinh voi lop mannequin tren canvas. */
export function MannequinPreview({
  profile,
  className = '',
  title,
}: {
  profile: MannequinProfile;
  className?: string;
  title?: string;
}) {
  const { pathD, viewBox } = useMemo(() => buildMannequin(profile), [profile]);

  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={title ?? 'Bóng người minh họa'}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={pathD} style={{ fill: 'var(--mannequin-fill)' }} />
    </svg>
  );
}
// ===== END NEW =====
