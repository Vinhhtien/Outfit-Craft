// ===== NEW: Body 3D =====
/**
 * Dat do len nguoi mau 3D - pure function, tai su dung quy tac 2D trong outfitPlacement.ts.
 *
 * Y tuong: chieu cac neo 3D (computeAnchors3D) len mat phang chinh dien thanh "front2D"
 * (x = x3, y = -y3, don vi CM, y huong xuong nhu he 2D). Dung cm vi reflowPlacement lam tron
 * do lech 2 chu so (hop voi don vi logic 2D) - neu dung met se mat 1 cm moi lan doi so do. Khi do autoPlace / findSnap /
 * reflowPlacement / GROUP_RULES chay nguyen ven, chi khac don vi. Truc z (do sau) suy ra
 * tu ban kinh than + khoang ho theo lop o meshLayout().
 *
 * Nguong hut / tach (24 / 72 px) van tinh tren MAN HINH: chieu neo 3D bang ma tran
 * view-projection cua camera (projectPoint) roi do khoang cach px.
 */

import type { Scene3DItem, Vec3Tuple } from '@/types';
import type { SaveOutfitBody } from './services';
import { CATEGORY_Z_INDEX } from '@/types';
import {
  MANNEQUIN_CENTER_X, MANNEQUIN_HEIGHT, MANNEQUIN_MARGIN_Y,
  type AnchorPointName, type MannequinAnchors, type Point,
} from './mannequin';
import {
  GROUP_RULES, SNAP_DISTANCE_PX, DETACH_DISTANCE_PX,
  autoPlace, boxFromRef, groupOf, logicToCanvas, reflowPlacement, refPoint, CANVAS_SCALE,
  type ItemBox, type Placement, type PlacementGroup,
} from './outfitPlacement';
import { maxTorsoRadius, type Anchors3D, type BodyGeometry, type Vec3 } from './bodyModel';

export { SNAP_DISTANCE_PX, DETACH_DISTANCE_PX };

/** Kieu du lieu HTML drag khi keo mon do tu tu do vao canh 3D (gia tri = itemId). */
export const ITEM_DRAG_MIME = 'application/x-outfitcraft-item';

/** 1 mon do dang nam trong canh 3D. Thu tu trong mang = thu tu lop (cuoi mang = ngoai cung). */
export interface Placed3D {
  uid: string;
  itemId: string;
  category: string;
  imageUrl: string;
  name?: string;
  /** Ti le cao/rong cua anh (cap nhat khi texture tai xong). */
  aspect: number;
  /** Khung trong he front2D (cm). */
  box: ItemBox;
  anchorRef: AnchorPointName | null;
  /** Diem tham chieu - neo, he front2D; chi co nghia khi anchorRef != null. */
  offset: Point;
  /** Xoay quanh truc nhin (radian, nguoc chieu kim dong ho nhin tu truoc). */
  rotation: number;
  flipX: boolean;
}

/** Ti le tam khi chua biet kich thuoc anh. */
export const DEFAULT_ASPECT = 1.2;

const ZERO: Point = { x: 0, y: 0 };
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/* ---------------- He toa do ---------------- */

/** So don vi front2D trong 1 met. */
export const FRONT_UNITS_PER_M = 100;
const U = FRONT_UNITS_PER_M;

const toFront = (v: Vec3): Point => ({ x: v.x * U, y: -v.y * U });

