'use client';

// ===== NEW: Body 3D =====
// Canh phoi do 3D o Studio: nguoi mau + mon do (anh PNG da tach nen) uon cong om than.
// Khong mo phong vai. Keo-tha tu tu do (HTML drag) -> raycast diem tha; keo mon trong canh
// bang pointer event (tam khoa OrbitControls). Logic dat/hut/reflow nam trong lib/placement3D.ts.
import {
  Suspense, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type RefObject,
} from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, useTexture } from '@react-three/drei';
import {
  BackSide, CylinderGeometry, FrontSide, Matrix4, PerspectiveCamera, Plane, PlaneGeometry, Raycaster,
  SRGBColorSpace, Vector2, Vector3, type Camera, type Object3D, type Scene, type Texture, type WebGLRenderer,
} from 'three';
import {
  ArrowDown, ArrowUp, FlipHorizontal, RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { computeAnchors3D, computeBodyGeometry, type Anchors3D, type BodyModelInput, type Vec3 } from '@/lib/bodyModel';
import type { BodyState } from '@/lib/bodyMetrics';
import {
  CAMERA_FOV, DEFAULT_ASPECT, FRONT_UNITS_PER_M, ITEM_DRAG_MIME,
  arrangeByCategory, dragPlaced, fromScene3DItems, insertIndex, meshLayout, moveLayer, placeNew,
  projectPoint, reflowPlaced, scalePlaced, toLegacyItems, toScene3DItems, updateAttachment3D, withAspect,
  type ItemMeshLayout, type Placed3D, type ScreenProjector,
} from '@/lib/placement3D';
import type { ItemBox } from '@/lib/outfitPlacement';
import type { SaveOutfitBody } from '@/lib/services';
import type { ClothingItem, Scene3D, Scene3DItem, Vec3Tuple } from '@/types';
import { BODY_OBJECT_NAME, Body3D } from './Body3D';
import { BodyScene, THUMB_HIDE, type OrbitLike, type SceneView } from './BodyScene';
import { useFrameThrottled } from './useFrameThrottled';

export interface Stage3DSerialized {
  items: Scene3DItem[];
  /** Ban 2D xap xi cho Outfit.items. */
  legacyItems: SaveOutfitBody['items'];
  camera: { position: Vec3Tuple; target: Vec3Tuple };
}

/** API trang Studio dung de dieu khien canh 3D (tuong tu OutfitCanvasHandle cua ban 2D). */
export interface Outfit3DStageHandle {
  /** Them mon do; drop = diem tha da raycast (null/undefined = bam them, tu dat). */
  addItem: (item: ClothingItem, drop?: Vec3 | null) => void;
  load: (scene: Scene3D, lookup: (id: string) => ClothingItem | undefined, body: BodyState) => void;
  serialize: () => Stage3DSerialized;
  exportThumbnail: (includeModel: boolean) => string;
  itemIds: () => string[];
  clear: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  removeSelected: () => void;
  flipSelected: () => void;
  autoArrange: () => void;
  resetView: () => void;
}

interface Bridge {
  gl: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  size: { width: number; height: number };
  controls: OrbitLike | null;
  invalidate: () => void;
}

/** Lay doi tuong three ben trong Canvas ra ngoai cho handler HTML (tha do, chup thumbnail). */
function SceneBridge({ bridgeRef }: { bridgeRef: RefObject<Bridge | null> }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    bridgeRef.current = { gl, camera, scene, size, controls, invalidate };
  }, [bridgeRef, gl, camera, scene, size, controls, invalidate]);
  return null;
}

function makeProjector(b: Bridge): ScreenProjector {
  b.camera.updateMatrixWorld();
  const m = new Matrix4().multiplyMatrices(b.camera.projectionMatrix, b.camera.matrixWorldInverse).elements;
  return (v) => projectPoint(v, m, b.size.width, b.size.height);
}

function rayFromClient(b: Bridge, clientX: number, clientY: number): Raycaster {
  const rect = b.gl.domElement.getBoundingClientRect();
  const ndc = new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new Raycaster();
  ray.setFromCamera(ndc, b.camera);
  return ray;
}

