/**
 * Dung lai outfit CU phoi o che do 3D (da bo) tren canvas 2D - pure function.
 *
 * Outfit 3D luu canvasJSON rong + scene3D.items: { anchor, offset (met, y huong len),
 * scale (be rong / be rong chuan cua nhom do tren co the), rotation (radian, nguoc chieu kim
 * dong ho), layer, aspect, flipX }. Quy doi sang he logic 2D:
 *  - mon bam anchor: diem bam = anchor 2D + offset (met -> don vi logic), be rong = scale x be
 *    rong chuan cua nhom tren hinh 2D -> mon do nam dung vung co the, dung ti le voi nguoi;
 *  - mon tu do: offset la vi tri tuyet doi tinh tu diem giua 2 ban chan;
 *  - goc Fabric (do, cung chieu kim dong ho) = -rotation.
 */

import type { LegacyScene3D, LegacyScene3DItem } from '@/types';
import { UNITS_PER_CM, type AnchorPointName, type MannequinAnchors, type Point } from './mannequin';
import { GROUP_RULES, boxFromRef, groupOf, type ItemBox, type Placement } from './outfitPlacement';

/** Don vi logic tren 1 met. */
const UNITS_PER_M = UNITS_PER_CM * 100;
/** Ti le cao/rong tam khi scene3D khong luu aspect (giong ban 3D). */
const DEFAULT_ASPECT = 1.2;

const ZERO: Point = { x: 0, y: 0 };
const round2 = (v: number) => Math.round(v * 100) / 100;

export interface LegacyScenePlacement extends Placement {
  itemId: string;
  /** Goc xoay Fabric (do, cung chieu kim dong ho). */
  angle: number;
  flipX: boolean;
}

/** Be rong chuan cua mon do tren hinh 2D (scale trong scene3D tinh theo so nay). */
function baseWidth(category: string, a: MannequinAnchors): number {
  const group = groupOf(category);
  return group ? GROUP_RULES[group].width(a) : a.shoulderWidth;
}

function placeOne(s: LegacyScene3DItem, category: string, a: MannequinAnchors): Placement {
  const aspect = s.aspect && s.aspect > 0 ? s.aspect : DEFAULT_ASPECT;
  const width = Math.max(s.scale, 0.01) * baseWidth(category, a);
  const height = width * aspect;
  const group = groupOf(category);
  const rule = group ? GROUP_RULES[group] : null;
  const [ox = 0, oy = 0] = s.offset ?? [];
  const off = { x: ox * UNITS_PER_M, y: -oy * UNITS_PER_M };

  if (rule && s.anchor && rule.anchors.includes(s.anchor as AnchorPointName)) {
    const name = s.anchor as AnchorPointName;
    const offset = { x: round2(off.x), y: round2(off.y) };
    const ref = { x: a[name].x + offset.x, y: a[name].y + offset.y };
    return { box: boxFromRef(ref, rule.ref, width, height), anchorRef: name, offset };
  }
  if (rule && s.anchor) {
    // Anchor khong hop le voi danh muc (du lieu hong) -> bam anchor mac dinh cua nhom.
    const name = rule.anchors[0];
    return { box: boxFromRef(a[name], rule.ref, width, height), anchorRef: name, offset: ZERO };
  }
  const ref = { x: a.footBottom.x + off.x, y: a.footBottom.y + off.y };
  const box: ItemBox = rule
    ? boxFromRef(ref, rule.ref, width, height)
    : { cx: ref.x, cy: ref.y, width, height };
  return { box, anchorRef: null, offset: ZERO };
}

/**
 * scene3D.items -> vi tri tren hinh 2D, theo thu tu lop (trong -> ngoai).
 * Mon khong tim thay danh muc (da xoa khoi tu do) bi bo qua.
 */
export function scene3DToPlacements(
  scene: Pick<LegacyScene3D, 'items'>,
  categoryOf: (itemId: string) => string | undefined,
  anchors: MannequinAnchors
): LegacyScenePlacement[] {
  return [...scene.items]
    .sort((x, y) => x.layer - y.layer)
    .flatMap((s) => {
      const category = categoryOf(s.itemId);
      if (category === undefined) return [];
      const p = placeOne(s, category, anchors);
      const angle = Math.round((-(s.rotation ?? 0) * 180) / Math.PI);
      return [{ ...p, itemId: s.itemId, angle: angle === 0 ? 0 : angle, flipX: Boolean(s.flipX) }];
    });
}

/** Outfit 3D cu chua tung luu lai o 2D (canvasJSON khong co mon nao) -> dung tu scene3D. */
export function shouldBuildFromScene3D(outfit: {
  canvasJSON?: Record<string, unknown>;
  scene3D?: Pick<LegacyScene3D, 'items'> | null;
}): boolean {
  const objects = outfit.canvasJSON?.objects;
  const hasCanvas = Array.isArray(objects) && objects.length > 0;
  return !hasCanvas && Boolean(outfit.scene3D?.items?.length);
}