/** Neo 3D -> neo front2D cung kieu voi mannequin 2D (de dung lai GROUP_RULES...). */
export function frontAnchors(a: Anchors3D): MannequinAnchors {
  return {
    headTop: toFront(a.headTop),
    neck: toFront(a.neck),
    shoulderLeft: toFront(a.shoulderLeft),
    shoulderRight: toFront(a.shoulderRight),
    bust: toFront(a.bust),
    waist: toFront(a.waist),
    hip: toFront(a.hip),
    hipLeft: toFront(a.hipLeft),
    hipRight: toFront(a.hipRight),
    crotch: toFront(a.crotch),
    knee: toFront(a.knee),
    ankle: toFront(a.ankle),
    footBottom: toFront(a.footBottom),
    wristLeft: toFront(a.wristLeft),
    wristRight: toFront(a.wristRight),
    shoulderWidth: a.shoulderWidth * U,
    bustWidth: a.bustWidth * U,
    waistWidth: a.waistWidth * U,
    hipWidth: a.hipWidth * U,
    feetWidth: a.feetWidth * U,
  };
}

export const frontToWorld = (p: Point, z = 0): Vec3 => ({ x: p.x / U, y: -p.y / U, z });

/* ---------------- Chieu ra man hinh ---------------- */

/**
 * Chieu diem the gioi ra px man hinh (goc tren-trai). `viewProj` = projection x view,
 * ma tran 4x4 cot-truoc (dung nhu Matrix4.elements cua three.js).
 */
export function projectPoint(p: Vec3, viewProj: ArrayLike<number>, width: number, height: number) {
  const e = viewProj;
  const x = e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12];
  const y = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13];
  const w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
  const iw = w !== 0 ? 1 / w : 0;
  return { x: ((x * iw + 1) / 2) * width, y: ((1 - y * iw) / 2) * height, behind: w <= 0 };
}

export type ScreenProjector = (p: Vec3) => Point;

/**
 * Quyet dinh hut/bam theo khoang cach tren man hinh (giong findSnap ban 2D):
 * < snapPx: hut han | < detachPx: bam neo gan nhat nhung giu vi tri | xa hon: tu do.
 */
export function snapInScreen(
  category: string,
  refScreen: Point,
  anchorsScreen: Partial<Record<AnchorPointName, Point>>,
  snapPx: number,
  detachPx: number
): { anchorRef: AnchorPointName | null; snapped: boolean } {
  const group = groupOf(category);
  if (!group) return { anchorRef: null, snapped: false };
  let best: { name: AnchorPointName; d: number } | null = null;
  for (const name of GROUP_RULES[group].anchors) {
    const a = anchorsScreen[name];
    if (!a) continue;
    const d = Math.hypot(refScreen.x - a.x, refScreen.y - a.y);
    if (!best || d < best.d) best = { name, d };
  }
  if (!best || best.d >= detachPx) return { anchorRef: null, snapped: false };
  return { anchorRef: best.name, snapped: best.d < snapPx };
}

/* ---------------- Dat moi ---------------- */

/** Do khong map duoc nhom: rong bang vai, tam o nguc. */
const unmappedWidth = (a: MannequinAnchors) => a.shoulderWidth;

/** Be rong chuan cua mon do tren than nay (scale luu trong scene3D tinh theo so nay). */
export function baseWidth(category: string, a3: Anchors3D): number {
  const fa = frontAnchors(a3);
  const group = groupOf(category);
  return group ? GROUP_RULES[group].width(fa) : unmappedWidth(fa);
}

const centerBox = (c: Point, width: number, aspect: number): ItemBox => ({
  cx: c.x, cy: c.y, width, height: width * aspect,
});

/** Cac vung co the de goi y khi tha (tu tren xuong). */
const REGION_ANCHORS: AnchorPointName[] = ['neck', 'bust', 'waist', 'hip', 'knee', 'ankle', 'footBottom'];

/** Vung co the gan diem tha nhat (so theo do cao). */
export function nearestBodyRegion(point: Vec3, a3: Anchors3D): AnchorPointName {
  let best = REGION_ANCHORS[0];
  for (const name of REGION_ANCHORS) {
    if (Math.abs(a3[name].y - point.y) < Math.abs(a3[best].y - point.y)) best = name;
  }
  return best;
}