let uidSeq = 0;
const makeUid = () => `p${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

/* ---------------- Mon do trong canh ---------------- */

const SELECT_COLOR = '#818cf8';

/** Anh do la sRGB; loc di huong cho net khi nhin xien. */
function configureTexture(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
}

const ItemMesh = memo(function ItemMesh({
  p, layout, selected, onPointerDown, onLoaded, onRelease,
}: {
  p: Placed3D;
  layout: ItemMeshLayout;
  selected: boolean;
  onPointerDown: (uid: string, e: ThreeEvent<PointerEvent>) => void;
  onLoaded: (uid: string, aspect: number, naturalWidth: number) => void;
  onRelease: (url: string, tex: Texture) => void;
}) {
  const tex = useTexture(p.imageUrl);
  useLayoutEffect(() => configureTexture(tex), [tex]);
  useEffect(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    if (img?.width && img.height) onLoaded(p.uid, img.height / img.width, img.width);
  }, [tex, p.uid, onLoaded]);
  useEffect(() => () => onRelease(p.imageUrl, tex), [tex, p.imageUrl, onRelease]);

  const curved = layout.kind === 'curved';
  const theta = layout.thetaLength;
  const geometry = useMemo(
    () => (curved ? new CylinderGeometry(1, 1, 1, 48, 1, true, -theta / 2, theta) : new PlaneGeometry(1, 1)),
    [curved, theta]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const sx = p.flipX ? -1 : 1;
  const scale: Vec3Tuple = curved
    ? [sx * layout.radiusX, layout.height, layout.radiusZ]
    : [sx * layout.width, layout.height, 1];
  const frontZ = (curved ? layout.radiusZ : 0) + 0.004;
  const hw = layout.width / 2;
  const hh = layout.height / 2;
  const down = (e: ThreeEvent<PointerEvent>) => onPointerDown(p.uid, e);

  return (
    <group position={[layout.position.x, layout.position.y, layout.position.z]} rotation={[0, 0, p.rotation]}>
      <group scale={scale}>
        <mesh geometry={geometry} renderOrder={layout.renderOrder} onPointerDown={down}>
          <meshBasicMaterial map={tex} alphaTest={0.5} side={FrontSide} toneMapped={false} />
        </mesh>
        {/* Mat sau / mat trong: cung anh nhung toi lai - chi mang tinh minh hoa. */}
        <mesh geometry={geometry} renderOrder={layout.renderOrder} onPointerDown={down}>
          <meshBasicMaterial map={tex} alphaTest={0.5} side={BackSide} color="#5c5c5c" toneMapped={false} />
        </mesh>
      </group>
      {selected && (
        <Line
          points={[[-hw, -hh, frontZ], [hw, -hh, frontZ], [hw, hh, frontZ], [-hw, hh, frontZ], [-hw, -hh, frontZ]]}
          color={SELECT_COLOR}
          lineWidth={2}
          dashed
          dashSize={0.03}
          gapSize={0.02}
          userData={{ [THUMB_HIDE]: true }}
        />
      )}
    </group>
  );
});

/* ---------------- Canh ---------------- */

type GizmoAction = 'shrink' | 'grow' | 'rotL' | 'rotR' | 'up' | 'down' | 'flip' | 'remove';

/** Thanh cong cu cho mon dang chon: scale, xoay quanh truc nhin, lop, lat, xoa. */
const GIZMO: { action: GizmoAction; icon: typeof ZoomIn; label: string }[] = [
  { action: 'shrink', icon: ZoomOut, label: 'Thu nhỏ' },
  { action: 'grow', icon: ZoomIn, label: 'Phóng to' },
  { action: 'rotL', icon: RotateCcw, label: 'Xoay trái' },
  { action: 'rotR', icon: RotateCw, label: 'Xoay phải' },
  { action: 'up', icon: ArrowUp, label: 'Đưa lên lớp trên' },
  { action: 'down', icon: ArrowDown, label: 'Đưa xuống lớp dưới' },
  { action: 'flip', icon: FlipHorizontal, label: 'Lật ngang' },
  { action: 'remove', icon: Trash2, label: 'Xóa (Delete)' },
];

export function Outfit3DStage({
  apiRef,
  body,
  showModel,
  autoSnap,
  resolveItem,
  onSelectionChange,
  onDirty,
  onReady,
}: {
  apiRef: RefObject<Outfit3DStageHandle | null>;
  body: BodyState;
  showModel: boolean;
  autoSnap: boolean;
  /** itemId (tu du lieu HTML drag) -> mon do trong tu. */
  resolveItem: (id: string) => ClothingItem | undefined;
  onSelectionChange?: (hasSelection: boolean) => void;
  onDirty?: () => void;
  onReady?: () => void;
}) {
  const bridgeRef = useRef<Bridge | null>(null);
  const [placed, setPlaced] = useState<Placed3D[]>([]);
  const placedRef = useRef<Placed3D[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const naturalWidths = useRef<Record<string, number>>({});
  const [view, setView] = useState<SceneView | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const [dropHover, setDropHover] = useState(false);

  const autoSnapRef = useRef(autoSnap);
  const showModelRef = useRef(showModel);
  const onDirtyRef = useRef(onDirty);
  useEffect(() => {
    autoSnapRef.current = autoSnap;
    showModelRef.current = showModel;
    onDirtyRef.current = onDirty;
  }, [autoSnap, showModel, onDirty]);

  const setPlacedBoth = useCallback((next: Placed3D[]) => {
    placedRef.current = next;
    setPlaced(next);
  }, []);
  const setSelectedBoth = useCallback((next: string[]) => {
    selectedRef.current = next;
    setSelected(next);
  }, []);

  /* --- Hinh than (cap nhat toi da 1 lan / frame khi keo thanh truot) --- */
  const throttled = useFrameThrottled(body);
  const input: BodyModelInput = useMemo(
    () => ({ gender: throttled.gender, metrics: throttled.metrics, shoulderCm: throttled.shoulderCm }),
    [throttled.gender, throttled.metrics, throttled.shoulderCm]
  );
  const geo = useMemo(() => computeBodyGeometry(input), [input]);
  const anchorsRef = useRef<Anchors3D>(geo.anchors);

  // Doi so do / gioi tinh: mon dang bam neo doi cho + doi co (giu he so scale), mon tu do giu nguyen.
  useLayoutEffect(() => {
    const from = anchorsRef.current;
    const to = geo.anchors;
    if (from === to) return;
    anchorsRef.current = to;
    const list = placedRef.current;
    if (!list.some((p) => p.anchorRef)) return;
    setPlacedBoth(list.map((p) => reflowPlaced(p, from, to)));
    onDirtyRef.current?.();
  }, [geo, setPlacedBoth]);

  useEffect(() => { onSelectionChange?.(selected.length > 0); }, [selected, onSelectionChange]);

  useEffect(() => {
    onReady?.();
    // Chi bao 1 lan khi gan vao trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Thao tac --- */
  const markDirty = () => onDirtyRef.current?.();

  const addPlacement = useCallback((item: ClothingItem, drop: Vec3 | null) => {
    const pl = placeNew(item.category, DEFAULT_ASPECT, anchorsRef.current, { drop, autoSnap: autoSnapRef.current });
    const p: Placed3D = {
      uid: makeUid(),
      itemId: item._id,
      category: item.category,
      imageUrl: item.imageUrl,
      name: item.name,
      aspect: DEFAULT_ASPECT,
      box: pl.box,
      anchorRef: pl.anchorRef,
      offset: pl.offset,
      rotation: 0,
      flipX: false,
    };
    const list = [...placedRef.current];
    list.splice(insertIndex(list, item.category), 0, p);
    setPlacedBoth(list);
    setSelectedBoth([p.uid]);
    onDirtyRef.current?.();
  }, [setPlacedBoth, setSelectedBoth]);

  const raycastDrop = useCallback((clientX: number, clientY: number): Vec3 | null => {
    const b = bridgeRef.current;
    if (!b) return null;
    const ray = rayFromClient(b, clientX, clientY);
    if (showModelRef.current) {
      const bodyObj = b.scene.getObjectByName(BODY_OBJECT_NAME);
      const hit = bodyObj ? ray.intersectObject(bodyObj, true)[0] : undefined;
      if (hit) return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    }
    // Truot khoi than (hoac dang an nguoi mau): mat phang dung truoc nguoi mau.
    const plane = new Plane(new Vector3(0, 0, 1), -anchorsRef.current.bust.z);
    const p = ray.ray.intersectPlane(plane, new Vector3());
    return p ? { x: p.x, y: p.y, z: p.z } : null;
  }, []);

  const updateSelected = (fn: (p: Placed3D) => Placed3D) => {
    const sel = selectedRef.current;
    if (!sel.length) return;
    const b = bridgeRef.current;
    const proj = b ? makeProjector(b) : null;
    setPlacedBoth(placedRef.current.map((p) => {
      if (!sel.includes(p.uid)) return p;
      const next = fn(p);
      return proj ? updateAttachment3D(next, anchorsRef.current, proj) : next;
    }));
    markDirty();
  };

  const removeSelected = useCallback(() => {
    const sel = selectedRef.current;
    if (!sel.length) return;
    setPlacedBoth(placedRef.current.filter((p) => !sel.includes(p.uid)));
    setSelectedBoth([]);
    onDirtyRef.current?.();
  }, [setPlacedBoth, setSelectedBoth]);

  const moveSelectedLayer = (dir: 1 | -1) => {
    const [uid] = selectedRef.current;
    if (!uid) return;
    setPlacedBoth(moveLayer(placedRef.current, uid, dir));
    markDirty();
  };

  /* --- Keo mon trong canh --- */
  const dragRef = useRef<{
    plane: Plane;
    start: Vector3;
    uids: string[];
    boxes: Record<string, ItemBox>;
    moved: boolean;
    /** Huy cac listener window cua lan keo nay. */
    listeners: AbortController;
  } | null>(null);

  const onWindowMove = useCallback((ev: PointerEvent) => {
    const d = dragRef.current;
    const b = bridgeRef.current;
    if (!d || !b) return;
    const hit = rayFromClient(b, ev.clientX, ev.clientY).ray.intersectPlane(d.plane, new Vector3());
    if (!hit) return;
    const dx = (hit.x - d.start.x) * FRONT_UNITS_PER_M;
    const dy = -(hit.y - d.start.y) * FRONT_UNITS_PER_M;
    if (!d.moved && Math.hypot(dx, dy) < 0.3) return;
    d.moved = true;
    const proj = makeProjector(b);
    const single = d.uids.length === 1;
    setPlacedBoth(placedRef.current.map((p) => {
      const box0 = d.boxes[p.uid];
      if (!box0) return p;
      const box = { ...box0, cx: box0.cx + dx, cy: box0.cy + dy };
      // 1 mon: hut neo (Shift = dat tu do). Ca nhom: chi di chuyen, tinh neo khi tha chuot.
      return single
        ? dragPlaced(p, box, anchorsRef.current, proj, { snap: autoSnapRef.current && !ev.shiftKey })
        : { ...p, box };
    }));
    b.invalidate();
  }, [setPlacedBoth]);

  const onWindowUp = useCallback(() => {
    const d = dragRef.current;
    d?.listeners.abort();
    dragRef.current = null;
    const b = bridgeRef.current;
    if (b?.controls) b.controls.enabled = true;
    if (!d?.moved) return;
    if (d.uids.length > 1 && b) {
      const proj = makeProjector(b);
      setPlacedBoth(placedRef.current.map((p) =>
        d.uids.includes(p.uid) ? updateAttachment3D(p, anchorsRef.current, proj) : p));
    }
    onDirtyRef.current?.();
  }, [setPlacedBoth]);

  // Go canh giua chung khi dang keo.
  useEffect(() => () => dragRef.current?.listeners.abort(), []);

  const onItemPointerDown = useCallback((uid: string, e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || dragRef.current) return;
    e.stopPropagation();
    const b = bridgeRef.current;
    const multi = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey;
    let sel = selectedRef.current;
    if (multi) {
      sel = sel.includes(uid) ? sel.filter((x) => x !== uid) : [...sel, uid];
      setSelectedBoth(sel);
      if (!sel.includes(uid)) return;
    } else if (!sel.includes(uid)) {
      sel = [uid];
      setSelectedBoth(sel);
    }
    if (!b) return;
    // Mat phang keo song song man hinh, di qua diem bam.
    const normal = b.camera.getWorldDirection(new Vector3()).negate();
    const listeners = new AbortController();
    dragRef.current = {
      plane: new Plane().setFromNormalAndCoplanarPoint(normal, e.point),
      start: e.point.clone(),
      uids: sel,
      boxes: Object.fromEntries(placedRef.current.filter((p) => sel.includes(p.uid)).map((p) => [p.uid, p.box])),
      moved: false,
      listeners,
    };
    if (b.controls) b.controls.enabled = false; // khoa xoay camera khi dang keo do
    window.addEventListener('pointermove', onWindowMove, { signal: listeners.signal });
    window.addEventListener('pointerup', onWindowUp, { signal: listeners.signal });
  }, [onWindowMove, onWindowUp, setSelectedBoth]);

  /* --- Texture --- */
  const onLoaded = useCallback((uid: string, aspect: number, naturalWidth: number) => {
    naturalWidths.current[uid] = naturalWidth;
    const p = placedRef.current.find((x) => x.uid === uid);
    if (p && Math.abs(p.aspect - aspect) > 0.005) {
      setPlacedBoth(placedRef.current.map((x) => (x.uid === uid ? withAspect(x, aspect) : x)));
    }
  }, [setPlacedBoth]);

  /** Go mon cuoi cung dung anh nay -> giai phong texture va xoa khoi cache. */
  const onRelease = useCallback((url: string, tex: Texture) => {
    if (placedRef.current.some((p) => p.imageUrl === url)) return;
    tex.dispose();
    useTexture.clear(url);
  }, []);

  /* --- Ban phim + bo chon --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current.length) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected]);

  // R3F chi bao "bam truot" khi chuot di < 2px (xoay camera xong khong bi bo chon).
  const onPointerMissed = useCallback(() => setSelectedBoth([]), [setSelectedBoth]);

  /* --- API cho Studio --- */
  useImperativeHandle(apiRef, (): Outfit3DStageHandle => ({
    addItem: (item, drop = null) => addPlacement(item, drop),
    load: (scene, lookup, bodyState) => {
      const a3 = computeAnchors3D({ gender: bodyState.gender, metrics: bodyState.metrics, shoulderCm: bodyState.shoulderCm });
      const list = fromScene3DItems(scene.items, (id) => {
        const it = lookup(id);
        return it ? { category: it.category, imageUrl: it.imageUrl, name: it.name } : undefined;
      }, a3, makeUid);
      // Neo hien tai = neo cua snapshot -> khi Studio doi body sang snapshot se khong reflow nham.
      anchorsRef.current = a3;
      naturalWidths.current = {};
      setPlacedBoth(list);
      setSelectedBoth([]);
      setView(scene.camera ?? null);
      setViewKey((k) => k + 1);
    },
    serialize: () => {
      const b = bridgeRef.current;
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const pos = b?.camera.position;
      const target = b?.controls?.target;
      return {
        items: toScene3DItems(placedRef.current, anchorsRef.current),
        legacyItems: toLegacyItems(placedRef.current, anchorsRef.current.headTop.y, naturalWidths.current),
        camera: {
          position: pos ? [r3(pos.x), r3(pos.y), r3(pos.z)] : [0, 0.85, 4],
          target: target ? [r3(target.x), r3(target.y), r3(target.z)] : [0, 0.85, 0],
        },
      };
    },
    exportThumbnail: (includeModel) => {
      const b = bridgeRef.current;
      if (!b) return '';
      return renderThumbnail(b, anchorsRef.current.headTop.y, includeModel);
    },
    itemIds: () => placedRef.current.map((p) => p.itemId),
    clear: () => {
      setPlacedBoth([]);
      setSelectedBoth([]);
      onDirtyRef.current?.();
    },
    bringForward: () => moveSelectedLayer(1),
    sendBackward: () => moveSelectedLayer(-1),
    removeSelected,
    flipSelected: () => updateSelected((p) => ({ ...p, flipX: !p.flipX })),
    autoArrange: () => {
      setPlacedBoth(arrangeByCategory(placedRef.current));
      markDirty();
    },
    resetView: () => {
      setView(null);
      setViewKey((k) => k + 1);
    },
  }));

  const layouts = placed.map((p, i) => meshLayout(p, geo, i));
  const hasSelection = selected.length > 0;

  const runGizmo = (action: GizmoAction) => {
    const step = Math.PI / 36; // 5 do
    switch (action) {
      case 'shrink': return updateSelected((p) => scalePlaced(p, 1 / 1.08));
      case 'grow': return updateSelected((p) => scalePlaced(p, 1.08));
      case 'rotL': return updateSelected((p) => ({ ...p, rotation: p.rotation + step }));
      case 'rotR': return updateSelected((p) => ({ ...p, rotation: p.rotation - step }));
      case 'up': return moveSelectedLayer(1);
      case 'down': return moveSelectedLayer(-1);
      case 'flip': return updateSelected((p) => ({ ...p, flipX: !p.flipX }));
      case 'remove': return removeSelected();
    }
  };

  return (
    <div
      className="relative h-full w-full"
      data-testid="stage3d"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(ITEM_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropHover(true);
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={(e) => {
        setDropHover(false);
        const item = resolveItem(e.dataTransfer.getData(ITEM_DRAG_MIME));
        if (!item) return;
        e.preventDefault();
        // Raycast diem tha -> vung co the gan nhat (quan: eo/hong); tat tu hut -> dat tu do tai do.
        addPlacement(item, raycastDrop(e.clientX, e.clientY));
      }}
    >
      <BodyScene
        heightM={geo.heightM}
        view={view}
        viewKey={viewKey}
        onPointerMissed={onPointerMissed}
        overlay={
          <>
            {hasSelection && (
              <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 p-1 shadow-md">
                {GIZMO.map(({ action, icon: Icon, label }) => (
                  <button
                    key={action}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => runGizmo(action)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#1F453E] transition-colors hover:bg-[#E2ECC8]"
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            )}
            <p className="pointer-events-none absolute bottom-2 left-3 right-3 text-center text-[10px] text-white/60">
              Xem thử dạng ảnh ghép — mặt sau chỉ mang tính minh họa
            </p>
            {dropHover && (
              <div className="pointer-events-none absolute inset-2 rounded-2xl border-2 border-dashed border-[#E2ECC8]/80 bg-white/5" />
            )}
          </>
        }
      >
        <SceneBridge bridgeRef={bridgeRef} />
        <Body3D geo={geo} input={input} hue={throttled.hue} visible={showModel} />
        {placed.map((p, i) => (
          <Suspense key={p.uid} fallback={null}>
            <ItemMesh
              p={p}
              layout={layouts[i]}
              selected={selected.includes(p.uid)}
              onPointerDown={onItemPointerDown}
              onLoaded={onLoaded}
              onRelease={onRelease}
            />
          </Suspense>
        ))}
      </BodyScene>
    </div>
  );
}

/**
 * Chup canh o goc chinh dien ra PNG 300x350 (cung ti le thumbnail 2D). Ve dong bo roi doc
 * ngay canvas WebGL (khong can preserveDrawingBuffer). San, khung chon luon an; nguoi mau an
 * neu includeModel = false. Nen trong suot.
 */
function renderThumbnail(b: Bridge, heightM: number, includeModel: boolean): string {
  const { gl, scene, size } = b;
  const hidden: Object3D[] = [];
  scene.traverse((o) => {
    if (!o.visible) return;
    if (o.userData[THUMB_HIDE] || (!includeModel && o.name === BODY_OBJECT_NAME)) {
      o.visible = false;
      hidden.push(o);
    }
  });

  const OUT_W = 300;
  const OUT_H = 350;
  // Vung cat ti le 6:7 lon nhat nam giua khung nhin.
  const cw = Math.min(size.width, (size.height * OUT_W) / OUT_H);
  const ch = (cw * OUT_H) / OUT_W;
  const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const d = (heightM * 1.1 * size.height) / (ch * 2 * tanHalf);
  const cam = new PerspectiveCamera(CAMERA_FOV, size.width / size.height, 0.05, 60);
  cam.position.set(0, heightM / 2, d);
  cam.lookAt(0, heightM / 2, 0);
  cam.updateMatrixWorld();

  try {
    gl.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = OUT_W;
    out.height = OUT_H;
    const dpr = gl.getPixelRatio();
    out.getContext('2d')?.drawImage(
      gl.domElement,
      ((size.width - cw) / 2) * dpr, ((size.height - ch) / 2) * dpr, cw * dpr, ch * dpr,
      0, 0, OUT_W, OUT_H
    );
    return out.toDataURL('image/png');
  } finally {
    hidden.forEach((o) => { o.visible = true; });
    b.invalidate();
  }
}
// ===== END NEW =====
