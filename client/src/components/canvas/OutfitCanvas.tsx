'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import type { Canvas } from 'fabric';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, addItemToCanvas, applyCategoryOrder,
  bringForward, sendBackward, removeActive, flipActive,
  serializeItems, exportThumbnail, loadCanvasJSON,
  // ===== NEW: Body Profile =====
  clearItems, reflowItems, serializeCanvasJSON, setMannequin, setMannequinVisible,
  snapWhileMoving, updateAttachment, type ItemObject,
  // ===== END NEW =====
} from '@/lib/fabricCanvas';
// ===== NEW: Body Profile =====
import { buildMannequin, type MannequinAnchors } from '@/lib/mannequin';
// ===== END NEW =====
import type { ClothingItem, MannequinProfile, OutfitItem } from '@/types';

/** API mà trang Studio dùng để điều khiển canvas. */
export interface OutfitCanvasHandle {
  addItem: (item: ClothingItem) => Promise<void>;
  serialize: () => {
    items: ReturnType<typeof serializeItems>;
    canvasJSON: Record<string, unknown>;
    /** Snapshot dáng lúc phối; null khi đang tắt mannequin. */
    mannequin: MannequinProfile | null;
  };
  exportThumbnail: (includeMannequin?: boolean) => string;
  /**
   * Nạp outfit đã lưu. profile là dáng sẽ vẽ ngay (trước khi Studio cập nhật prop)
   * để các item đã bám anchor không bị reflow nhầm.
   */
  loadJSON: (
    json: Record<string, unknown>,
    items: OutfitItem[],
    profile: MannequinProfile,
    showMannequin: boolean
  ) => Promise<void>;
  /** Xóa mọi món đồ, giữ lại mannequin. */
  clear: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  removeSelected: () => void;
  flipSelected: () => void;
  autoArrange: () => void;
}

const sameProfile = (a: MannequinProfile, b: MannequinProfile) =>
  JSON.stringify(a) === JSON.stringify(b);

export const OutfitCanvas = forwardRef<
  OutfitCanvasHandle,
  {
    onSelectionChange?: (hasSelection: boolean) => void;
    onDirty?: () => void;
    /** Ti le hien thi (chi CSS). Kich thuoc that cua canvas van la CANVAS_WIDTH x CANVAS_HEIGHT. */
    scale?: number;
    // ===== NEW: Body Profile =====
    /** Dáng mannequin đang dùng cho outfit này. Đổi -> mannequin + item đã bám anchor reflow. */
    mannequin: MannequinProfile;
    showMannequin?: boolean;
    /** Hút item vào anchor khi kéo (giữ Shift để tạm tắt). */
    autoSnap?: boolean;
    /** Gọi 1 lần khi Fabric đã sẵn sàng (có thể loadJSON). */
    onReady?: () => void;
    // ===== END NEW =====
  }
