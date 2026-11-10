'use client';
import dynamic from 'next/dynamic';

/** Tach SDK Decart khoi bundle cua trang Tu do va Studio, chi tai khi user bam thu. */
export const LazyLiveTryOnModal = dynamic(
  () => import('./LiveTryOnModal').then((module) => module.LiveTryOnModal),
  { ssr: false }
);