/**
 * Dat mon moi (bam tu tu do hoac tha vao canh).
 * - drop = diem tha (da raycast); null = bam them -> tu dat nhu 2D.
 * - autoSnap: bam neo dung danh muc; nhom co nhieu neo (quan: eo/hong) chon neo gan diem tha.
 * - tat autoSnap + co diem tha: dat tu do, tam mon do tai diem tha.
 */
export function placeNew(
  category: string,
  aspect: number,
  a3: Anchors3D,
  opts: { drop?: Vec3 | null; autoSnap: boolean }
): Placement {
  const fa = frontAnchors(a3);
  const group = groupOf(category);
  const drop = opts.drop ? toFront(opts.drop) : null;

  if (!group) {
    return { box: centerBox(drop ?? fa.bust, unmappedWidth(fa), aspect), anchorRef: null, offset: ZERO };
  }
  const rule = GROUP_RULES[group];
  const width = rule.width(fa);

  if (drop && !opts.autoSnap) {
    return { box: centerBox(drop, width, aspect), anchorRef: null, offset: ZERO };
  }
  if (drop && rule.anchors.length > 1) {
    const name = [...rule.anchors].sort(
      (a, b) => Math.hypot(fa[a].x - drop.x, fa[a].y - drop.y) - Math.hypot(fa[b].x - drop.x, fa[b].y - drop.y)
    )[0];
    return { box: boxFromRef(fa[name], rule.ref, width, width * aspect), anchorRef: name, offset: ZERO };
  }
  return autoPlace(category, aspect, fa);
}

/** Vi tri chen mon moi: ngay tren mon cao nhat co lop danh muc <= cua no (khong xao tron lop da sap tay). */
export function insertIndex(list: Pick<Placed3D, 'category'>[], category: string): number {
  const z = CATEGORY_Z_INDEX[category as keyof typeof CATEGORY_Z_INDEX] ?? 0;
  let index = 0;
  list.forEach((p, i) => {
    if ((CATEGORY_Z_INDEX[p.category as keyof typeof CATEGORY_Z_INDEX] ?? 0) <= z) index = i + 1;
  });
  return index;
}

/** Doi ti le anh (texture vua tai xong) nhung giu nguyen diem bam. */
export function withAspect(p: Placed3D, aspect: number): Placed3D {
  const group = groupOf(p.category);
  const height = p.box.width * aspect;
  if (!group) return { ...p, aspect, box: { ...p.box, height } };
  const ref = GROUP_RULES[group].ref;
  return { ...p, aspect, box: boxFromRef(refPoint(p.box, ref), ref, p.box.width, height) };
}

/* ---------------- Keo / hut ---------------- */

/**
 * Mon do vua duoc keo toi khung `box` (front2D). snap=false khi giu Shift / tat tu hut:
 * van theo doi neo (bam neu < 72 px) nhung khong hut.
 */
export function dragPlaced(
  p: Placed3D,
  box: ItemBox,
  a3: Anchors3D,
  project: ScreenProjector,
  opts: { snap: boolean; snapPx?: number; detachPx?: number }
): Placed3D {
  const group = groupOf(p.category);
  if (!group) return { ...p, box, anchorRef: null, offset: ZERO };

  const rule = GROUP_RULES[group];
  const fa = frontAnchors(a3);
  const ref = refPoint(box, rule.ref);
  // Diem tham chieu nam tren cung mat phang do sau voi neo de so khoang cach man hinh cong bang.
  const anchorsScreen: Partial<Record<AnchorPointName, Point>> = {};
  for (const name of rule.anchors) anchorsScreen[name] = project(a3[name]);
  const refScreen = project(frontToWorld(ref, a3[rule.anchors[0]].z));

  const d = snapInScreen(
    p.category,
    refScreen,
    anchorsScreen,
    opts.snap ? (opts.snapPx ?? SNAP_DISTANCE_PX) : 0,
    opts.detachPx ?? DETACH_DISTANCE_PX
  );
  if (!d.anchorRef) return { ...p, box, anchorRef: null, offset: ZERO };
  const a = fa[d.anchorRef];
  if (d.snapped) {
    return { ...p, box: boxFromRef(a, rule.ref, box.width, box.height), anchorRef: d.anchorRef, offset: ZERO };
  }
  return { ...p, box, anchorRef: d.anchorRef, offset: { x: round4(ref.x - a.x), y: round4(ref.y - a.y) } };
}

