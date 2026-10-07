'use client';

// ===== NEW: Body 3D =====
// Khung canh 3D dung chung cho trang Ho so va Studio: anh sang mem, bong do duoi chan,
// OrbitControls gioi han (khong lat xuong duoi san, zoom trong khoang hop ly) va nut
// "Ve goc nhin chinh dien". frameloop="demand": chi ve lai khi co thay doi.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Vector3 } from 'three';
import { Scan } from 'lucide-react';
import { CAMERA_FOV, frontCamera } from '@/lib/placement3D';
import type { Vec3Tuple } from '@/types';

export interface SceneView {
  position: Vec3Tuple;
  target: Vec3Tuple;
}

/** Phan cua OrbitControls ma ta dung (tranh phu thuoc kieu cua three-stdlib). */
export interface OrbitLike {
  target: Vector3;
  enabled: boolean;
  update: () => void;
}

/** Danh dau object bi an khi chup thumbnail (san, khung chon...). */
export const THUMB_HIDE = 'thumbHide';

/** Dat camera: goc chinh dien (view null) hoac goc da luu; chay lai moi khi viewKey doi. */
function CameraRig({ heightM, view, viewKey }: { heightM: number; view: SceneView | null; viewKey: string }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const invalidate = useThree((s) => s.invalidate);
  const heightRef = useRef(heightM);
  useEffect(() => { heightRef.current = heightM; }, [heightM]);

  useEffect(() => {
    if (!controls) return;
    const v = view ?? frontCamera(heightRef.current, size.width / Math.max(size.height, 1));
    camera.position.set(...v.position);
    controls.target.set(...v.target);
    controls.update();
    invalidate();
    // Chi dat lai khi bam nut / nap outfit, khong giat camera moi lan doi kich thuoc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, viewKey]);
  return null;
}

/**
 * FPS thap (do khi dang ve lien tuc, vd luc xoay) -> tat bong do.
 * Bo qua quang nghi dai giua cac frame vi frameloop="demand".
 */
function FpsWatcher({ onLow }: { onLow: () => void }) {
  const acc = useRef({ frames: 0, time: 0, fired: false });
  useFrame((_, delta) => {
    const a = acc.current;
    if (a.fired) return;
    if (delta > 0.25) { a.frames = 0; a.time = 0; return; }
    a.frames++;
    a.time += delta;
    if (a.frames >= 90) {
      if (a.frames / a.time < 28) { a.fired = true; onLow(); }
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

export function BodyScene({
  heightM,
  children,
  view = null,
  viewKey = 0,
  onPointerMissed,
  overlay,
  className = '',
}: {
  heightM: number;
  children: ReactNode;
  /** Goc nhin muon dat khi viewKey doi (null = chinh dien). */
  view?: SceneView | null;
  viewKey?: number;
  onPointerMissed?: (e: MouseEvent) => void;
  /** Lop HTML phu len canh (thanh cong cu, ghi chu...). */
  overlay?: ReactNode;
  className?: string;
}) {
  const [lowPerf, setLowPerf] = useState(false);
  // Nut "Ve goc nhin chinh dien": bo goc da luu cho toi khi viewKey (nap outfit) doi.
  const [reset, setReset] = useState({ forKey: viewKey, count: 0 });
  const front = reset.forKey === viewKey && reset.count > 0;
  const rigKey = `${viewKey}-${reset.forKey === viewKey ? reset.count : 0}`;

  const clampTarget = (c: OrbitLike | undefined) => {
    if (!c) return;
    const t = c.target;
    const x = Math.min(0.6, Math.max(-0.6, t.x));
    const y = Math.min(heightM, Math.max(0.1, t.y));
    const z = Math.min(0.6, Math.max(-0.6, t.z));
    if (x !== t.x || y !== t.y || z !== t.z) t.set(x, y, z);
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_35%,#3a4049_0%,#22262c_60%,#191c20_100%)] ${className}`}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: CAMERA_FOV, near: 0.05, far: 60, position: [0, heightM / 2, 4] }}
        onPointerMissed={onPointerMissed}
      >
        <hemisphereLight args={['#ffffff', '#3b4048', 1.5]} />
        <directionalLight
          position={[1.6, 4, 3]}
          intensity={2.1}
          castShadow={!lowPerf}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-radius={6}
          shadow-camera-left={-1.2}
          shadow-camera-right={1.2}
          shadow-camera-top={2.6}
          shadow-camera-bottom={-0.6}
          shadow-camera-near={0.5}
          shadow-camera-far={10}
        />
        <directionalLight position={[-2.5, 2.5, -2]} intensity={0.7} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ [THUMB_HIDE]: true }}>
          <circleGeometry args={[1.6, 48]} />
          <shadowMaterial opacity={0.32} transparent />
        </mesh>
        <OrbitControls
          makeDefault
          enableDamping={false}
          minDistance={0.9}
          maxDistance={7}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.03}
          screenSpacePanning
          onChange={(e) => clampTarget(e?.target as OrbitLike | undefined)}
        />
        <CameraRig heightM={heightM} view={front ? null : view} viewKey={rigKey} />
        <FpsWatcher onLow={() => setLowPerf(true)} />
        {children}
      </Canvas>

      <button
        type="button"
        onClick={() => setReset((r) => ({ forKey: viewKey, count: (r.forKey === viewKey ? r.count : 0) + 1 }))}
        title="Về góc nhìn chính diện"
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#1F453E] shadow-sm transition-colors hover:bg-white"
      >
        <Scan size={13} /> Về góc nhìn chính diện
      </button>
      {overlay}
    </div>
  );
}
// ===== END NEW =====
