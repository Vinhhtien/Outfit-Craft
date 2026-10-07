// ===== NEW: Body 3D =====
/**
 * Mo hinh co the tham so hoa - pure function, KHONG phu thuoc React / three.js de test duoc.
 *
 * He toa do (met): y huong len, ban chan cham san y = 0, nguoi mau nhin ve +z (phia camera),
 * truc doi xung x = 0. "Left/Right" cua anchor giu quy uoc 2D: ben trai/phai THEO GOC NHIN
 * NGUOI XEM (x am = trai).
 *
 * Mo hinh thu tuc: than, tay, chan la cac "ong" gom nhieu tiet dien elip noi nhau; dau, ban tay,
 * ban chan la elipxoit. Tu the chu A. Body3D.tsx chi viec doc so lieu o day de dung mesh.
 * Khi co file .glb (MakeHuman), morphWeights() cho trong so morph tuong ung.
 */

import type { BodyGender } from '@/types';
import { BODY_SLIDER_RANGES } from '@/types';
import type { BodyMetrics } from './bodyMetrics';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BodyModelInput {
  gender: BodyGender;
  metrics: BodyMetrics;
  /** Ngang vai (cm) neu nguoi dung da nhap. */
  shoulderCm?: number;
}

/** Ban truc tiet dien than: rx sang ngang, rzF ra truoc, rzB ra sau. */
export interface TorsoRadius {
  rx: number;
  rzF: number;
  rzB: number;
}

/** 1 tiet dien cua ong: tam c, huong t (theo chieu tang chi so), ban truc ra (ngang) / rbF, rbB (truoc/sau). */
export interface Section {
  c: Vec3;
  t: Vec3;
  ra: number;
  rbF: number;
  rbB: number;
}

export interface Ellipsoid {
  c: Vec3;
  r: Vec3;
  /** Goc xoay quanh truc z (radian). */
  rotZ: number;
}

export interface Anchors3D {
  headTop: Vec3;
  neck: Vec3;
  shoulderLeft: Vec3;
  shoulderRight: Vec3;
  bust: Vec3;
  waist: Vec3;
  hip: Vec3;
  hipLeft: Vec3;
  hipRight: Vec3;
  crotch: Vec3;
  knee: Vec3;
  ankle: Vec3;
  footBottom: Vec3;
  wristLeft: Vec3;
  wristRight: Vec3;
  shoulderWidth: number;
  bustWidth: number;
  waistWidth: number;
  hipWidth: number;
  feetWidth: number;
  /** Ban kinh tiet dien than tai nguc / eo / hong. */
  radii: { bust: TorsoRadius; waist: TorsoRadius; hip: TorsoRadius };
}

export interface BodyGeometry {
  heightM: number;
  torso: Section[];
  /** [trai, phai] theo goc nhin nguoi xem. */
  legs: [Section[], Section[]];
  arms: [Section[], Section[]];
  head: Ellipsoid;
  hands: [Ellipsoid, Ellipsoid];
  feet: [Ellipsoid, Ellipsoid];
  anchors: Anchors3D;
}

/** So tiet dien / so dinh moi vong - co dinh de Body3D cap nhat vi tri dinh tai cho. */
export const TORSO_RINGS = 34;
export const TORSO_SEGMENTS = 40;
export const LEG_RINGS = 24;
export const LEG_SEGMENTS = 24;
export const ARM_RINGS = 18;
export const ARM_SEGMENTS = 18;

/* ---------------- Tien ich ---------------- */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const TWO_PI = Math.PI * 2;

/** Do "gioi tinh" de noi suy: nu 1, nam 0. Trung tinh = 0.5 (noi suy 50/50 - cach don gian nhat). */
export const genderBlend = (g: BodyGender) => (g === 'female' ? 1 : g === 'male' ? 0 : 0.5);

