/**
 * Logic dat / hut (snap) / reflow item theo mannequin - pure function, khong dung Fabric.
 *
 * Hai he toa do:
 *  - Logic 400 x 800 (cua mannequin) - dung cho anchor, offset va snapshot luu DB.
 *  - Canvas 600 x 700 px (cua Fabric) - left/top cua item luu nhu cu de outfit cu khong doi.
 * Mannequin chiem tron chieu cao canvas: canvas = logic * CANVAS_SCALE + (CANVAS_OFFSET_X, 0).
 */

import type { Category } from '@/types';
import {
  MANNEQUIN_CENTER_X, MANNEQUIN_HEIGHT, MANNEQUIN_WIDTH,
  type AnchorPointName, type MannequinAnchors, type Point,
} from './mannequin';

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 700;

export const CANVAS_SCALE = CANVAS_HEIGHT / MANNEQUIN_HEIGHT;
export const CANVAS_OFFSET_X = (CANVAS_WIDTH - MANNEQUIN_WIDTH * CANVAS_SCALE) / 2;

export const logicToCanvas = (p: Point): Point => ({
  x: p.x * CANVAS_SCALE + CANVAS_OFFSET_X,
  y: p.y * CANVAS_SCALE,
});

export const canvasToLogic = (p: Point): Point => ({
  x: (p.x - CANVAS_OFFSET_X) / CANVAS_SCALE,
  y: p.y / CANVAS_SCALE,
});

/** Khoang cach (px man hinh) de hut vao anchor. */
export const SNAP_DISTANCE_PX = 24;
/**
 * Xa hon nguong nay (px man hinh) thi item "roi" khoi anchor (anchorRef = null).
 * Giua 2 nguong: khong hut nhung van bam anchor, offset ghi lai do lech.
 */
export const DETACH_DISTANCE_PX = 72;

/* ---------------- Nhom dat do ---------------- */

export type PlacementGroup = 'top' | 'outerwear' | 'dress' | 'bottom' | 'shoes' | 'side';

/** Category thuc te -> nhom dat do. Khong co category rieng cho mu nen khong co nhom 'hat'. */
export const CATEGORY_GROUP: Record<Category, PlacementGroup> = {
  top: 'top',
  outerwear: 'outerwear',
  dress: 'dress',
  bottom: 'bottom',
  shoes: 'shoes',
  bag: 'side',
  accessory: 'side',
};

export function groupOf(category: string | undefined): PlacementGroup | null {
  return (category && CATEGORY_GROUP[category as Category]) || null;
}

/** Diem nao cua khung item (chua xoay) bam vao anchor. */
export type RefEdge = 'top' | 'bottom' | 'left';

interface GroupRule {
  /** Anchor co the bam; phan tu dau la mac dinh khi tu dat. */
  anchors: AnchorPointName[];
  ref: RefEdge;
  width: (a: MannequinAnchors) => number;
}

export const GROUP_RULES: Record<PlacementGroup, GroupRule> = {
  top: { anchors: ['neck'], ref: 'top', width: (a) => a.shoulderWidth * 1.15 },
  outerwear: { anchors: ['neck'], ref: 'top', width: (a) => a.shoulderWidth * 1.3 },
  dress: { anchors: ['neck'], ref: 'top', width: (a) => Math.max(a.shoulderWidth, a.hipWidth) * 1.15 },
  bottom: { anchors: ['waist', 'hip'], ref: 'top', width: (a) => a.hipWidth * 1.1 },
  shoes: { anchors: ['footBottom'], ref: 'bottom', width: (a) => a.feetWidth * 1.1 },
  side: { anchors: ['hipRight'], ref: 'left', width: (a) => a.hipWidth * 0.55 },
};

/* ---------------- Hinh hoc ---------------- */

/** Khung item trong he logic (tam + kich thuoc, chua tinh goc xoay). */
export interface ItemBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface Placement {
  box: ItemBox;
  anchorRef: AnchorPointName | null;
  offset: Point;
}

const ZERO: Point = { x: 0, y: 0 };
const round2 = (v: number) => Math.round(v * 100) / 100;

export function refPoint(box: ItemBox, ref: RefEdge): Point {
  switch (ref) {
    case 'top': return { x: box.cx, y: box.cy - box.height / 2 };
    case 'bottom': return { x: box.cx, y: box.cy + box.height / 2 };
    case 'left': return { x: box.cx - box.width / 2, y: box.cy };
  }
}

