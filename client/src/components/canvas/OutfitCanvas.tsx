'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ErrorState } from '@/components/ui/AsyncState';
import type { Canvas } from 'fabric';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, addItemToCanvas, applyCategoryOrder,
  bringForward, sendBackward, removeActive, flipActive,
  serializeItems, exportThumbnail, loadCanvasJSON,
  // ===== NEW: Body Profile =====
  clearItems, reflowItems, serializeCanvasJSON, setMannequin, setMannequinVisible,
  snapWhileMoving, updateAttachment, upgradeLegacyLayout, addItemAtPlacement,
  type ItemObject, type PresetPlacement,
  // ===== END NEW =====
  itemFitOf, // NEW: Ghi nho fit
  getItemObjects,
} from '@/lib/fabricCanvas';
// ===== NEW: Body Profile =====
import { buildMannequin, type MannequinAnchors } from '@/lib/mannequin';
// ===== END NEW =====
import { placeFromFit } from '@/lib/outfitPlacement'; // NEW: Ghi nho fit
import type { ClothingItem, ItemFit, MannequinProfile, OutfitItem } from '@/types';

/** API mà trang Studio dùng để điều khiển canvas. */
export interface OutfitCanvasHandle {
  /** false = mon nay da co tren canvas (moi mon chi duoc them 1 lan) -> chon lai mon do. */
  addItem: (item: ClothingItem) => Promise<boolean>;
  /** Them nhieu mon vao vi tri da tinh san, theo dung thu tu (trong -> ngoai). */
  addPlacedItems: (list: { item: ClothingItem; placement: PresetPlacement }[]) => Promise<void>;
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
   * legacyProfile: outfit lưu theo hình thế hệ cũ (xem needsLayoutUpgrade trong fabricCanvas.ts)
   * -> dáng đã vẽ lúc lưu; món đồ được đặt lại từ hình cũ lên hình hiện tại.
   */
  loadJSON: (
    json: Record<string, unknown>,
    items: OutfitItem[],
    profile: MannequinProfile,
    showMannequin: boolean,
    legacyProfile?: MannequinProfile | null
  ) => Promise<void>;
  /** Xóa mọi món đồ, giữ lại mannequin. */
  clear: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  removeSelected: () => void;
  flipSelected: () => void;
  autoArrange: () => void;
  // ===== NEW: Ghi nho fit =====
  /**
   * Vị trí + cỡ của món đang chọn (đúng 1 món) để ghi nhớ vào món đồ.
   * null = không chọn đúng 1 món; fit null = món đang đặt tự do, không bám cơ thể.
   */
  getSelectedFit: () => { itemId: string; fit: ItemFit | null } | null;
  // ===== END NEW =====
  // ===== NEW: O mon do =====
  /**
   * Thay 1 mon tren canvas bang mon khac (thuong cung loai), giu thu tu lop cua mon cu.
   * false = mon cu khong con tren canvas hoac mon moi da co san.
   */
  replaceItem: (oldItemId: string, item: ClothingItem) => Promise<boolean>;
  /** Bo 1 mon khoi canvas theo id. */
  removeItem: (itemId: string) => void;
  /** Chup trang thai mon do hien tai (de hoan tac). Bo chon truoc de toa do khong bi tuong doi. */
  snapshot: () => Record<string, unknown>;
  /** Tra canvas ve 1 snapshot, giu nguyen dang nguoi mau dang hien. */
  restore: (snapshot: Record<string, unknown>) => Promise<void>;
  // ===== END NEW =====
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
    // ===== NEW: Ghi nho fit =====
    /**
     * Món chưa có fit vừa được thêm và user kéo / chỉnh cỡ cho vừa người mẫu -> vị trí + cỡ
     * mới (gọi sau mỗi lần chỉnh; Studio tự gom lại trước khi lưu).
     */
    onItemFit?: (itemId: string, fit: ItemFit) => void;
    // ===== END NEW =====
    /** NEW: O mon do - id cac mon dang co tren canvas (theo thu tu lop), goi moi khi them/bot/thay/nap. */
    onItemsChange?: (itemIds: string[]) => void;
  }