/** Sau khi scale / xoay / keo ca nhom: chi cap nhat neo + do lech, khong hut. */
export const updateAttachment3D = (p: Placed3D, a3: Anchors3D, project: ScreenProjector) =>
  dragPlaced(p, p.box, a3, project, { snap: false });

/** Doi so do / gioi tinh / dang: mon dang bam neo doi cho + doi co, mon tu do giu nguyen. */
export function reflowPlaced(p: Placed3D, from: Anchors3D, to: Anchors3D): Placed3D {
  if (!p.anchorRef) return p;
  const r = reflowPlacement(p.category, p.box, p.anchorRef, p.offset, frontAnchors(from), frontAnchors(to));
  return { ...p, box: r.box, anchorRef: r.anchorRef, offset: r.offset };
}

/**
 * Phong to / thu nho (giu ti le anh). Mon dang bam neo scale quanh diem bam (co ao van o co,
 * day giay van cham san); mon tu do scale quanh tam.
 */
export function scalePlaced(p: Placed3D, factor: number): Placed3D {
  const width = Math.min(Math.max(p.box.width * factor, 2), 300);
  const height = width * p.aspect;
  const group = groupOf(p.category);
  if (p.anchorRef && group) {
    const ref = GROUP_RULES[group].ref;
    return { ...p, box: boxFromRef(refPoint(p.box, ref), ref, width, height) };
  }
  return { ...p, box: { ...p.box, width, height } };
}

/* ---------------- Lop ---------------- */