/** Chu vi elip (Ramanujan) - sai so < 0.01% voi ti le than nguoi. */
export function ellipsePerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/**
 * Chu vi (vong) -> 2 ban truc elip voi ti le ngang/sau `ratio`.
 * ratio = 1 -> ban kinh = chu vi / 2pi.
 */
export function ellipseSemiAxes(circumference: number, ratio: number): { a: number; b: number } {
  const unit = ellipsePerimeter(1, 1 / ratio);
  const a = circumference / unit;
  return { a, b: a / ratio };
}

/** Noi suy bac 3 don dieu (Fritsch-Carlson): muot, khong vot qua diem dieu khien. xs tang dan. */
export function monotoneInterpolator(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/* ---------------- Morph (cho file .glb) ---------------- */

export type MorphName = 'chest' | 'waist' | 'hips' | 'weight' | 'legLength';
export const MORPH_NAMES: MorphName[] = ['chest', 'waist', 'hips', 'weight', 'legLength'];

const norm = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1);

/** Khoang BMI va ti le dai chan trong / chieu cao ung voi morph 0..1. */
export const MORPH_BMI_RANGE = { min: 16, max: 40 } as const;
export const MORPH_LEG_RATIO_RANGE = { min: 0.4, max: 0.5 } as const;

/**
 * So do -> trong so morph [0, 1]: 0 = dau duoi khoang thanh truot, 1 = dau tren.
 * weight = do day tong the theo BMI, legLength = ti le dai chan trong / chieu cao.
 */
export function morphWeights(input: BodyModelInput): Record<MorphName, number> {
  const m = input.metrics;
  const r = BODY_SLIDER_RANGES;
  return {
    chest: norm(m.bustCm, r.bustCm.min, r.bustCm.max),
    waist: norm(m.waistCm, r.waistCm.min, r.waistCm.max),
    hips: norm(m.hipCm, r.hipCm.min, r.hipCm.max),
    weight: norm(m.weightKg / (m.heightCm / 100) ** 2, MORPH_BMI_RANGE.min, MORPH_BMI_RANGE.max),
    legLength: norm(m.inseamCm / m.heightCm, MORPH_LEG_RATIO_RANGE.min, MORPH_LEG_RATIO_RANGE.max),
  };
}

/** Chieu cao (met) - file .glb duoc scale deu theo truc Y bang so nay chia chieu cao goc cua mesh. */
export const bodyHeightM = (input: BodyModelInput) => input.metrics.heightCm / 100;

/* ---------------- Dung hinh ---------------- */

/** Vi tri doc theo phan cua chieu cao (tinh tu san), dua tren ti le nhan trac hoc trung binh. */
const LEVEL = {
  ankle: 0.039,
  shoulder: 0.818,
  chin: 0.87,
  /** Khoang hop le cua dinh hang (tranh hinh qua di khi dai chan trong lech nhieu voi chieu cao). */
  crotchMin: 0.42,
  crotchMax: 0.53,
} as const;

/** Vi tri trong doan hang -> vai (0 = hang, 1 = vai). */
const TORSO_SPAN = { hip: 0.144, waist: 0.417, underbust: 0.62, bust: 0.718, armpit: 0.85 } as const;

/** Ti le ngang/sau cua tiet dien (nam -> nu). */
const RATIO = {
  bust: [1.4, 1.3],
  waist: [1.35, 1.3],
  hip: [1.4, 1.3],
} as const;

const ratioOf = (k: keyof typeof RATIO, g: number) => lerp(RATIO[k][0], RATIO[k][1], g);

/** Chu vi (cm) -> ban kinh (m). */
const radiusOf = (circumferenceCm: number) => circumferenceCm / 100 / TWO_PI;

function sampleTube(
  ys: number[],
  path: (y: number) => { x: number; z: number },
  radius: (y: number) => TorsoRadius,
  dir: Vec3
): Section[] {
  return ys.map((y) => {
    const p = path(y);
    const r = radius(y);
    return { c: v3(p.x, y, p.z), t: dir, ra: r.rx, rbF: r.rzF, rbB: r.rzB };
  });
}