export function boxFromRef(p: Point, ref: RefEdge, width: number, height: number): ItemBox {
  switch (ref) {
    case 'top': return { cx: p.x, cy: p.y + height / 2, width, height };
    case 'bottom': return { cx: p.x, cy: p.y - height / 2, width, height };
    case 'left': return { cx: p.x + width / 2, cy: p.y, width, height };
  }
}

/** Kich thuoc mac dinh cho item khong map duoc nhom: ~40% chieu ngang vung mannequin. */
const UNMAPPED_WIDTH = MANNEQUIN_WIDTH * 0.4;

/**
 * Vi tri + be rong khi them item moi.
 * @param aspect ti le cao/rong cua anh goc (giu nguyen khi scale)
 */
export function autoPlace(category: string, aspect: number, anchors: MannequinAnchors): Placement {
  const group = groupOf(category);
  if (!group) {
    const width = UNMAPPED_WIDTH;
    return {
      box: { cx: MANNEQUIN_CENTER_X, cy: MANNEQUIN_HEIGHT / 2, width, height: width * aspect },
      anchorRef: null,
      offset: ZERO,
    };
  }

  const rule = GROUP_RULES[group];
  const width = rule.width(anchors);
  const anchorRef = rule.anchors[0];
  return {
    box: boxFromRef(anchors[anchorRef], rule.ref, width, width * aspect),
    anchorRef,
    offset: ZERO,
  };
}

/**
 * Tinh lai anchor cho item vua keo / scale.
 * - < snapDistance: hut han vao anchor (offset 0).
 * - < detachDistance: giu vi tri, bam anchor gan nhat voi offset.
 * - xa hon: tu do (anchorRef null).
 * Truyen snapDistance = 0 de tat hut (giu Shift / tat auto-snap) ma van theo doi anchor.
 */
export function findSnap(
  category: string,
  box: ItemBox,
  anchors: MannequinAnchors,
  snapDistance: number,
  detachDistance: number
): Placement {
  const group = groupOf(category);
  if (!group) return { box, anchorRef: null, offset: ZERO };

  const rule = GROUP_RULES[group];
  const p = refPoint(box, rule.ref);

  let best: { name: AnchorPointName; d: number } | null = null;
  for (const name of rule.anchors) {
    const a = anchors[name];
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (!best || d < best.d) best = { name, d };
  }
  if (!best) return { box, anchorRef: null, offset: ZERO };

  const a = anchors[best.name];
  if (best.d < snapDistance) {
    return { box: boxFromRef(a, rule.ref, box.width, box.height), anchorRef: best.name, offset: ZERO };
  }
  if (best.d < detachDistance) {
    return {
      box,
      anchorRef: best.name,
      offset: { x: round2(p.x - a.x), y: round2(p.y - a.y) },
    };
  }
  return { box, anchorRef: null, offset: ZERO };
}

/**
 * Doi dang nguoi: item dang bam anchor duoc dat lai theo anchor moi,
 * be rong va offset scale theo ti le be rong chuan cua nhom (giu muc user da phong to/thu nho).
 * Item tu do (anchorRef null) giu nguyen.
 */
export function reflowPlacement(
  category: string,
  box: ItemBox,
  anchorRef: string | null | undefined,
  offset: Point | undefined,
  from: MannequinAnchors,
  to: MannequinAnchors
): Placement {
  const group = groupOf(category);
  const rule = group ? GROUP_RULES[group] : null;
  if (!rule || !anchorRef || !rule.anchors.includes(anchorRef as AnchorPointName)) {
    return { box, anchorRef: null, offset: offset ?? ZERO };
  }

  const name = anchorRef as AnchorPointName;
  const oldW = rule.width(from);
  const k = oldW > 0 ? rule.width(to) / oldW : 1;
  const off = offset ?? ZERO;
  const newOffset = { x: round2(off.x * k), y: round2(off.y * k) };
  const target = { x: to[name].x + newOffset.x, y: to[name].y + newOffset.y };

  return {
    box: boxFromRef(target, rule.ref, box.width * k, box.height * k),
    anchorRef: name,
    offset: newOffset,
  };
}
