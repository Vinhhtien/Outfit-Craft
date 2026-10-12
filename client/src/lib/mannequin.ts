/**
 * Sinh bong nguoi (mannequin) tu dang nguoi + so do - pure function, khong phu thuoc Fabric/DOM,
 * dung chung cho canvas Studio va preview SVG o trang Ho so.
 *
 * He toa do logic co dinh: viewBox 400 x 800, y tang tu tren xuong, truc doi xung x = 200.
 * Ban chan luon cham san y = FLOOR_Y; co the cao heightCm * UNITS_PER_CM (nguoi cao hon chiem
 * nhieu chieu doc hon). Nguoi cao nhat hop le (REFERENCE_HEIGHT_CM) vua khit khung.
 * "Left/Right" la ben trai/phai theo goc nhin nguoi xem (x nho = trai).
 */

import type { BodyMeasurementKey, BodyMeasurements, BodyShape, MannequinProfile } from '@/types';
import { BODY_MEASUREMENT_RANGES } from '@/types';
import { fillMeasurements, shapePresetMeasurements, type FullMeasurements } from './bodyPresets';

export const MANNEQUIN_WIDTH = 400;
export const MANNEQUIN_HEIGHT = 800;
export const MANNEQUIN_CENTER_X = MANNEQUIN_WIDTH / 2;
export const MANNEQUIN_MARGIN_Y = 20;
/** Mat san (day ban chan) trong he logic. */
export const FLOOR_Y = MANNEQUIN_HEIGHT - MANNEQUIN_MARGIN_Y;

/** Chieu cao (cm) vua khit khung = chieu cao lon nhat hop le, nen moi ho so deu vua khung. */
export const REFERENCE_HEIGHT_CM = BODY_MEASUREMENT_RANGES.heightCm.max;
/** Don vi logic tren 1 cm - co dinh, khong phu thuoc chieu cao. */
export const UNITS_PER_CM = (MANNEQUIN_HEIGHT - MANNEQUIN_MARGIN_Y * 2) / REFERENCE_HEIGHT_CM;

export const DEFAULT_MANNEQUIN: MannequinProfile = { gender: 'neutral', shape: 'rectangle' };

export interface Point {
  x: number;
  y: number;
}

export interface MannequinAnchors {
  headTop: Point;
  neck: Point;
  shoulderLeft: Point;
  shoulderRight: Point;
  bust: Point;
  waist: Point;
  hip: Point;
  hipLeft: Point;
  hipRight: Point;
  crotch: Point;
  knee: Point;
  ankle: Point;
  footBottom: Point;
  wristLeft: Point;
  wristRight: Point;
  shoulderWidth: number;
  bustWidth: number;
  waistWidth: number;
  hipWidth: number;
  /** Khoang cach giua 2 mep ngoai ban chan - dung de scale giay. */
  feetWidth: number;
}

/** Ten cac anchor dang diem (co x, y) - nhung gi item co the bam vao. */
export type AnchorPointName = {
  [K in keyof MannequinAnchors]: MannequinAnchors[K] extends Point ? K : never;
}[keyof MannequinAnchors];

export interface Mannequin {
  pathD: string;
  viewBox: string;
  anchors: MannequinAnchors;
  /** Chieu cao co the trong he logic (dinh dau -> day ban chan). */
  figureHeight: number;
}

/* ---------------- Ti le ---------------- */

/**
 * Vi tri doc, tinh theo phan cua chieu cao co the tu dinh dau, o ti le chan mac dinh
 * (dai chan trong = 0,45 chieu cao). Doan than (vai -> hang) va doan chan (hang -> mat ca)
 * co gian theo dai chan trong - xem levels().
 */
const Y = {
  headBottom: 0.13,
  neckTop: 0.118,
  neck: 0.152,
  shoulder: 0.18,
  armpit: 0.235,
  bust: 0.275,
  elbow: 0.375,
  waist: 0.385,
  hip: 0.49,
  wrist: 0.495,
  crotch: 0.525,
  handBottom: 0.572,
  knee: 0.725,
  ankle: 0.955,
} as const;

