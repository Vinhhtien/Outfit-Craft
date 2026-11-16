'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_MANNEQUIN, buildMannequin } from '@/lib/mannequin';
import { autoPlace, placeFromFit, type ItemBox } from '@/lib/outfitPlacement';
import { CATEGORY_Z_INDEX } from '@/types';
import type { Category, ClothingItem, MannequinProfile } from '@/types';

/** Tỉ lệ cao/rộng tạm khi ảnh chưa tải xong, để khung không nhảy quá nhiều. */
const FALLBACK_ASPECT: Record<Category, number> = {
  top: 1.1, outerwear: 1.2, bottom: 1.6, dress: 1.7, set: 1.6, shoes: 0.6, bag: 1, accessory: 1,
};

/**
 * Ảnh Cloudinary của app cắt bỏ viền trong suốt (ảnh tách nền giữ nguyên khung ảnh chụp, món đồ
 * chỉ chiếm phần giữa) để món được co theo kích thước thật của nó. Ảnh ngoài Cloudinary giữ nguyên.
 */
export function trimmedImageUrl(src: string): string {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return src;
    return src.replace(/(\/image\/upload\/)(v\d+\/|outfitcraft\/)/, '$1e_trim/f_auto,q_auto,c_limit,w_480/$2');
  } catch { return src; }
}

/**
 * Vị trí ghi nhớ còn nằm trên người: tâm không lệch quá 60% bề ngang vị trí chuẩn,
 * kích cỡ không nhỏ hơn một nửa hay lớn hơn 3 lần cỡ chuẩn.
 */
export function isPlausibleFit(fit: ItemBox, auto: ItemBox): boolean {
  const ratio = fit.width / auto.width;
  return Math.abs(fit.cx - auto.cx) <= auto.width * 0.6 && ratio >= 0.5 && ratio <= 3;
}

/**
 * Bộ đồ mặc trên người mẫu (SVG, không cần canvas): dùng cùng hình người, điểm neo và quy tắc
 * đặt đồ với Studio. Món đã căn chỉnh ở Studio (fit) nằm đúng vị trí đã ghi nhớ.
 */
export function OutfitLook({
  items,
  profile = DEFAULT_MANNEQUIN,
  title,
  className = '',
}: {
  items: ClothingItem[];
  profile?: MannequinProfile;
  title?: string;
  className?: string;
}) {
  const mannequin = useMemo(() => buildMannequin(profile), [profile]);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  /** Món mà Cloudinary không cắt viền được -> dùng ảnh gốc. */
  const [untrimmed, setUntrimmed] = useState<Record<string, true>>({});

  // Đọc tỉ lệ thật của món (ảnh đã cắt viền trong suốt) để đặt đúng chiều cao trên người.
  useEffect(() => {
    let alive = true;
    for (const item of items) {
      const load = (src: string, onFail?: () => void) => {
        const image = new Image();
        image.onload = () => {
          if (!alive || !image.naturalWidth) return;
          const aspect = image.naturalHeight / image.naturalWidth;
          setAspects((current) => (current[item._id] === aspect ? current : { ...current, [item._id]: aspect }));
        };
        if (onFail) image.onerror = onFail;
        image.src = src;
      };
      const trimmed = trimmedImageUrl(item.imageUrl);
      if (trimmed === item.imageUrl) load(item.imageUrl);
      else load(trimmed, () => {
        if (!alive) return;
        setUntrimmed((current) => ({ ...current, [item._id]: true }));
        load(item.imageUrl);
      });
    }
    return () => { alive = false; };
  }, [items]);

  const layers = useMemo(() => [...items]
    .sort((a, b) => (CATEGORY_Z_INDEX[a.category] ?? 0) - (CATEGORY_Z_INDEX[b.category] ?? 0))
    .map((item) => {
      const aspect = aspects[item._id] ?? FALLBACK_ASPECT[item.category] ?? 1;
      const auto = autoPlace(item.category, aspect, mannequin.anchors);
      const fitted = item.fit ? placeFromFit(item.fit, item.category, mannequin.anchors) : null;
      // Vị trí ghi nhớ bị kéo lệch khỏi người (vd lưu nhầm ở Studio) thì đặt lại tự động cho bộ đồ gọn gàng.
      const useFit = Boolean(fitted && isPlausibleFit(fitted.box, auto.box));
      return {
        item,
        box: useFit ? fitted!.box : auto.box,
        // Vị trí ghi nhớ được căn theo ảnh gốc ở Studio; đặt tự động thì dùng ảnh đã cắt viền.
        href: useFit || untrimmed[item._id] ? item.imageUrl : trimmedImageUrl(item.imageUrl),
        ready: useFit || aspects[item._id] !== undefined,
      };
    }), [items, aspects, untrimmed, mannequin]);

  return (
    <svg
      viewBox={mannequin.viewBox}
      className={className}
      role="img"
      aria-label={title ?? `Bộ đồ mặc trên người mẫu: ${items.map((i) => i.name).join(', ')}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={mannequin.pathD} style={{ fill: 'var(--mannequin-fill)' }} />
      {layers.map(({ item, box, href, ready }) => (
        <image
          key={item._id}
          href={href}
          x={box.cx - box.width / 2}
          y={box.cy - box.height / 2}
          width={box.width}
          height={box.height}
          preserveAspectRatio="xMidYMid meet"
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 200ms' }}
        >
          <title>{item.name}</title>
        </image>
      ))}
    </svg>
  );
}
