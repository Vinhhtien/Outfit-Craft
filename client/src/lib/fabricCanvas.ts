/**
 * Lop tien ich boc Fabric.js v6.
 * Fabric v6 dung API bat dong bo (FabricImage.fromURL tra ve Promise)
 * va da bo `fabric.Image.fromURL(url, callback)` cua v5.
 */

import type { Canvas, FabricObject, FabricImage } from 'fabric';
import type { ClothingItem } from '@/types';
import { CATEGORY_Z_INDEX } from '@/types';

/** Custom props gan them vao object de biet no ung voi item nao trong DB. */
export interface ItemObjectData {
  itemId: string;
  category: string;
}

/** Object Fabric co mang du lieu item cua ta. */
export type ItemObject = FabricObject & { itemData?: ItemObjectData };

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 700;

/** Nhung props tu dinh nghia can duoc giu lai khi toJSON(). */
export const CUSTOM_PROPS = ['itemData'];

/**
 * Them 1 mon do len canvas.
 * Anh duoc scale vua khung va dat z-index theo danh muc
 * (quan nam duoi, ao nam tren, phu kien tren cung).
 */
export async function addItemToCanvas(
  canvas: Canvas,
  item: ClothingItem,
  position?: { left: number; top: number }
): Promise<ItemObject> {
  const { FabricImage } = await import('fabric');

  const img = (await FabricImage.fromURL(item.imageUrl, {
    crossOrigin: 'anonymous',
  })) as FabricImage & { itemData?: ItemObjectData };

  // Scale sao cho mon do chiem toi da ~40% chieu rong canvas.
  const maxW = CANVAS_WIDTH * 0.4;
  const maxH = CANVAS_HEIGHT * 0.4;
  const scale = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1), 1);

  img.set({
    left: position?.left ?? CANVAS_WIDTH / 2,
    top: position?.top ?? defaultTopFor(item.category),
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale,
    cornerColor: '#6366f1',
    cornerStyle: 'circle',
    cornerSize: 10,
    transparentCorners: false,
    borderColor: '#6366f1',
    padding: 4,
  });

  img.itemData = { itemId: item._id, category: item.category };

  canvas.add(img);
  applyCategoryOrder(canvas);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();

  return img;
}

/** Vi tri doc mac dinh: giay duoi cung, mu tren cung. */
function defaultTopFor(category: string): number {
  const map: Record<string, number> = {
    accessory: CANVAS_HEIGHT * 0.15,
    top: CANVAS_HEIGHT * 0.3,
    outerwear: CANVAS_HEIGHT * 0.3,
    dress: CANVAS_HEIGHT * 0.4,
    bottom: CANVAS_HEIGHT * 0.58,
    bag: CANVAS_HEIGHT * 0.5,
    shoes: CANVAS_HEIGHT * 0.85,
  };
  return map[category] ?? CANVAS_HEIGHT / 2;
}

/** Sap xep lai layer theo danh muc (ao luon nam tren quan). */
export function applyCategoryOrder(canvas: Canvas): void {
  const objects = [...canvas.getObjects()] as ItemObject[];

  objects
    .sort((a, b) => {
      const za = CATEGORY_Z_INDEX[a.itemData?.category as keyof typeof CATEGORY_Z_INDEX] ?? 0;
      const zb = CATEGORY_Z_INDEX[b.itemData?.category as keyof typeof CATEGORY_Z_INDEX] ?? 0;
      return za - zb;
    })
    .forEach((obj, index) => canvas.moveObjectTo(obj, index));

  canvas.requestRenderAll();
}

export function bringForward(canvas: Canvas, obj: FabricObject): void {
  canvas.bringObjectForward(obj);
  canvas.requestRenderAll();
}

export function sendBackward(canvas: Canvas, obj: FabricObject): void {
  canvas.sendObjectBackwards(obj);
  canvas.requestRenderAll();
}

export function removeActive(canvas: Canvas): void {
  canvas.getActiveObjects().forEach((o) => canvas.remove(o));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

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
export function serializeItems(canvas: Canvas) {
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
    }));
}

/** Xuat PNG thumbnail (thu nho 0.5x cho nhe khi luu len Cloudinary). */
export function exportThumbnail(canvas: Canvas): string {
  return canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 0.5 });
}

/** Nap lai layout da luu. */
export async function loadCanvasJSON(
  canvas: Canvas,
  json: Record<string, unknown>
): Promise<void> {
  await canvas.loadFromJSON(json);
  canvas.requestRenderAll();
}