/** Dai chan trong / chieu cao duoc ve (ngoai khoang nay hinh se qua di). */
export const INSEAM_RATIO_RANGE = { min: 0.38, max: 0.52 } as const;
/** Ti le dai chan trong ung voi bang Y o tren. */
const BASE_INSEAM_RATIO = 0.45;
/** Hang cach san = dai chan trong + phan nay (~2,5% chieu cao, giua diem do va day hang ve). */
const LEG_CROTCH_EXTRA = 1 - Y.crotch - BASE_INSEAM_RATIO;

/**
 * Vong (chu vi) -> be rong nhin chinh dien. Coi mat cat than la ellipse rong/sau ~1.4:
 * P ~ pi * w/2 * (1 + 1/1.4)  =>  w ~ 0.37 * P.
 */
export const CIRCUMFERENCE_TO_WIDTH = 0.37;

/** Be rong than (vai/nguc/eo/hong) bi kep trong [8%, 42%] chieu cao co the. */
export const TORSO_WIDTH_RATIO = { min: 0.08, max: 0.42 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Lam tron 0.1 de pathD gon va doi xung tuyet doi. */
const r = (v: number) => Math.round(v * 10) / 10;

/**
 * Khoang so do (cm) THUC SU lam hinh thay doi o chieu cao heightCm: ngoai khoang nay
 * hinh bi kep nen slider se co doan "chet". null = so do khong bi kep (chieu cao, can nang).
 */
export function visualRange(
  key: BodyMeasurementKey | 'weightKg',
  heightCm: number
): { min: number; max: number } | null {
  switch (key) {
    case 'shoulderCm':
      return { min: TORSO_WIDTH_RATIO.min * heightCm, max: TORSO_WIDTH_RATIO.max * heightCm };
    case 'bustCm':
    case 'waistCm':
    case 'hipCm':
      return {
        min: (TORSO_WIDTH_RATIO.min * heightCm) / CIRCUMFERENCE_TO_WIDTH,
        max: (TORSO_WIDTH_RATIO.max * heightCm) / CIRCUMFERENCE_TO_WIDTH,
      };
    case 'inseamCm':
      return { min: INSEAM_RATIO_RANGE.min * heightCm, max: INSEAM_RATIO_RANGE.max * heightCm };
    default:
      return null;
  }
}

/** Day du so do (cm) se duoc ve: so do da co giu nguyen, thieu thi lay preset cua dang. */
export function resolveMeasurements(profile: MannequinProfile): FullMeasurements {
  const m = fillMeasurements(profile.gender, profile.shape, profile.measurements);
  const { min, max } = BODY_MEASUREMENT_RANGES.heightCm;
  return { ...m, heightCm: clamp(m.heightCm, min, max) };
}

/** Khoang kep cua he so do day tay / chan / co. */
export const LIMB_FACTOR_RANGE = { min: 0.8, max: 1.35 } as const;
const LIMB_FACTOR_EXPONENT = 0.75;

/**
 * Do day tay / chan / co so voi nguoi dang chu nhat cung gioi tinh, cung chieu cao:
 * (trung binh 3 vong / trung binh 3 vong cua preset chu nhat) ^ 0.75, kep [0.8, 1.35].
 * Suy tu so do vong (khong dung can nang) nen snapshot luu cung outfit van ve lai dung.
 */
export function limbFactor(m: FullMeasurements, gender: MannequinProfile['gender']): number {
  const avg = (x: { bustCm: number; waistCm: number; hipCm: number }) => (x.bustCm + x.waistCm + x.hipCm) / 3;
  const ref = avg(shapePresetMeasurements('rectangle', gender, m.heightCm));
  return clamp((avg(m) / ref) ** LIMB_FACTOR_EXPONENT, LIMB_FACTOR_RANGE.min, LIMB_FACTOR_RANGE.max);
}

interface TorsoWidths {
  shoulder: number;
  bust: number;
  waist: number;
  hip: number;
}

function torsoWidths(m: FullMeasurements, figureH: number): TorsoWidths {
  const lo = TORSO_WIDTH_RATIO.min * figureH;
  const hi = TORSO_WIDTH_RATIO.max * figureH;
  const w = (cm: number) => clamp(cm * UNITS_PER_CM, lo, hi);
  return {
    // shoulderCm la be ngang vai -> dung truc tiep; con lai la vong -> quy ra be rong.
    shoulder: w(m.shoulderCm),
    bust: w(m.bustCm * CIRCUMFERENCE_TO_WIDTH),
    waist: w(m.waistCm * CIRCUMFERENCE_TO_WIDTH),
    hip: w(m.hipCm * CIRCUMFERENCE_TO_WIDTH),
  };
}

/** Muc doc (phan chieu cao tu dinh dau) theo dai chan trong. */
function levels(m: FullMeasurements) {
  const legRatio = clamp(m.inseamCm / m.heightCm, INSEAM_RATIO_RANGE.min, INSEAM_RATIO_RANGE.max);
  const crotch = 1 - legRatio - LEG_CROTCH_EXTRA;
  // Diem trong doan than / doan chan giu nguyen vi tri tuong doi nhu o ti le mac dinh.
  const torso = (f: number) => Y.shoulder + ((f - Y.shoulder) / (Y.crotch - Y.shoulder)) * (crotch - Y.shoulder);
  const leg = (f: number) => crotch + ((f - Y.crotch) / (Y.ankle - Y.crotch)) * (Y.ankle - crotch);
  return {
    ...Y,
    armpit: torso(Y.armpit),
    bust: torso(Y.bust),
    waist: torso(Y.waist),
    hip: torso(Y.hip),
    crotch,
    knee: leg(Y.knee),
  };
}

/* ---------------- Ve path ---------------- */

/** Diem nua phai, luu bang do lech dx so voi truc giua (da lam tron). */
interface HalfPoint {
  dx: number;
  y: number;
}
interface Segment {
  c1: HalfPoint;
  c2: HalfPoint;
  to: HalfPoint;
}

const hp = (dx: number, y: number): HalfPoint => ({ dx: r(dx), y: r(y) });

const fmt = (v: number) => String(Number(v.toFixed(1)));
const xy = (p: HalfPoint, side: 1 | -1) =>
  `${fmt(MANNEQUIN_CENTER_X + side * p.dx)} ${fmt(p.y)}`;

/** Doan cong co tiep tuyen thang dung o 2 dau - du muot cho silhouette toi gian. */
function vCurve(from: HalfPoint, to: HalfPoint, k = 1 / 3): Segment {
  const dy = to.y - from.y;
  return { c1: hp(from.dx, from.y + dy * k), c2: hp(to.dx, to.y - dy * k), to };
}

function line(from: HalfPoint, to: HalfPoint): Segment {
  return { c1: from, c2: to, to };
}

function segmentsToD(segs: Segment[], side: 1 | -1): string {
  return segs.map((s) => `C ${xy(s.c1, side)} ${xy(s.c2, side)} ${xy(s.to, side)}`).join(' ');
}

/** Dao chieu chuoi doan cong: P0 -(c1,c2)-> P1 thanh P1 -(c2,c1)-> P0. */
function reverseSegments(start: HalfPoint, segs: Segment[]): Segment[] {
  const points = [start, ...segs.map((s) => s.to)];
  return segs
    .map((s, i) => ({ c1: s.c2, c2: s.c1, to: points[i] }))
    .reverse();
}

function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  const p = (x: number, y: number) => `${fmt(x)} ${fmt(y)}`;
  return [
    `M ${p(cx, cy - ry)}`,
    `C ${p(cx + rx * k, cy - ry)} ${p(cx + rx, cy - ry * k)} ${p(cx + rx, cy)}`,
    `C ${p(cx + rx, cy + ry * k)} ${p(cx + rx * k, cy + ry)} ${p(cx, cy + ry)}`,
    `C ${p(cx - rx * k, cy + ry)} ${p(cx - rx, cy + ry * k)} ${p(cx - rx, cy)}`,
    `C ${p(cx - rx, cy - ry * k)} ${p(cx - rx * k, cy - ry)} ${p(cx, cy - ry)}`,
    'Z',
  ].join(' ');
}

