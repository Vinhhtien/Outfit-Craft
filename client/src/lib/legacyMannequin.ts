/**
 * Anchor cua mannequin THE HE CU (truoc khi hinh 2D phan ung theo chieu cao / dai chan trong).
 * Chi dung de nang cap outfit da luu luc do (xem upgradeLegacyLayout trong fabricCanvas.ts):
 * vi tri mon do trong canvasJSON cu tinh theo hinh cu, nen phai biet anchor cu de dat lai
 * len hinh moi. KHONG dung de ve.
 *
 * Hinh cu: co the luon cao bang khung (760 don vi logic), be rong = preset dang (phan cua
 * chieu cao) x he so gioi tinh, hoac so do that quy ra theo chieu cao. Day la ban sao nguyen
 * cong thuc anchor cua buildMannequin cu (da doi chieu voi so lieu chup tu ban cu, commit 80b1c21).
 */

import type { BodyGender, BodyShape, MannequinProfile } from '@/types';
import type { MannequinAnchors, Point } from './mannequin';

const MARGIN_Y = 20;
const CENTER_X = 200;
/** Chieu cao co the cu (moi nguoi deu cao bang khung). */
export const LEGACY_BODY_H = 760;

const Y = {
  neck: 0.152, shoulder: 0.18, bust: 0.275, waist: 0.385, hip: 0.49,
  wrist: 0.495, crotch: 0.525, knee: 0.725, ankle: 0.955,
} as const;

type Widths = { shoulder: number; bust: number; waist: number; hip: number };

const LEGACY_SHAPE_PRESETS: Record<BodyShape, Widths> = {
  rectangle: { shoulder: 0.215, bust: 0.2, waist: 0.18, hip: 0.215 },
  pear: { shoulder: 0.2, bust: 0.19, waist: 0.165, hip: 0.25 },
  apple: { shoulder: 0.205, bust: 0.215, waist: 0.225, hip: 0.205 },
  hourglass: { shoulder: 0.22, bust: 0.215, waist: 0.15, hip: 0.22 },
  inverted_triangle: { shoulder: 0.255, bust: 0.225, waist: 0.18, hip: 0.195 },
};

const LEGACY_GENDER_FACTORS: Record<BodyGender, Widths> = {
  female: { shoulder: 0.96, bust: 1.03, waist: 1, hip: 1.04 },
  male: { shoulder: 1.05, bust: 0.98, waist: 1.03, hip: 0.96 },
  neutral: { shoulder: 1, bust: 1, waist: 1, hip: 1 },
};

const LEGACY_DEFAULT_HEIGHT_CM: Record<BodyGender, number> = { female: 160, male: 172, neutral: 166 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = (v: number) => Math.round(v * 10) / 10;

function legacyWidths(profile: MannequinProfile): Widths {
  const H = LEGACY_BODY_H;
  const preset = LEGACY_SHAPE_PRESETS[profile.shape] ?? LEGACY_SHAPE_PRESETS.rectangle;
  const g = LEGACY_GENDER_FACTORS[profile.gender] ?? LEGACY_GENDER_FACTORS.neutral;
  const w: Widths = {
    shoulder: preset.shoulder * g.shoulder * H,
    bust: preset.bust * g.bust * H,
    waist: preset.waist * g.waist * H,
    hip: preset.hip * g.hip * H,
  };
  const m = profile.measurements;
  if (m) {
    const unitsPerCm = H / (m.heightCm ?? LEGACY_DEFAULT_HEIGHT_CM[profile.gender] ?? LEGACY_DEFAULT_HEIGHT_CM.neutral);
    if (m.shoulderCm) w.shoulder = m.shoulderCm * unitsPerCm;
    if (m.bustCm) w.bust = m.bustCm * 0.37 * unitsPerCm;
    if (m.waistCm) w.waist = m.waistCm * 0.37 * unitsPerCm;
    if (m.hipCm) w.hip = m.hipCm * 0.37 * unitsPerCm;
  }
  const lo = 0.08 * H;
  const hi = 0.42 * H;
  return {
    shoulder: clamp(w.shoulder, lo, hi),
    bust: clamp(w.bust, lo, hi),
    waist: clamp(w.waist, lo, hi),
    hip: clamp(w.hip, lo, hi),
  };
}

/** Anchor cua hinh cu cho dang `profile` (giong het buildMannequin cu). */
export function legacyMannequinAnchors(profile: MannequinProfile): MannequinAnchors {
  const H = LEGACY_BODY_H;
  const top = MARGIN_Y;
  const bottom = MARGIN_Y + H;
  const yAt = (f: number) => top + f * H;
  const w = legacyWidths(profile);
  const sh = r(w.shoulder / 2);
  const bu = r(w.bust / 2);
  const wa = r(w.waist / 2);
  const hi = r(w.hip / 2);

  const wristW = 0.03 * H;
  const kneeW = 0.062 * H;
  const ankleW = 0.034 * H;
  const footW = 0.05 * H;
  const kneeC = Math.max(kneeW / 2 + 0.004 * H, (w.hip / 2) * 0.45);
  const ankleC = Math.max(ankleW / 2 + 0.004 * H, kneeC * 0.85, footW / 2 + 0.003 * H);
  const feet = r(ankleC + footW / 2);
  const wristC = Math.max(w.shoulder / 2, w.waist / 2, w.hip / 2) + wristW / 2 + 0.008 * H;

  const at = (dx: number, y: number): Point => ({ x: r(CENTER_X + dx), y: r(y) });
  return {
    headTop: at(0, top),
    neck: at(0, yAt(Y.neck)),
    shoulderLeft: at(-sh, yAt(Y.shoulder)),
    shoulderRight: at(sh, yAt(Y.shoulder)),
    bust: at(0, yAt(Y.bust)),
    waist: at(0, yAt(Y.waist)),
    hip: at(0, yAt(Y.hip)),
    hipLeft: at(-hi, yAt(Y.hip)),
    hipRight: at(hi, yAt(Y.hip)),
    crotch: at(0, yAt(Y.crotch)),
    knee: at(0, yAt(Y.knee)),
    ankle: at(0, yAt(Y.ankle)),
    footBottom: at(0, bottom),
    wristLeft: at(-wristC, yAt(Y.wrist)),
    wristRight: at(wristC, yAt(Y.wrist)),
    shoulderWidth: r(sh * 2),
    bustWidth: r(bu * 2),
    waistWidth: r(wa * 2),
    hipWidth: r(hi * 2),
    feetWidth: r(feet * 2),
  };
}
