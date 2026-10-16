'use client';
import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

export function optimizedImageUrl(src: string): string {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return src;
    // Only transform the original upload URL, never stack transformations.
    return src.replace(/(\/image\/upload\/)(v\d+\/|outfitcraft\/)/, '$1f_auto,q_auto,c_limit,w_640/$2');
  } catch { return src; }
}

/** Parent keeps image dimensions. This component is safe inside a clickable card. */
export function CloudImage({ src, alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<ImgHTMLAttributes<HTMLImageElement>['src']>();
  if (!src || failedSrc === src) return <span role="img" aria-label={`${alt || 'Ảnh'} chưa tải được`} className="grid h-full min-h-24 w-full place-items-center p-3 text-center text-xs text-[#52665F]">Ảnh chưa tải được</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={typeof src === 'string' ? optimizedImageUrl(src) : src} alt={alt} loading={props.loading ?? 'lazy'} decoding="async" onError={(event) => {
    // A disabled Cloudinary transformation must not break an otherwise valid original.
    if (typeof src === 'string' && event.currentTarget.src !== new URL(src, window.location.href).href) { event.currentTarget.src = src; return; }
    setFailedSrc(src);
  }} />;
}
