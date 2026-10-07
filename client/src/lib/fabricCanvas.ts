/**
 * Lop tien ich boc Fabric.js v6.
 * Fabric v6 dung API bat dong bo (FabricImage.fromURL tra ve Promise)
 * va da bo `fabric.Image.fromURL(url, callback)` cua v5.
 */

import type { Canvas, FabricObject, FabricImage } from 'fabric';
import type { ClothingItem, MannequinProfile, OutfitItem } from '@/types';
import { CATEGORY_Z_INDEX } from '@/types';
// ===== NEW: Body Profile =====
import { buildMannequin, type MannequinAnchors, type Point } from './mannequin';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_SCALE, CANVAS_OFFSET_X,
  SNAP_DISTANCE_PX, DETACH_DISTANCE_PX,
  autoPlace, findSnap, reflowPlacement, canvasToLogic, logicToCanvas,
  type ItemBox, type Placement,
} from './outfitPlacement';
// ===== END NEW =====

/** Custom props gan them vao object de biet no ung voi item nao trong DB. */
export interface ItemObjectData {
  itemId: string;
  category: string;
  // ===== NEW: Body Profile =====
  /** Anchor cua mannequin ma item dang bam (null = tu do). */
  anchorRef?: string | null;
  /** Do lech diem tham chieu so voi anchor, don vi logic 400x800. */
  offset?: Point;
  // ===== END NEW =====
}

/** Object Fabric co mang du lieu item cua ta. */
export type ItemObject = FabricObject & { itemData?: ItemObjectData };

// ===== NEW: Body Profile =====
/** Lop bong nguoi: khong chon/keo duoc, khong vao canvasJSON. */
export type MannequinObject = FabricObject & { isMannequin?: boolean };
// ===== END NEW =====

export { CANVAS_WIDTH, CANVAS_HEIGHT };

/** Nhung props tu dinh nghia can duoc giu lai khi xuat JSON. */
export const CUSTOM_PROPS = ['itemData'];

const ITEM_CONTROLS = {
  cornerColor: '#6366f1',
  cornerStyle: 'circle' as const,
  cornerSize: 10,
  transparentCorners: false,
  borderColor: '#6366f1',
  padding: 4,
};

// ===== NEW: Body Profile =====
const ZERO: Point = { x: 0, y: 0 };

export const isMannequinObject = (o: FabricObject) => Boolean((o as MannequinObject).isMannequin);

export const getItemObjects = (canvas: Canvas) =>
  (canvas.getObjects() as ItemObject[]).filter((o) => o.itemData?.itemId);

/** Mau mannequin lay tu CSS (co ban dark mode trong globals.css). */
function mannequinFill(): string {
  if (typeof window === 'undefined') return '#e7e5e4';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--mannequin-fill').trim();
  return v || '#e7e5e4';
}

/** Ve (hoac ve lai) mannequin o lop duoi cung. */
export async function setMannequin(
  canvas: Canvas,
  profile: MannequinProfile,
  visible: boolean
): Promise<void> {
  const { Path } = await import('fabric');
  const { pathD } = buildMannequin(profile);

  const path = new Path(pathD, {
    fill: mannequinFill(),
    strokeWidth: 0,
    selectable: false,
    evented: false,
    hasControls: false,
    hoverCursor: 'default',
    excludeFromExport: true,
    visible,
  }) as MannequinObject;
  path.isMannequin = true;

  // Path dat goc tai tam bbox cua no -> quy doi bbox logic sang canvas.
  const p = path as unknown as { pathOffset: Point; width: number; height: number };
  const minX = p.pathOffset.x - p.width / 2;
  const minY = p.pathOffset.y - p.height / 2;
  path.set({
    originX: 'left',
    originY: 'top',
    left: minX * CANVAS_SCALE + CANVAS_OFFSET_X,
    top: minY * CANVAS_SCALE,
    scaleX: CANVAS_SCALE,
    scaleY: CANVAS_SCALE,
  });

  const old = canvas.getObjects().filter(isMannequinObject);
  if (old.length) canvas.remove(...old);
  canvas.insertAt(0, path);
  canvas.requestRenderAll();
}

export function setMannequinVisible(canvas: Canvas, visible: boolean): void {
  canvas.getObjects().filter(isMannequinObject).forEach((o) => o.set('visible', visible));
  canvas.requestRenderAll();
}

/** Khung item trong he logic. Dung toa do/scale tuyet doi -> dung ca khi nam trong ActiveSelection. */
export function getItemBox(obj: FabricObject): ItemBox {
  const c = canvasToLogic(obj.getCenterPoint());
  const s = obj.getObjectScaling();
  return {
    cx: c.x,
    cy: c.y,
    width: ((obj.width ?? 0) * Math.abs(s.x)) / CANVAS_SCALE,
    height: ((obj.height ?? 0) * Math.abs(s.y)) / CANVAS_SCALE,
  };
}