/** n diem tu a den b (tinh ca 2 dau). */
const range = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => lerp(a, b, n === 1 ? 0 : i / (n - 1)));

/**
 * Dung toan bo hinh hoc tu so do. Nhe (vai tram phep tinh) nen goi lai moi khi keo thanh truot.
 */
export function computeBodyGeometry(input: BodyModelInput): BodyGeometry {
  const { metrics: m } = input;
  const g = genderBlend(input.gender);
  const H = m.heightCm / 100;
  const hs = H / 1.7; // he so co theo chieu cao
  const bmiValue = m.weightKg / (m.heightCm / 100) ** 2;
  /** Do day: 1 o BMI 22, tang/giam 3% moi don vi BMI. */
  const F = clamp(1 + 0.03 * (bmiValue - 22), 0.8, 1.45);

  /* --- Muc doc --- */
  const ankleY = LEVEL.ankle * H;
  const crotchY = clamp(ankleY + m.inseamCm / 100, LEVEL.crotchMin * H, LEVEL.crotchMax * H);
  const shoulderY = LEVEL.shoulder * H;
  const chinY = LEVEL.chin * H;
  const span = shoulderY - crotchY;
  const at = (f: number) => crotchY + f * span;
  const hipY = at(TORSO_SPAN.hip);
  const waistY = at(TORSO_SPAN.waist);
  const underbustY = at(TORSO_SPAN.underbust);
  const bustY = at(TORSO_SPAN.bust);
  const armpitY = at(TORSO_SPAN.armpit);
  const neckY = shoulderY + 0.4 * (chinY - shoulderY);
  // Goi ~0.285H khi dai chan trong trung binh.
  const kneeY = ankleY + (crotchY - ankleY) * 0.57;

  /* --- Tiet dien than --- */
  const bust = ellipseSemiAxes(m.bustCm / 100, ratioOf('bust', g));
  const waist = ellipseSemiAxes(m.waistCm / 100, ratioOf('waist', g));
  const hip = ellipseSemiAxes(m.hipCm / 100, ratioOf('hip', g));
  const bustR: TorsoRadius = { rx: bust.a, rzF: bust.b * (1 + 0.14 * g), rzB: bust.b * (1 - 0.06 * g) };
  const waistR: TorsoRadius = { rx: waist.a, rzF: waist.b, rzB: waist.b };
  const hipR: TorsoRadius = { rx: hip.a, rzF: hip.b * 0.95, rzB: hip.b * 1.07 };

  const neckR = radiusOf(lerp(37, 32.5, g) * Math.sqrt(hs * F));
  // Ngang vai: dung so do neu co, khong thi uoc luong tu vong nguc + gioi tinh (cong them co delta).
  const biacromial = input.shoulderCm ? input.shoulderCm / 100 : (m.bustCm / 100) * lerp(0.42, 0.41, g);
  const shoulderHalf = Math.max((biacromial / 2) * 1.08, bust.a * 1.02);

  const torsoControls: { y: number; r: TorsoRadius }[] = [
    { y: crotchY - 0.025 * H, r: { rx: 0.015, rzF: 0.015, rzB: 0.015 } },
    { y: crotchY - 0.008 * H, r: { rx: hip.a * 0.6, rzF: hip.b * 0.62, rzB: hip.b * 0.66 } },
    { y: crotchY + 0.02 * H, r: { rx: hip.a * 0.96, rzF: hip.b * 0.9, rzB: hip.b * 1.04 } },
    { y: hipY, r: hipR },
    { y: waistY, r: waistR },
    {
      y: underbustY,
      r: { rx: lerp(waist.a, bust.a, 0.82), rzF: lerp(waist.b, bust.b, 0.75), rzB: lerp(waist.b, bust.b, 0.8) },
    },
    { y: bustY, r: bustR },
    { y: armpitY, r: { rx: bust.a * 0.99, rzF: bust.b * 0.92, rzB: bust.b * 0.95 } },
    { y: shoulderY, r: { rx: shoulderHalf * 0.97, rzF: bust.b * 0.7, rzB: bust.b * 0.8 } },
    { y: shoulderY + 0.016 * H, r: { rx: shoulderHalf * 0.6 + neckR * 0.4, rzF: bust.b * 0.5, rzB: bust.b * 0.6 } },
    { y: shoulderY + 0.03 * H, r: { rx: neckR * 1.2, rzF: neckR * 1.1, rzB: neckR * 1.2 } },
    { y: chinY - 0.01 * H, r: { rx: neckR, rzF: neckR, rzB: neckR * 1.05 } },
    { y: chinY + 0.02 * H, r: { rx: neckR * 0.95, rzF: neckR * 0.95, rzB: neckR } },
  ];
  const ty = torsoControls.map((c) => c.y);
  const trx = monotoneInterpolator(ty, torsoControls.map((c) => c.r.rx));
  const trf = monotoneInterpolator(ty, torsoControls.map((c) => c.r.rzF));
  const trb = monotoneInterpolator(ty, torsoControls.map((c) => c.r.rzB));
  const torsoRadius = (y: number): TorsoRadius => ({ rx: trx(y), rzF: trf(y), rzB: trb(y) });

  // Mat do vong: day hon quanh vai/co (doan cong ngan).
  const torsoYs = [
    ...range(ty[0], bustY, 16).slice(0, -1),
    ...range(bustY, shoulderY, 7).slice(0, -1),
    ...range(shoulderY, ty[ty.length - 1], TORSO_RINGS - 15 - 6),
  ];
  const up = v3(0, 1, 0);
  const torso = sampleTube(torsoYs, () => ({ x: 0, z: 0 }), torsoRadius, up);

  /* --- Chan --- */
  const thighR = radiusOf(m.hipCm * 0.58 * F ** 0.25);
  const kneeR = radiusOf(lerp(38, 36, g) * hs * F ** 0.6);
  const calfR = radiusOf(lerp(37.5, 35.5, g) * hs * F ** 0.7);
  const ankleR = radiusOf(lerp(23, 21, g) * hs * F ** 0.3);
  const legX = Math.max(hip.a - thighR * 0.92, thighR * 0.85);
  const ankleX = legX * 0.85 + 0.01;

  const legControls = [
    { y: ankleY, r: ankleR },
    { y: ankleY + 0.06 * H, r: ankleR * 1.2 },
    { y: kneeY - 0.09 * H, r: calfR },
    { y: kneeY, r: kneeR },
    { y: kneeY + 0.04 * H, r: kneeR * 1.08 },
    { y: crotchY - 0.1 * H, r: thighR * 0.84 },
    { y: crotchY, r: thighR },
    { y: hipY, r: thighR * 0.95 },
  ];
  const legRadius = monotoneInterpolator(legControls.map((c) => c.y), legControls.map((c) => c.r));
  const legYs = range(ankleY, hipY, LEG_RINGS);
  const leg = (side: 1 | -1): Section[] => {
    const top = v3(side * legX, hipY, 0);
    const bottom = v3(side * ankleX, ankleY, 0);
    const len = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const dir = v3((top.x - bottom.x) / len, (top.y - bottom.y) / len, 0);
    return sampleTube(
      legYs,
      (y) => ({ x: lerp(bottom.x, top.x, (y - ankleY) / (hipY - ankleY)), z: 0 }),
      (y) => {
        const r = legRadius(y);
        return { rx: r, rzF: r * 1.04, rzB: r * 1.06 };
      },
      dir
    );
  };

  /* --- Tay (tu the chu A) --- */
  const upperArmR = radiusOf(lerp(31, 27, g) * hs * F ** 0.8);
  const elbowR = radiusOf(lerp(26, 23, g) * hs * F ** 0.5);
  const forearmR = radiusOf(lerp(27, 24, g) * hs * F ** 0.6);
  const wristR = radiusOf(lerp(17, 15, g) * hs * F ** 0.3);
  const armLen = 0.332 * H;
  const jointX = shoulderHalf - upperArmR * 0.9;
  const jointY = shoulderY - 0.012 * H;
  // Mo goc tay du de co tay khong cham hong.
  const needX = hip.a + wristR + 0.03;
  const alpha = clamp(Math.asin(clamp((needX - jointX) / armLen, -1, 1)), (14 * Math.PI) / 180, (30 * Math.PI) / 180);
  const armControls = [
    { t: 0, r: upperArmR * 1.15 },
    { t: 0.15, r: upperArmR },
    { t: 0.5, r: upperArmR * 0.9 },
    { t: 0.56, r: elbowR },
    { t: 0.7, r: forearmR },
    { t: 1, r: wristR },
  ];
  const armRadius = monotoneInterpolator(armControls.map((c) => c.t), armControls.map((c) => c.r));
  const wristY = jointY - Math.cos(alpha) * armLen;
  const wristX = jointX + Math.sin(alpha) * armLen;
  const arm = (side: 1 | -1): Section[] => {
    // Thu tu tu co tay len vai -> huong t luon co thanh phan y duong (cung chieu voi than, chan).
    const dir = v3(-side * Math.sin(alpha), Math.cos(alpha), 0);
    return range(1, 0, ARM_RINGS).map((t) => {
      const r = armRadius(t);
      return {
        c: v3(side * (jointX + Math.sin(alpha) * armLen * t), jointY - Math.cos(alpha) * armLen * t, 0),
        t: dir,
        ra: r,
        rbF: r * 0.95,
        rbB: r * 0.95,
      };
    });
  };

  const hand = (side: 1 | -1): Ellipsoid => ({
    c: v3(side * (wristX + Math.sin(alpha) * 0.045 * H), wristY - Math.cos(alpha) * 0.045 * H, 0),
    r: v3(0.011 * H, 0.048 * H, 0.025 * H * Math.sqrt(F)),
    rotZ: side * alpha,
  });

  const footR = v3(0.024 * H, 0.022 * H, 0.075 * H);
  const footZ = 0.035 * H;
  const foot = (side: 1 | -1): Ellipsoid => ({ c: v3(side * ankleX, footR.y, footZ), r: footR, rotZ: 0 });

  const headK = lerp(1.03, 1, g);
  const head: Ellipsoid = {
    c: v3(0, H - 0.066 * H, 0.005 * H),
    r: v3(0.044 * H * headK, 0.066 * H, 0.056 * H * headK),
    rotZ: 0,
  };

  /* --- Diem neo --- */
  const front = (y: number) => torsoRadius(y).rzF;
  const anchors: Anchors3D = {
    headTop: v3(0, H, 0),
    neck: v3(0, neckY, front(neckY)),
    shoulderLeft: v3(-shoulderHalf, shoulderY, 0),
    shoulderRight: v3(shoulderHalf, shoulderY, 0),
    bust: v3(0, bustY, bustR.rzF),
    waist: v3(0, waistY, waistR.rzF),
    hip: v3(0, hipY, hipR.rzF),
    hipLeft: v3(-hip.a, hipY, 0),
    hipRight: v3(hip.a, hipY, 0),
    crotch: v3(0, crotchY, 0),
    knee: v3(0, kneeY, kneeR),
    ankle: v3(0, ankleY, ankleR),
    footBottom: v3(0, 0, footZ),
    wristLeft: v3(-wristX, wristY, 0),
    wristRight: v3(wristX, wristY, 0),
    shoulderWidth: shoulderHalf * 2,
    bustWidth: bust.a * 2,
    waistWidth: waist.a * 2,
    hipWidth: hip.a * 2,
    feetWidth: (ankleX + footR.x) * 2,
    radii: { bust: bustR, waist: waistR, hip: hipR },
  };

  return {
    heightM: H,
    torso,
    legs: [leg(-1), leg(1)],
    arms: [arm(-1), arm(1)],
    head,
    hands: [hand(-1), hand(1)],
    feet: [foot(-1), foot(1)],
    anchors,
  };
}

