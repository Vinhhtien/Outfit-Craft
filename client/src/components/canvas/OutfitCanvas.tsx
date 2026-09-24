'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import type { Canvas } from 'fabric';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, addItemToCanvas, applyCategoryOrder,
  bringForward, sendBackward, removeActive, flipActive,
  serializeItems, exportThumbnail, loadCanvasJSON,
} from '@/lib/fabricCanvas';
import type { ClothingItem } from '@/types';

/** API mà trang Studio dùng để điều khiển canvas. */
export interface OutfitCanvasHandle {
  addItem: (item: ClothingItem) => Promise<void>;
  serialize: () => { items: ReturnType<typeof serializeItems>; canvasJSON: Record<string, unknown> };
  exportThumbnail: () => string;
  loadJSON: (json: Record<string, unknown>) => Promise<void>;
  clear: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  removeSelected: () => void;
  flipSelected: () => void;
  autoArrange: () => void;
}

export const OutfitCanvas = forwardRef<
  OutfitCanvasHandle,
  { onSelectionChange?: (hasSelection: boolean) => void; onDirty?: () => void }
>(function OutfitCanvas({ onSelectionChange, onDirty }, ref) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let canvas: Canvas | null = null;

    // Fabric chi chay tren browser -> import dong trong effect.
    void (async () => {
      const { Canvas: FabricCanvas } = await import('fabric');
      if (disposed || !elRef.current) return;

      canvas = new FabricCanvas(elRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: 'transparent',
        preserveObjectStacking: true, // chon object khong tu nhay len tren
      });

      canvasRef.current = canvas;
      setReady(true);

      const emitSelection = () =>
        onSelectionChange?.(Boolean(canvas?.getActiveObject()));

      canvas.on('selection:created', emitSelection);
      canvas.on('selection:updated', emitSelection);
      canvas.on('selection:cleared', () => onSelectionChange?.(false));
      canvas.on('object:modified', () => onDirty?.());
    })();

    return () => {
      disposed = true;
      void canvas?.dispose();
      canvasRef.current = null;
    };
    // Chi khoi tao 1 lan; callback duoc doc qua closure moi lan event ban ra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Xoa object dang chon bang phim Delete/Backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Bo qua khi dang go trong input.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvasRef.current?.getActiveObject()) {
          e.preventDefault();
          removeActive(canvasRef.current);
          onSelectionChange?.(false);
          onDirty?.();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelectionChange, onDirty]);

  useImperativeHandle(
    ref,
    (): OutfitCanvasHandle => ({
      addItem: async (item) => {
        if (!canvasRef.current) return;
        await addItemToCanvas(canvasRef.current, item);
        onDirty?.();
      },
      serialize: () => {
        const canvas = canvasRef.current;
        if (!canvas) return { items: [], canvasJSON: {} };
        return {
          items: serializeItems(canvas),
          canvasJSON: canvas.toJSON() as unknown as Record<string, unknown>,
        };
      },
      exportThumbnail: () =>
        canvasRef.current ? exportThumbnail(canvasRef.current) : '',
      loadJSON: async (json) => {
        if (canvasRef.current) await loadCanvasJSON(canvasRef.current, json);
      },
      clear: () => {
        canvasRef.current?.clear();
        onDirty?.();
      },
      bringForward: () => {
        const canvas = canvasRef.current;
        const obj = canvas?.getActiveObject();
        if (canvas && obj) { bringForward(canvas, obj); onDirty?.(); }
      },
      sendBackward: () => {
        const canvas = canvasRef.current;
        const obj = canvas?.getActiveObject();
        if (canvas && obj) { sendBackward(canvas, obj); onDirty?.(); }
      },
      removeSelected: () => {
        if (canvasRef.current) {
          removeActive(canvasRef.current);
          onSelectionChange?.(false);
          onDirty?.();
        }
      },
      flipSelected: () => {
        if (canvasRef.current) { flipActive(canvasRef.current); onDirty?.(); }
      },
      autoArrange: () => {
        if (canvasRef.current) { applyCategoryOrder(canvasRef.current); onDirty?.(); }
      },
    }),
    [onSelectionChange, onDirty]
  );

  return (
    <div className="relative inline-block rounded-2xl border border-[var(--border)] canvas-checker overflow-hidden">
      <canvas ref={elRef} />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--card)]/60">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
});