/**
 * Tao mannequin tu dang nguoi + so do.
 * Thieu profile / thieu so do nao -> dien tu preset cua dang + gioi tinh (bodyPresets.ts).
 */
export function buildMannequin(profile: MannequinProfile = DEFAULT_MANNEQUIN): Mannequin {
  const m = resolveMeasurements(profile);
  const H = m.heightCm * UNITS_PER_CM;
  const bottom = FLOOR_Y;
  const top = bottom - H;
  const yAt = (f: number) => top + f * H;
  const Y = levels(m);

  const w = torsoWidths(m, H);
  const sh = w.shoulder / 2;
  const bu = w.bust / 2;
  const wa = w.waist / 2;
  const hi = w.hip / 2;

  // Kich thuoc phu: co / tay / chan day theo limbFactor (co tay, co chan it hon vi la xuong);
  // dau, ban tay, ban chan khong doi.
  const F = limbFactor(m, profile.gender);
  const Fb = Math.sqrt(F);
  const headRx = r(0.046 * H);
  const headRy = r(((Y.headBottom - 0) * H) / 2);
  const neckHalf = 0.03 * H * F;
  const armTop = 0.052 * H * F;
  const elbowW = 0.04 * H * F;
  const wristW = 0.03 * H * Fb;
  const handW = 0.04 * H;
  const kneeW = 0.062 * H * F;
  const ankleW = 0.034 * H * Fb;
  const footW = 0.05 * H;
  const footRise = 0.012 * H;

  // Chan: tam goi theo be rong hong, tam co chan khep vao mot chut.
  const kneeC = Math.max(kneeW / 2 + 0.004 * H, hi * 0.45);
  const ankleC = Math.max(ankleW / 2 + 0.004 * H, kneeC * 0.85, footW / 2 + 0.003 * H);

  const yNeckTop = yAt(Y.neckTop);
  const yNeck = yAt(Y.neck);
  const yShoulder = yAt(Y.shoulder);
  const yBust = yAt(Y.bust);
  const yWaist = yAt(Y.waist);
  const yHip = yAt(Y.hip);
  const yCrotch = yAt(Y.crotch);
  const yKnee = yAt(Y.knee);
  const yAnkle = yAt(Y.ankle);

  /* --- Than + chan (nua phai, tu co xuong day, roi len hang) --- */
  const N0 = hp(neckHalf, yNeckTop);
  const N1 = hp(neckHalf * 1.08, yNeck);
  const S = hp(sh, yShoulder);
  const B = hp(bu, yBust);
  const W = hp(wa, yWaist);
  const Hp = hp(hi, yHip);
  const Ko = hp(kneeC + kneeW / 2, yKnee);
  const Ao = hp(ankleC + ankleW / 2, yAnkle);
  const Fo = hp(ankleC + footW / 2, bottom - footRise);
  const Fob = hp(ankleC + footW / 2 - 0.006 * H, bottom);
  const Fib = hp(ankleC - footW / 2 + 0.006 * H, bottom);
  const Fi = hp(ankleC - footW / 2, bottom - footRise);
  const Ai = hp(ankleC - ankleW / 2, yAnkle);
  const Ki = hp(kneeC - kneeW / 2, yKnee);
  const C = hp(0, yCrotch);

  const right: Segment[] = [
    vCurve(N0, N1),
    { c1: hp(neckHalf + (sh - neckHalf) * 0.45, yNeck + 0.004 * H), c2: hp(sh - 0.03 * H, yShoulder - 0.006 * H), to: S },
    { c1: hp(sh + 0.01 * H, yShoulder + 0.03 * H), c2: hp(bu, yBust - 0.035 * H), to: B },
    { c1: hp(bu, yBust + 0.04 * H), c2: hp(wa, yWaist - 0.04 * H), to: W },
    { c1: hp(wa, yWaist + 0.04 * H), c2: hp(hi, yHip - 0.045 * H), to: Hp },
    { c1: hp(hi, yHip + 0.08 * H), c2: hp(Ko.dx + 0.008 * H, yKnee - 0.09 * H), to: Ko },
    { c1: hp(Ko.dx + 0.006 * H, yKnee + 0.07 * H), c2: hp(Ao.dx, yAnkle - 0.07 * H), to: Ao },
    { c1: hp(Ao.dx, yAnkle + 0.015 * H), c2: hp(Fo.dx, Fo.y - 0.015 * H), to: Fo },
    { c1: hp(Fo.dx, bottom - 0.003 * H), c2: hp(Fo.dx - 0.002 * H, bottom), to: Fob },
    line(Fob, Fib),
    { c1: hp(Fi.dx + 0.002 * H, bottom), c2: hp(Fi.dx, bottom - 0.003 * H), to: Fi },
    { c1: hp(Fi.dx, Fi.y - 0.015 * H), c2: hp(Ai.dx, yAnkle + 0.015 * H), to: Ai },
    { c1: hp(Ai.dx, yAnkle - 0.07 * H), c2: hp(Ki.dx - 0.004 * H, yKnee + 0.07 * H), to: Ki },
    { c1: hp(Ki.dx, yKnee - 0.09 * H), c2: hp(0.012 * H, yCrotch), to: C },
  ];

  const bodyD = [
    `M ${xy(N0, -1)}`,
    `L ${xy(N0, 1)}`,
    segmentsToD(right, 1),
    segmentsToD(reverseSegments(N0, right), -1),
    'Z',
  ].join(' ');

  /* --- Tay buong xuoi (nua phai), hoi chech ra ngoai de khong lan vao eo/hong --- */
  const wristC = Math.max(sh, wa, hi) + wristW / 2 + 0.008 * H;
  const elbowC = Math.max(sh - armTop * 0.3, wa + elbowW / 2 + 0.004 * H);
  const yWrist = yAt(Y.wrist);
  const yElbow = yAt(Y.elbow);
  const yHand = yAt(Y.handBottom);

  const P = hp(sh - armTop * 0.85, yAt(Y.armpit));
  const T = hp(sh - armTop * 0.55, yShoulder - 0.004 * H);
  const A = hp(sh + armTop * 0.15, yShoulder + 0.02 * H);
  const Eo = hp(elbowC + elbowW / 2, yElbow);
  const Wo = hp(wristC + wristW / 2, yWrist);
  const Hb = hp(wristC, yHand);
  const Wi = hp(wristC - wristW / 2, yWrist);
  const Ei = hp(elbowC - elbowW / 2, yElbow);

  const arm: Segment[] = [
    { c1: hp(P.dx, P.y - 0.03 * H), c2: hp(T.dx - 0.01 * H, T.y), to: T },
    { c1: hp(T.dx + 0.02 * H, T.y - 0.002 * H), c2: hp(A.dx, A.y - 0.015 * H), to: A },
    vCurve(A, Eo),
    vCurve(Eo, Wo),
    { c1: hp(wristC + handW / 2, yWrist + 0.03 * H), c2: hp(wristC + handW * 0.35, yHand), to: Hb },
    { c1: hp(wristC - handW * 0.35, yHand), c2: hp(wristC - handW / 2, yWrist + 0.03 * H), to: Wi },
    vCurve(Wi, Ei),
    vCurve(Ei, P),
  ];
  // Lat guong lam dao chieu xoay -> tay trai ve nguoc thu tu de cung chieu voi than,
  // neu khong vung chong len than se bi "thung" theo luat fill nonzero.
  const armD = (side: 1 | -1) =>
    `M ${xy(P, side)} ${segmentsToD(side === 1 ? arm : reverseSegments(P, arm), side)} Z`;

  const headD = ellipseD(MANNEQUIN_CENTER_X, top + headRy, headRx, headRy);

  const at = (dx: number, y: number): Point => ({ x: r(MANNEQUIN_CENTER_X + dx), y: r(y) });

  return {
    pathD: [headD, bodyD, armD(1), armD(-1)].join(' '),
    viewBox: `0 0 ${MANNEQUIN_WIDTH} ${MANNEQUIN_HEIGHT}`,
    figureHeight: H,
    anchors: {
      headTop: at(0, top),
      neck: at(0, yNeck),
      shoulderLeft: at(-S.dx, yShoulder),
      shoulderRight: at(S.dx, yShoulder),
      bust: at(0, yBust),
      waist: at(0, yWaist),
      hip: at(0, yHip),
      hipLeft: at(-Hp.dx, yHip),
      hipRight: at(Hp.dx, yHip),
      crotch: at(0, yCrotch),
      knee: at(0, yKnee),
      ankle: at(0, yAnkle),
      footBottom: at(0, bottom),
      wristLeft: at(-wristC, yWrist),
      wristRight: at(wristC, yWrist),
      shoulderWidth: r(S.dx * 2),
      bustWidth: r(B.dx * 2),
      waistWidth: r(W.dx * 2),
      hipWidth: r(Hp.dx * 2),
      feetWidth: r(Fo.dx * 2),
    },
  };
}