/** Nguon du lieu duy nhat cho viec dat do len nguoi 3D. */
export function computeAnchors3D(input: BodyModelInput): Anchors3D {
  return computeBodyGeometry(input).anchors;
}

/** Ban kinh than tai do cao y (noi suy giua cac tiet dien; ngoai doan than -> tiet dien dau/cuoi). */
export function torsoRadiusAt(torso: Section[], y: number): TorsoRadius {
  const first = torso[0];
  const last = torso[torso.length - 1];
  const pick = (s: Section) => ({ rx: s.ra, rzF: s.rbF, rzB: s.rbB });
  if (y <= first.c.y) return pick(first);
  if (y >= last.c.y) return pick(last);
  let i = 0;
  while (torso[i + 1].c.y < y) i++;
  const a = torso[i];
  const b = torso[i + 1];
  const t = (y - a.c.y) / (b.c.y - a.c.y);
  return { rx: lerp(a.ra, b.ra, t), rzF: lerp(a.rbF, b.rbF, t), rzB: lerp(a.rbB, b.rbB, t) };
}

/** Ban kinh lon nhat cua than trong doan [y0, y1] - de mat cong cua do khong xuyen vao than. */
export function maxTorsoRadius(torso: Section[], y0: number, y1: number): TorsoRadius {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  const out = torsoRadiusAt(torso, clamp((lo + hi) / 2, torso[0].c.y, torso[torso.length - 1].c.y));
  for (const s of torso) {
    if (s.c.y < lo || s.c.y > hi) continue;
    out.rx = Math.max(out.rx, s.ra);
    out.rzF = Math.max(out.rzF, s.rbF);
    out.rzB = Math.max(out.rzB, s.rbB);
  }
  return out;
}