/** Dat item theo placement; resize=true thi scale theo box.width (giu ti le scaleY/scaleX). */
function applyPlacement(obj: ItemObject, placement: Placement, resize: boolean): void {
  const { box, anchorRef, offset } = placement;
  if (resize && obj.width) {
    const ratio = (obj.scaleY ?? 1) / (obj.scaleX ?? 1);
    const scaleX = (box.width * CANVAS_SCALE) / obj.width;
    obj.set({ scaleX, scaleY: scaleX * ratio });
  }
  const c = logicToCanvas({ x: box.cx, y: box.cy });
  obj.set({ originX: 'center', originY: 'center', left: c.x, top: c.y });
  obj.setCoords();
  if (obj.itemData) obj.itemData = { ...obj.itemData, anchorRef, offset };
}

/** Doi px man hinh -> don vi logic (canvas co the dang bi CSS scale). */
const pxToLogic = (px: number, cssScale: number) => px / (Math.max(cssScale, 0.01) * CANVAS_SCALE);

/** Goi trong 'object:moving': hut vao anchor neu du gan (snap=false khi giu Shift / tat auto-snap). */
export function snapWhileMoving(
  obj: ItemObject,
  anchors: MannequinAnchors,
  opts: { snap: boolean; cssScale: number }
): void {
  if (!obj.itemData) return;
  const box = getItemBox(obj);
  const p = findSnap(
    obj.itemData.category,
    box,
    anchors,
    opts.snap ? pxToLogic(SNAP_DISTANCE_PX, opts.cssScale) : 0,
    pxToLogic(DETACH_DISTANCE_PX, opts.cssScale)
  );
  if (p.box !== box) applyPlacement(obj, p, false);
  else obj.itemData = { ...obj.itemData, anchorRef: p.anchorRef, offset: p.offset };
}

/** Sau khi scale/xoay (hoac keo ca nhom): chi cap nhat anchorRef/offset, khong hut. */
export function updateAttachment(obj: ItemObject, anchors: MannequinAnchors, cssScale: number): void {
  if (!obj.itemData) return;
  const p = findSnap(
    obj.itemData.category,
    getItemBox(obj),
    anchors,
    0,
    pxToLogic(DETACH_DISTANCE_PX, cssScale)
  );
  obj.itemData = { ...obj.itemData, anchorRef: p.anchorRef, offset: p.offset };
}

/** Doi dang: item dang bam anchor duoc dat lai, item tu do giu nguyen. */
export function reflowItems(canvas: Canvas, from: MannequinAnchors, to: MannequinAnchors): number {
  // Object trong ActiveSelection dung toa do tuong doi voi nhom -> bo chon de tra ve toa do canvas.
  canvas.discardActiveObject();
  let moved = 0;
  for (const obj of getItemObjects(canvas)) {
    const { category, anchorRef, offset } = obj.itemData!;
    if (!anchorRef) continue;
    applyPlacement(obj, reflowPlacement(category, getItemBox(obj), anchorRef, offset, from, to), true);
    moved++;
  }
  canvas.requestRenderAll();
  return moved;
}

const zOf = (o: FabricObject) =>
  isMannequinObject(o)
    ? -Infinity
    : CATEGORY_Z_INDEX[(o as ItemObject).itemData?.category as keyof typeof CATEGORY_Z_INDEX] ?? 0;
// ===== END NEW =====

/**
 * Them 1 mon do len canvas.
 * Tu dat dung vi tri + be rong tren mannequin theo danh muc (giu ti le anh goc),
 * va chen vao dung lop theo danh muc ma khong xao tron lop user da sap tay.
 */
export async function addItemToCanvas(
  canvas: Canvas,
  item: ClothingItem,
  anchors: MannequinAnchors
): Promise<ItemObject> {
  const { FabricImage } = await import('fabric');

  const img = (await FabricImage.fromURL(item.imageUrl, {
    crossOrigin: 'anonymous',
  })) as FabricImage & { itemData?: ItemObjectData };

  img.set({ originX: 'center', originY: 'center', ...ITEM_CONTROLS });
  img.itemData = { itemId: item._id, category: item.category, anchorRef: null, offset: ZERO };

  const aspect = (img.height || 1) / (img.width || 1);
  applyPlacement(img, autoPlace(item.category, aspect, anchors), true);

  // Chen ngay tren object cao nhat co z <= z cua item moi.
  const z = zOf(img);
  const objects = canvas.getObjects();
  let index = 0;
  objects.forEach((o, i) => { if (zOf(o) <= z) index = i + 1; });
  canvas.add(img);
  canvas.moveObjectTo(img, index);

  canvas.setActiveObject(img);
  canvas.requestRenderAll();

  return img;
}

