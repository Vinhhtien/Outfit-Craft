'use client';
import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

export function optimizedImageUrl(src: string): string {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return src;
    // Only transform the original upload URL, never stack transformations.
    return src.replace(/(\/image\/upload\/)(v\d+\/|outfitcraft\/)/, '$1f_auto,q_auto,c_limit,w_640/$2');
  } catch { return src; }
}

/** Parent keeps image dimensions. This component is safe inside a clickable card. */
export function CloudImage({ src, alt = '', className = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<ImgHTMLAttributes<HTMLImageElement>['src']>();

  if (!src) {
    return (
      <span
        role="img"
        aria-label="Không có ảnh"
        className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-[#869BB2]"
      >
        <ImageOff size={22} className="stroke-[1.5] text-[#869BB2]/80" />
        <span className="mt-1 text-[10px] font-medium text-[#6B7B76]">Không có ảnh</span>
      </span>
    );
  }

  if (failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={`${alt || 'Ảnh'} chưa tải được`}
        className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-xs text-[#869BB2]"
      >
        <ImageOff size={20} className="stroke-[1.5] text-[#869BB2]/70" />
        <span className="mt-1 text-[10px] font-medium text-[#6B7B76]">Không thể tải ảnh</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      className={className}
      src={typeof src === 'string' ? optimizedImageUrl(src) : src}
      alt={alt}
      loading={props.loading ?? 'lazy'}
      decoding="async"
      onError={(event) => {
        // A disabled Cloudinary transformation must not break an otherwise valid original.
        if (
          typeof src === 'string' &&
          event.currentTarget.src !== new URL(src, window.location.href).href
        ) {
          event.currentTarget.src = src;
          return;
        }
        setFailedSrc(src);
      }}
    />
  );
}