>(function OutfitCanvas(
  { onSelectionChange, onDirty, scale = 1, mannequin, showMannequin = true, autoSnap = true, onReady },
  ref
) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);

  // ===== NEW: Body Profile =====
  // Trang thai hien tai cua lop mannequin tren canvas (doc trong event handler cua Fabric).
  const profileRef = useRef<MannequinProfile>(mannequin);
  const anchorsRef = useRef<MannequinAnchors>(buildMannequin(mannequin).anchors);
  const showRef = useRef(showMannequin);
  const autoSnapRef = useRef(autoSnap);
  const scaleRef = useRef(scale);

  /** So lan loadJSON dang chay - trong luc nap, prop mannequin cua Studio chua kip cap nhat. */
  const loadingRef = useRef(0);
  /** Noi tiep cac lan nap de 2 loadFromJSON khong chen object vao nhau (StrictMode goi 2 lan). */
  const loadChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { autoSnapRef.current = autoSnap; }, [autoSnap]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  // ===== END NEW =====

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
        // NEW: Body Profile - Shift danh cho "dat tu do" (tat hut) nen chon nhieu bang Ctrl/Cmd.
        selectionKey: ['ctrlKey', 'metaKey'],
      });

      canvasRef.current = canvas;
      await setMannequin(canvas, profileRef.current, showRef.current); // NEW: Body Profile
      if (disposed) return;
      setReady(true);
      onReady?.();

      const emitSelection = () =>
        onSelectionChange?.(Boolean(canvas?.getActiveObject()));

      canvas.on('selection:created', emitSelection);
      canvas.on('selection:updated', emitSelection);
      canvas.on('selection:cleared', () => onSelectionChange?.(false));

      // ===== NEW: Body Profile =====
      canvas.on('object:moving', ({ target, e }) => {
        const shift = Boolean(e && 'shiftKey' in e && e.shiftKey);
        snapWhileMoving(target as ItemObject, anchorsRef.current, {
          snap: autoSnapRef.current && !shift,
          cssScale: scaleRef.current,
        });
      });
      canvas.on('object:modified', ({ target, action }) => {
        // Keo 1 item: anchor da cap nhat trong 'object:moving'. Con lai (scale, xoay,
        // keo ca nhom) -> tinh lai anchorRef/offset theo vi tri moi, khong hut.
        if (action !== 'drag' || !(target as ItemObject).itemData) {
          const targets = (target as ItemObject).itemData ? [target] : (canvas?.getActiveObjects() ?? []);
          targets.forEach((o) => updateAttachment(o as ItemObject, anchorsRef.current, scaleRef.current));
        }
        onDirty?.();
      });
      // ===== END NEW =====
    })();

    return () => {
      disposed = true;
      void canvas?.dispose();
      canvasRef.current = null;
    };
    // Chi khoi tao 1 lan; callback duoc doc qua closure moi lan event ban ra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== NEW: Body Profile =====
  // Doi dang -> ve lai mannequin va reflow item dang bam anchor.
  useEffect(() => {
    const canvas = canvasRef.current;
    // Dang nap outfit: prop van la dang cu, neu reflow luc nay se scale nham item vua nap.
    if (!ready || !canvas || loadingRef.current > 0 || sameProfile(mannequin, profileRef.current)) return;

    const from = anchorsRef.current;
    const to = buildMannequin(mannequin).anchors;
    profileRef.current = mannequin;
    anchorsRef.current = to;
    void setMannequin(canvas, mannequin, showRef.current);
    if (reflowItems(canvas, from, to) > 0) onDirty?.();
    onSelectionChange?.(false);
  }, [ready, mannequin, onDirty, onSelectionChange]);

  useEffect(() => {
    showRef.current = showMannequin;
    if (ready && canvasRef.current) setMannequinVisible(canvasRef.current, showMannequin);
  }, [ready, showMannequin]);
  // ===== END NEW =====

  // Xoa object dang chon bang phim Delete/Backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Bo qua khi dang go trong input.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
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
        await addItemToCanvas(canvasRef.current, item, anchorsRef.current);
        onDirty?.();
      },
      serialize: () => {
        const canvas = canvasRef.current;
        if (!canvas) return { items: [], canvasJSON: {}, mannequin: null };
        // NEW: Body Profile - item trong ActiveSelection co left/top tuong doi -> bo chon truoc khi trich.
        canvas.discardActiveObject();
        onSelectionChange?.(false);
        return {
          items: serializeItems(canvas),
          canvasJSON: serializeCanvasJSON(canvas),
          mannequin: showRef.current ? profileRef.current : null,
        };
      },
      exportThumbnail: (includeMannequin = true) =>
        canvasRef.current ? exportThumbnail(canvasRef.current, includeMannequin && showRef.current) : '',
      loadJSON: (json, items, profile, visible) => {
        loadingRef.current++;
        const run = async () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          profileRef.current = profile;
          showRef.current = visible;
          anchorsRef.current = buildMannequin(profile).anchors;
          await loadCanvasJSON(canvas, json, items);
          // loadFromJSON xoa sach canvas (ke ca mannequin) -> ve lai o lop duoi cung.
          await setMannequin(canvas, profile, showRef.current);
          onSelectionChange?.(false);
        };
        const done = loadChainRef.current.then(run).finally(() => { loadingRef.current--; });
        loadChainRef.current = done.catch(() => undefined);
        return done;
      },
      clear: () => {
        if (!canvasRef.current) return;
        clearItems(canvasRef.current);
        onSelectionChange?.(false);
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
    <div
      className="relative box-content overflow-hidden rounded-xl border border-dashed border-[#869BB2]/50 bg-white"
      style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}
    >
      {/* Thu nho bang transform: Fabric tu quy doi toa do chuot qua getBoundingClientRect. */}
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <canvas ref={elRef} />
      </div>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-white/60">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1F453E] border-t-transparent" />
        </div>
      )}
    </div>
  );
});
