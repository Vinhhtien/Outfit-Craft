/**
 * Logic dat / hut (snap) / reflow item theo mannequin - pure function, khong dung Fabric.
 *
 * Hai he toa do:
 *  - Logic 400 x 800 (cua mannequin) - dung cho anchor, offset va snapshot luu DB.
 *  - Canvas 600 x 700 px (cua Fabric) - left/top cua item luu nhu cu de outfit cu khong doi.
 * Mannequin chiem tron chieu cao canvas: canvas = logic * CANVAS_SCALE + (CANVAS_OFFSET_X, 0).
 */

import type { Category, ItemFit } from '@/types';
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
  set: 'dress',
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

/** Kich thuoc chuan (logic) cua vung co the ma mon do phu - de co gian ngang / doc rieng. */
export interface BodySpan {
  w: number;
  h: number;
}

interface GroupRule {
  /** Anchor co the bam; phan tu dau la mac dinh khi tu dat. */
  anchors: AnchorPointName[];
  ref: RefEdge;
  width: (a: MannequinAnchors) => number;
  // ===== NEW: Ghi nho fit =====
  /**
   * Vung co the mon do phu: w = tong be rong cac muc mon do om (vai/nguc/eo/hong) -> doi can nang
   * (doi 3 vong, vai giu nguyen) thi do cung no / thon theo; h = doan doc mon do phu.
   */
  span: (a: MannequinAnchors) => BodySpan;
  // ===== END NEW =====
}

// ===== NEW: Ghi nho fit =====
const torsoSpan = (a: MannequinAnchors): BodySpan => ({
  w: a.shoulderWidth + a.bustWidth + a.waistWidth,
  h: a.hip.y - a.neck.y,
});
/** Tui / phu kien khong to ra khi tang can: chi theo chieu cao co the. */
const figureSpan = (a: MannequinAnchors): BodySpan => {
  const h = a.footBottom.y - a.headTop.y;
  return { w: h, h };
};
// ===== END NEW =====