/** Sap xep lai layer theo danh muc (ao luon nam tren quan); mannequin luon o duoi cung. */
export function applyCategoryOrder(canvas: Canvas): void {
  [...canvas.getObjects()]
    .sort((a, b) => zOf(a) - zOf(b))
    .forEach((obj, index) => canvas.moveObjectTo(obj, index));

  canvas.requestRenderAll();
}

export function bringForward(canvas: Canvas, obj: FabricObject): void {
  canvas.bringObjectForward(obj);
  canvas.requestRenderAll();
}

export function sendBackward(canvas: Canvas, obj: FabricObject): void {
  // NEW: Body Profile - khong cho item chui xuong duoi mannequin.
  const below = canvas.getObjects()[canvas.getObjects().indexOf(obj) - 1];
  if (below && isMannequinObject(below)) return;
  canvas.sendObjectBackwards(obj);
  canvas.requestRenderAll();
}

export function removeActive(canvas: Canvas): void {
  canvas.getActiveObjects().forEach((o) => canvas.remove(o));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

// ===== NEW: Body Profile =====
/** Xoa toan bo mon do nhung giu mannequin. */
export function clearItems(canvas: Canvas): void {
  canvas.discardActiveObject();
  const items = canvas.getObjects().filter((o) => !isMannequinObject(o));
  if (items.length) canvas.remove(...items);
  canvas.requestRenderAll();
}
// ===== END NEW =====

export function flipActive(canvas: Canvas): void {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.set('flipX', !obj.flipX);
  canvas.requestRenderAll();
}

/**
 * Trich danh sach item + transform de luu xuong DB.
 * zIndex lay tu thu tu thuc te tren canvas.
 */
export function serializeItems(canvas: Pick<Canvas, 'getObjects'>) {
  const objects = canvas.getObjects() as ItemObject[];

  return objects
    .filter((o) => o.itemData?.itemId)
    .map((o, index) => ({
      item: o.itemData!.itemId,
      left: Math.round(o.left ?? 0),
      top: Math.round(o.top ?? 0),
      scaleX: Number((o.scaleX ?? 1).toFixed(3)),
      scaleY: Number((o.scaleY ?? 1).toFixed(3)),
      angle: Math.round(o.angle ?? 0),
      zIndex: index,
      flipX: Boolean(o.flipX),
      // ===== NEW: Body Profile =====
      anchorRef: o.itemData!.anchorRef ?? null,
      offset: o.itemData!.anchorRef ? (o.itemData!.offset ?? ZERO) : ZERO,
      // ===== END NEW =====
    }));
}

/**
 * Snapshot de mo lai chinh sua. Mannequin co excludeFromExport nen khong nam trong nay.
 * Fabric v6: canvas.toJSON() khong nhan tham so -> dung toObject() de giu itemData.
 */
export function serializeCanvasJSON(canvas: Canvas): Record<string, unknown> {
  return canvas.toObject(CUSTOM_PROPS) as Record<string, unknown>;
}

/** Xuat PNG thumbnail (thu nho 0.5x cho nhe khi luu len Cloudinary). */
export function exportThumbnail(canvas: Canvas, includeMannequin = true): string {
  const mannequins = canvas.getObjects().filter(isMannequinObject);
  const prev = mannequins.map((o) => o.visible);
  if (!includeMannequin) mannequins.forEach((o) => o.set('visible', false));
  try {
    return canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 0.5 });
  } finally {
    mannequins.forEach((o, i) => o.set('visible', prev[i]));
  }
}

// ===== NEW: Body Profile =====
/**
 * Outfit luu truoc ban nay: canvasJSON khong co itemData (toJSON() bo qua custom props).
 * Gan lai tu mang items theo thu tu zIndex (zIndex = thu tu object tren canvas luc luu).
 */
export function attachLegacyItemData(objects: FabricObject[], items: OutfitItem[]): void {
  const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
  (objects.filter((o) => !isMannequinObject(o)) as ItemObject[]).forEach((o, i) => {
    if (o.itemData?.itemId) return;
    const src = sorted[i];
    if (!src) return;
    const id = typeof src.item === 'string' ? src.item : src.item._id;
    const category = typeof src.item === 'string' ? '' : src.item.category;
    o.itemData = {
      itemId: id,
      category,
      anchorRef: src.anchorRef ?? null,
      offset: src.offset ?? ZERO,
    };
  });
}
// ===== END NEW =====

/** Nap lai layout da luu (mannequin do noi goi ve lai sau khi nap). */
export async function loadCanvasJSON(
  canvas: Canvas,
  json: Record<string, unknown>,
  items: OutfitItem[] = []
): Promise<void> {
  await canvas.loadFromJSON(json);
  attachLegacyItemData(canvas.getObjects(), items); // NEW: Body Profile
  canvas.requestRenderAll();
}