>(function OutfitCanvas(
  { onSelectionChange, onDirty, scale = 1, mannequin, showMannequin = true, autoSnap = true, onReady, onItemFit, onItemsChange },
  ref
) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState('');

  // ===== NEW: Body Profile =====
  // Trang thai hien tai cua lop mannequin tren canvas (doc trong event handler cua Fabric).
  const profileRef = useRef<MannequinProfile>(mannequin);
  const anchorsRef = useRef<MannequinAnchors>(buildMannequin(mannequin).anchors);
  const showRef = useRef(showMannequin);
  const autoSnapRef = useRef(autoSnap);
  const scaleRef = useRef(scale);

  /** So lan loadJSON dang chay - trong luc nap, prop mannequin cua Studio chua kip cap nhat. */
  const loadingRef = useRef(0);
  /** Dang moi nhat cho frame ke tiep - keo slider so do chi ve lai/reflow toi da 1 lan moi frame. */
  const pendingProfileRef = useRef<MannequinProfile | null>(null);
  const frameRef = useRef(0);
  /** Noi tiep cac lan nap de 2 loadFromJSON khong chen object vao nhau (StrictMode goi 2 lan). */
  const loadChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { autoSnapRef.current = autoSnap; }, [autoSnap]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  // ===== END NEW =====

  // ===== NEW: O mon do =====
  const onItemsChangeRef = useRef(onItemsChange);
  useEffect(() => { onItemsChangeRef.current = onItemsChange; }, [onItemsChange]);
  /** Bao danh sach mon hien tai cho Studio (doc trong ref nen goi duoc tu event handler). */
  const emitItemsRef = useRef(() => {
    const canvas = canvasRef.current;
    onItemsChangeRef.current?.(canvas ? getItemObjects(canvas).map((o) => o.itemData!.itemId) : []);
  });
  // ===== END NEW =====

  // ===== NEW: Ghi nho fit =====
  /** Object cua mon chua co fit (lan dau thu): moi lan user chinh -> bao fit moi de ghi nho. */
  const calibratingRef = useRef(new WeakSet<ItemObject>());
  const onItemFitRef = useRef(onItemFit);
  useEffect(() => { onItemFitRef.current = onItemFit; }, [onItemFit]);
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
        // NEW: Ghi nho fit - chi 1 mon (trong nhom thi box la toa do tuong doi, khong dung duoc).
        const obj = target as ItemObject;
        if (obj.itemData && calibratingRef.current.has(obj)) {
          const fit = itemFitOf(obj, anchorsRef.current);
          if (fit) onItemFitRef.current?.(obj.itemData.itemId, fit);
        }
        onDirty?.();
      });
      // ===== END NEW =====
    })().catch(() => { if (!disposed) setInitializationError('Không thể khởi tạo khung phối đồ. Vui lòng tải lại trang.'); });

    return () => {
      disposed = true;
      void canvas?.dispose();
      canvasRef.current = null;
    };
    // Chi khoi tao 1 lan; callback duoc doc qua closure moi lan event ban ra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== NEW: Body Profile =====
  // Doi dang / so do -> ve lai mannequin va reflow item dang bam anchor, gom theo frame.
  useEffect(() => {
    if (!ready) return;
    pendingProfileRef.current = mannequin;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const canvas = canvasRef.current;
      const next = pendingProfileRef.current;
      pendingProfileRef.current = null;
      // Dang nap outfit: prop van la dang cu, neu reflow luc nay se scale nham item vua nap.
      if (!canvas || !next || loadingRef.current > 0 || sameProfile(next, profileRef.current)) return;

      const from = anchorsRef.current;
      const to = buildMannequin(next).anchors;
      profileRef.current = next;
      anchorsRef.current = to;
      void setMannequin(canvas, next, showRef.current);
      if (reflowItems(canvas, from, to) > 0) onDirty?.();
      onSelectionChange?.(false);
    });
  }, [ready, mannequin, onDirty, onSelectionChange]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

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
          emitItemsRef.current(); // NEW: O mon do
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
        if (!canvasRef.current) return false;
        const existing = getItemObjects(canvasRef.current).find((o) => o.itemData?.itemId === item._id);
        if (existing) {
          canvasRef.current.setActiveObject(existing);
          canvasRef.current.requestRenderAll();
          onSelectionChange?.(true);
          return false;
        }
        const obj = await addItemToCanvas(canvasRef.current, item, anchorsRef.current);
        // NEW: Ghi nho fit - chua co fit dung duoc -> lan dau thu, theo doi de ghi nho khi user can.
        if (!item.fit || !placeFromFit(item.fit, item.category, anchorsRef.current)) {
          calibratingRef.current.add(obj);
        }
        onDirty?.();
        emitItemsRef.current(); // NEW: O mon do
        return true;
      },
      addPlacedItems: async (list) => {
        for (const { item, placement } of list) {
          if (!canvasRef.current) return;
          await addItemAtPlacement(canvasRef.current, item, placement);
        }
        canvasRef.current?.discardActiveObject();
        onSelectionChange?.(false);
        emitItemsRef.current(); // NEW: O mon do
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
      loadJSON: (json, items, profile, visible, legacyProfile) => {
        loadingRef.current++;
        const run = async () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          profileRef.current = profile;
          showRef.current = visible;
          anchorsRef.current = buildMannequin(profile).anchors;
          await loadCanvasJSON(canvas, json, items, anchorsRef.current);
          if (legacyProfile) upgradeLegacyLayout(canvas, legacyProfile, profile);
          // loadFromJSON xoa sach canvas (ke ca mannequin) -> ve lai o lop duoi cung.
          await setMannequin(canvas, profile, showRef.current);
          onSelectionChange?.(false);
          emitItemsRef.current(); // NEW: O mon do
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
        emitItemsRef.current(); // NEW: O mon do
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
          emitItemsRef.current(); // NEW: O mon do
        }
      },
      flipSelected: () => {
        if (canvasRef.current) { flipActive(canvasRef.current); onDirty?.(); }
      },
      autoArrange: () => {
        if (canvasRef.current) { applyCategoryOrder(canvasRef.current); onDirty?.(); }
      },
      // ===== NEW: Ghi nho fit =====
      getSelectedFit: () => {
        const obj = canvasRef.current?.getActiveObject() as ItemObject | undefined;
        if (!obj?.itemData?.itemId) return null;
        return { itemId: obj.itemData.itemId, fit: itemFitOf(obj, anchorsRef.current) };
      },
      // ===== END NEW =====
      // ===== NEW: O mon do =====
      replaceItem: async (oldItemId, item) => {
        const canvas = canvasRef.current;
        if (!canvas) return false;
        const objects = getItemObjects(canvas);
        const old = objects.find((o) => o.itemData?.itemId === oldItemId);
        if (!old || objects.some((o) => o.itemData?.itemId === item._id)) return false;
        // Tai anh moi truoc, loi mang thi mon cu van nguyen tren canvas.
        const index = canvas.getObjects().indexOf(old);
        const obj = await addItemToCanvas(canvas, item, anchorsRef.current);
        // Mon cu co the da bi xoa trong luc tai anh -> khi do giu mon moi o lop mac dinh.
        if (canvas.getObjects().includes(old)) {
          canvas.remove(old);
          canvas.moveObjectTo(obj, Math.min(index, canvas.getObjects().length - 1));
        }
        if (!item.fit || !placeFromFit(item.fit, item.category, anchorsRef.current)) {
          calibratingRef.current.add(obj);
        }
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        onSelectionChange?.(true);
        onDirty?.();
        emitItemsRef.current();
        return true;
      },
      removeItem: (itemId) => {
        const canvas = canvasRef.current;
        const obj = canvas && getItemObjects(canvas).find((o) => o.itemData?.itemId === itemId);
        if (!canvas || !obj) return;
        if (canvas.getActiveObjects().includes(obj)) {
          canvas.discardActiveObject();
          onSelectionChange?.(false);
        }
        canvas.remove(obj);
        canvas.requestRenderAll();
        onDirty?.();
        emitItemsRef.current();
      },
      snapshot: () => {
        const canvas = canvasRef.current;
        if (!canvas) return {};
        canvas.discardActiveObject();
        onSelectionChange?.(false);
        return serializeCanvasJSON(canvas);
      },
      restore: async (snapshot) => {
        if (!canvasRef.current) return;
        // Snapshot luon co it nhat 1 mon; loadCanvasJSON se nap lai dung vi tri, lop, lat ngang.
        loadingRef.current++;
        try {
          const canvas = canvasRef.current;
          await loadCanvasJSON(canvas, snapshot, [], anchorsRef.current);
          await setMannequin(canvas, profileRef.current, showRef.current);
          onSelectionChange?.(false);
          onDirty?.();
          emitItemsRef.current();
        } finally {
          loadingRef.current--;
        }
      },
      // ===== END NEW =====
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
      {initializationError && <div className="absolute inset-0 grid place-items-center bg-white p-4"><ErrorState message={initializationError} onRetry={() => window.location.reload()} /></div>}
      {!ready && !initializationError && (
        <div className="absolute inset-0 grid place-items-center bg-white/60">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1F453E] border-t-transparent" />
        </div>
      )}
    </div>
  );
});