export const GROUP_RULES: Record<PlacementGroup, GroupRule> = {
  top: { anchors: ['neck'], ref: 'top', width: (a) => a.shoulderWidth * 1.15, span: torsoSpan },
  outerwear: { anchors: ['neck'], ref: 'top', width: (a) => a.shoulderWidth * 1.3, span: torsoSpan },
  dress: {
    anchors: ['neck'], ref: 'top', width: (a) => Math.max(a.shoulderWidth, a.hipWidth) * 1.15,
    span: (a) => ({ w: a.shoulderWidth + a.bustWidth + a.waistWidth + a.hipWidth, h: a.knee.y - a.neck.y }),
  },
  bottom: {
    anchors: ['waist', 'hip'], ref: 'top', width: (a) => a.hipWidth * 1.1,
    span: (a) => ({ w: a.waistWidth + a.hipWidth, h: a.ankle.y - a.waist.y }),
  },
  shoes: {
    anchors: ['footBottom'], ref: 'bottom', width: (a) => a.feetWidth * 1.1,
    span: (a) => ({ w: a.feetWidth, h: a.footBottom.y - a.ankle.y }),
  },
  side: { anchors: ['hipRight'], ref: 'left', width: (a) => a.hipWidth * 0.55, span: figureSpan },
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

// ===== NEW: Ghi nho fit =====
/** Rule cua nhom do neu anchor hop le voi nhom (nguoc lai null). */
function ruleFor(category: string, anchorRef: string | null | undefined): GroupRule | null {
  const group = groupOf(category);
  const rule = group ? GROUP_RULES[group] : null;
  return rule && anchorRef && rule.anchors.includes(anchorRef as AnchorPointName) ? rule : null;
}

const ratio = (to: number, from: number) => (from > 0 ? to / from : 1);

/**
 * Doi so do (chieu cao, can nang, 3 vong...) trong khi thu do: item dang bam anchor dat lai theo
 * anchor moi va co gian NGANG / DOC rieng theo vung co the no phu (GroupRule.span) -> tang can thi
 * ao / quan no ra theo nguc-eo-hong ma khong dai ra; chieu cao doi thi dai / ngan theo.
 * Item tu do (anchorRef null) giu nguyen.
 */
export function refitPlacement(
  category: string,
  box: ItemBox,
  anchorRef: string | null | undefined,
  offset: Point | undefined,
  from: MannequinAnchors,
  to: MannequinAnchors
): Placement {
  const rule = ruleFor(category, anchorRef);
  if (!rule) return { box, anchorRef: null, offset: offset ?? ZERO };

  const name = anchorRef as AnchorPointName;
  const a = rule.span(from);
  const b = rule.span(to);
  const kx = ratio(b.w, a.w);
  const ky = ratio(b.h, a.h);
  const off = offset ?? ZERO;
  const newOffset = { x: round2(off.x * kx), y: round2(off.y * ky) };
  const target = { x: to[name].x + newOffset.x, y: to[name].y + newOffset.y };

  return {
    box: boxFromRef(target, rule.ref, box.width * kx, box.height * ky),
    anchorRef: name,
    offset: newOffset,
  };
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Vi tri + co hien tai cua item -> fit luu vao mon do (ti le theo span cua co the dang ve,
 * nen dung lai duoc cho moi so do). null = item khong bam anchor nao (dat tu do).
 */
export function fitFromBox(
  category: Category,
  box: ItemBox,
  anchorRef: string | null | undefined,
  anchors: MannequinAnchors
): ItemFit | null {
  const rule = ruleFor(category, anchorRef);
  if (!rule) return null;
  const s = rule.span(anchors);
  if (s.w <= 0 || s.h <= 0) return null;
  const a = anchors[anchorRef as AnchorPointName];
  const p = refPoint(box, rule.ref);
  return {
    category,
    anchorRef: anchorRef as AnchorPointName,
    offsetX: round4((p.x - a.x) / s.w),
    offsetY: round4((p.y - a.y) / s.h),
    width: round4(box.width / s.w),
    height: round4(box.height / s.h),
  };
}

/** Fit da luu -> vi tri tren co the dang ve. null = fit khong con hop (vd da doi danh muc). */
export function placeFromFit(fit: ItemFit, category: string, anchors: MannequinAnchors): Placement | null {
  if (fit.category !== category) return null;
  const rule = ruleFor(category, fit.anchorRef);
  if (!rule) return null;
  const s = rule.span(anchors);
  const name = fit.anchorRef as AnchorPointName;
  const offset = { x: round2(fit.offsetX * s.w), y: round2(fit.offsetY * s.h) };
  const target = { x: anchors[name].x + offset.x, y: anchors[name].y + offset.y };
  return {
    box: boxFromRef(target, rule.ref, fit.width * s.w, fit.height * s.h),
    anchorRef: name,
    offset,
  };
}
// ===== END NEW =====

/**
 * Dua 1 mon do cua outfit luu theo hinh the he cu (legacyMannequin.ts) sang hinh hien tai:
 * - mon dang bam anchor: reflowPlacement tu anchor cu sang anchor moi (bam dung vi tri tren co the);
 * - mon tu do: phong to/thu nho quanh diem giua 2 ban chan theo `factor` (= chieu cao co the
 *   moi / cu) de giu vi tri tuong doi so voi nguoi.
 */
export function upgradeLegacyPlacement(
  category: string,
  box: ItemBox,
  anchorRef: string | null | undefined,
  offset: Point | undefined,
  from: MannequinAnchors,
  to: MannequinAnchors,
  factor: number
): Placement {
  const reflowed = reflowPlacement(category, box, anchorRef, offset, from, to);
  if (reflowed.anchorRef) return reflowed;
  const o = from.footBottom;
  const n = to.footBottom;
  return {
    box: {
      cx: n.x + (box.cx - o.x) * factor,
      cy: n.y + (box.cy - o.y) * factor,
      width: box.width * factor,
      height: box.height * factor,
    },
    anchorRef: null,
    offset: ZERO,
  };
}