/* ---------------- Luoi tam giac cho ong ---------------- */

/**
 * Chi so tam giac cho ong `rings` vong x `segments` dinh (vong khep kin, khong lap dinh o duong noi
 * nen phap tuyen muot). Thu tu dinh cho mat ngoai huong ra ngoai khi t cung chieu tang chi so vong.
 */
export function tubeIndices(rings: number, segments: number): Uint32Array {
  const out = new Uint32Array((rings - 1) * segments * 6);
  let o = 0;
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < segments; k++) {
      const a = i * segments + k;
      const b = i * segments + ((k + 1) % segments);
      const c = (i + 1) * segments + k;
      const d = (i + 1) * segments + ((k + 1) % segments);
      out[o++] = a; out[o++] = c; out[o++] = b;
      out[o++] = b; out[o++] = c; out[o++] = d;
    }
  }
  return out;
}

/**
 * Ghi vi tri dinh cua ong vao mang co san (cap nhat tai cho, khong tao geometry moi).
 * Moi vong nam trong mat phang vuong goc voi t; u = t x (0,0,1) (ngang), v = u x t (~ +z, phia truoc).
 */
export function writeTubePositions(out: Float32Array, sections: Section[], segments: number): void {
  let o = 0;
  for (const s of sections) {
    const t = s.t;
    // u = t x z
    let ux = t.y;
    let uy = -t.x;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    // v = u x t (u.z = 0)
    const vx = uy * t.z;
    const vy = -ux * t.z;
    const vz = ux * t.y - uy * t.x;
    for (let k = 0; k < segments; k++) {
      const th = (k / segments) * TWO_PI;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const rb = sn >= 0 ? s.rbF : s.rbB;
      const a = s.ra * cs;
      const b = rb * sn;
      out[o++] = s.c.x + ux * a + vx * b;
      out[o++] = s.c.y + uy * a + vy * b;
      out[o++] = s.c.z + vz * b;
    }
  }
}
// ===== END NEW =====