/* ---------------- Phan loai dang ---------------- */

/**
 * shoulderCm la be ngang vai, con hipCm la vong hong -> khong so sanh truc tiep duoc.
 * Quy doi ngang vai ra "vong tuong duong" de ap dung quy tac "vai > hong them 5%".
 * He so hieu chinh sao cho vai trung binh (~38 cm) voi hong ~90 cm khong bi tinh la vai rong,
 * con vai tu ~42 cm tro len (cung hong 90) thi co.
 */
export const SHOULDER_BREADTH_TO_CIRCUMFERENCE = 2.3;

/**
 * Doan dang tu so do (cm). Can it nhat bust, waist, hip; thieu -> null.
 * Thu tu quy tac: hourglass -> pear -> inverted_triangle -> apple -> rectangle.
 */
export function classifyShape(m?: BodyMeasurements | null): BodyShape | null {
  if (!m) return null;
  const { bustCm: bust, waistCm: waist, hipCm: hip, shoulderCm } = m;
  if (!bust || !waist || !hip) return null;

  if (Math.abs(bust - hip) <= 0.05 * Math.max(bust, hip) && waist <= 0.75 * Math.min(bust, hip)) {
    return 'hourglass';
  }
  if (hip > bust * 1.05) return 'pear';

  const shoulder = shoulderCm ? shoulderCm * SHOULDER_BREADTH_TO_CIRCUMFERENCE : 0;
  if (Math.max(bust, shoulder) > hip * 1.05) return 'inverted_triangle';

  if (waist >= 0.9 * bust) return 'apple';
  return 'rectangle';
}

/** Dang dung de ve: profile cua user neu co, khong thi mac dinh rectangle/neutral. */
export function resolveMannequinProfile(profile?: Partial<MannequinProfile> | null): MannequinProfile {
  return {
    gender: profile?.gender ?? DEFAULT_MANNEQUIN.gender,
    shape: profile?.shape ?? DEFAULT_MANNEQUIN.shape,
    ...(profile?.measurements && Object.keys(profile.measurements).length
      ? { measurements: profile.measurements }
      : {}),
  };
}