/** Dua mon `uid` len (dir = 1) / xuong (dir = -1) 1 lop. */
export function moveLayer<T extends { uid: string }>(list: T[], uid: string, dir: 1 | -1): T[] {
  const i = list.findIndex((p) => p.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Tu sap lop theo danh muc (giay duoi quan, ao khoac tren ao...), on dinh voi mon cung loai. */
export function arrangeByCategory<T extends { category: string }>(list: T[]): T[] {
  const z = (c: string) => CATEGORY_Z_INDEX[c as keyof typeof CATEGORY_Z_INDEX] ?? 0;
  return list.map((p, i) => ({ p, i })).sort((a, b) => z(a.p.category) - z(b.p.category) || a.i - b.i).map((x) => x.p);
}

/* ---------------- Hinh dang mesh ---------------- */

/** Nhom do duoc uon cong om than; con lai la mat phang. */
const CURVED_GROUPS: PlacementGroup[] = ['top', 'outerwear', 'dress', 'bottom'];

export const CURVE_GAP_BASE = 0.012;
export const CURVE_GAP_STEP = 0.008;
export const MIN_THETA = (140 * Math.PI) / 180;
export const MAX_THETA = Math.PI;
/** Mon hep hon than: cho phep cung nho hon 140 do de giu dung be rong mon do. */
export const NARROW_MIN_THETA = (60 * Math.PI) / 180;
const THETA_STEP = (2 * Math.PI) / 180;

export interface ItemMeshLayout {
  kind: 'curved' | 'flat';
  /** Tam mon do (curved: tam truc mat tru). */
  position: Vec3;
  width: number;
  height: number;
  /** Ban truc elip cua mat tru (curved). */
  radiusX: number;
  radiusZ: number;
  thetaLength: number;
  renderOrder: number;
}

/**
 * Hinh dang mesh cho mon thu `rank` (thu tu lop, 0 = trong cung).
 * Curved: doan mat tru elip mo, ban kinh = ban kinh than lon nhat trong doan mon do phu
 * + khoang ho tang theo lop -> lop ngoai luon nam ngoai, khong xuyen than.
 * Cung duoc chon sao cho day cung (be rong nhin chinh dien) = be rong mon do.
 */
export function meshLayout(p: Placed3D, geo: BodyGeometry, rank: number): ItemMeshLayout {
  const { box } = p;
  const group = groupOf(p.category);
  const center: Vec3 = { x: box.cx / U, y: -box.cy / U, z: 0 };
  const w = box.width / U;
  const h = box.height / U;
  const gap = CURVE_GAP_BASE + rank * CURVE_GAP_STEP;
  const base = { width: w, height: h, renderOrder: rank + 1 };

  if (group && CURVED_GROUPS.includes(group)) {
    const r = maxTorsoRadius(geo.torso, center.y - h / 2, center.y + h / 2);
    if (group === 'bottom' || group === 'dress') {
      const hip = geo.anchors.radii.hip;
      r.rx = Math.max(r.rx, hip.rx);
      r.rzF = Math.max(r.rzF, hip.rzF);
    }
    let ax = r.rx + gap;
    const az = r.rzF + gap;
    const half = w / 2;
    let theta = 2 * Math.asin(Math.min(1, half / ax));
    theta = theta < MIN_THETA ? Math.max(theta, NARROW_MIN_THETA) : Math.min(theta, MAX_THETA);
    theta = Math.round(theta / THETA_STEP) * THETA_STEP;
    ax = Math.max(ax, half / Math.sin(theta / 2));
    return { ...base, kind: 'curved', position: center, radiusX: ax, radiusZ: az, thetaLength: theta };
  }

  let z: number;
  if (group === 'shoes') {
    const f = geo.feet[1];
    z = f.c.z + f.r.z * 0.6 + gap;
  } else if (group === 'side') {
    z = geo.anchors.radii.hip.rzF * 0.5 + gap;
  } else {
    z = geo.anchors.radii.bust.rzF + gap;
  }
  return { ...base, kind: 'flat', position: { ...center, z }, radiusX: 0, radiusZ: 0, thetaLength: 0 };
}

/* ---------------- Luu / nap ---------------- */

/** Danh sach mon trong canh -> Outfit.scene3D.items (thu tu lop = layer). */
export function toScene3DItems(list: Placed3D[], a3: Anchors3D): Scene3DItem[] {
  return list.map((p, layer) => {
    const group = groupOf(p.category);
    const ref = group ? refPoint(p.box, GROUP_RULES[group].ref) : { x: p.box.cx, y: p.box.cy };
    const anchored = Boolean(p.anchorRef && group);
    const offset: Vec3Tuple = anchored
      ? [round4(p.offset.x / U), round4(-p.offset.y / U), 0]
      : [round4(ref.x / U), round4(-ref.y / U), 0];
    return {
      itemId: p.itemId,
      anchor: anchored ? p.anchorRef : null,
      offset,
      scale: round4(p.box.width / baseWidth(p.category, a3)),
      rotation: round4(p.rotation),
      layer,
      aspect: round4(p.aspect),
      ...(p.flipX ? { flipX: true } : {}),
    };
  });
}

export interface ItemLookup {
  category: string;
  imageUrl: string;
  name?: string;
}

/**
 * Outfit.scene3D.items -> danh sach mon trong canh. Mon da bi xoa khoi tu do (lookup tra undefined)
 * bi bo qua. Neo khong hop le voi danh muc -> dat lai tu dong.
 */
export function fromScene3DItems(
  items: Scene3DItem[],
  lookup: (itemId: string) => ItemLookup | undefined,
  a3: Anchors3D,
  makeUid: () => string
): Placed3D[] {
  const fa = frontAnchors(a3);
  const out: Placed3D[] = [];
  for (const s of [...items].sort((a, b) => a.layer - b.layer)) {
    const info = lookup(s.itemId);
    if (!info) continue;
    const aspect = s.aspect && s.aspect > 0 ? s.aspect : DEFAULT_ASPECT;
    const width = Math.max(s.scale, 0.01) * baseWidth(info.category, a3);
    const height = width * aspect;
    const group = groupOf(info.category);
    const rule = group ? GROUP_RULES[group] : null;
    const anchor = s.anchor && rule?.anchors.includes(s.anchor as AnchorPointName)
      ? (s.anchor as AnchorPointName)
      : null;

    let box: ItemBox;
    let offset = ZERO;
    if (rule && anchor) {
      offset = { x: s.offset[0] * U, y: -s.offset[1] * U };
      box = boxFromRef({ x: fa[anchor].x + offset.x, y: fa[anchor].y + offset.y }, rule.ref, width, height);
    } else if (s.anchor && rule) {
      // Neo la (du lieu cu/hong) -> dat lai theo quy tac.
      box = autoPlace(info.category, aspect, fa).box;
      box = { ...box, width, height };
    } else {
      const ref = { x: s.offset[0] * U, y: -s.offset[1] * U };
      box = rule ? boxFromRef(ref, rule.ref, width, height) : centerBox(ref, width, aspect);
    }

    out.push({
      uid: makeUid(),
      itemId: s.itemId,
      category: info.category,
      imageUrl: info.imageUrl,
      name: info.name,
      aspect,
      box,
      anchorRef: anchor,
      offset,
      rotation: s.rotation ?? 0,
      flipX: Boolean(s.flipX),
    });
  }
  return out;
}

/** Be cao co the trong he logic 2D. */
const LOGIC_BODY_H = MANNEQUIN_HEIGHT - MANNEQUIN_MARGIN_Y * 2;

/**
 * Ban 2D xap xi cua canh 3D cho mang Outfit.items (truong bat buoc, dung de truy van
 * "outfit nao chua mon X", danh dau da mac...). Toa do canvas 600x700 nhu outfit 2D.
 * naturalWidths: be rong anh goc (px) theo uid de tinh scaleX; thieu thi scale = 1.
 */
export function toLegacyItems(
  list: Placed3D[],
  heightM: number,
  naturalWidths: Record<string, number> = {}
): SaveOutfitBody['items'] {
  const k = LOGIC_BODY_H / (heightM * U); // don vi logic / cm
  return list.map((p, zIndex) => {
    const c = logicToCanvas({
      x: MANNEQUIN_CENTER_X + p.box.cx * k,
      y: MANNEQUIN_MARGIN_Y + (heightM * U + p.box.cy) * k,
    });
    const natural = naturalWidths[p.uid];
    const scale = natural ? Number(((p.box.width * k * CANVAS_SCALE) / natural).toFixed(3)) : 1;
    return {
      item: p.itemId,
      left: Math.round(c.x),
      top: Math.round(c.y),
      scaleX: scale,
      scaleY: scale,
      angle: Math.round((-p.rotation * 180) / Math.PI),
      zIndex,
      flipX: p.flipX,
      anchorRef: p.anchorRef,
      offset: p.anchorRef ? { x: round4(p.offset.x * k), y: round4(p.offset.y * k) } : ZERO,
    };
  });
}

/* ---------------- Camera ---------------- */

export const CAMERA_FOV = 30;

/**
 * Goc nhin chinh dien thay tron nguoi (co le 12%).
 * aspect = rong / cao cua khung nhin.
 */
export function frontCamera(heightM: number, aspect: number, fovDeg = CAMERA_FOV) {
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const halfH = heightM * 0.56;
  const halfW = heightM * 0.3;
  const d = Math.max(halfH / tanHalf, halfW / (tanHalf * Math.max(aspect, 0.1)));
  const target: Vec3Tuple = [0, heightM * 0.5, 0];
  return { position: [0, heightM * 0.5, d] as Vec3Tuple, target, distance: d };
}
// ===== END NEW =====
