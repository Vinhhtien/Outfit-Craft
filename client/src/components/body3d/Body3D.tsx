'use client';

// ===== NEW: Body 3D =====
// Nguoi mau 3D. Uu tien file .glb (MakeHuman, co morph target) neu co trong public/models,
// khong co / loi -> mo hinh thu tuc dung tu bodyModel.ts. Ca 2 cap nhat tai cho khi keo
// thanh truot (doi vi tri dinh / morph influence), khong tao lai geometry.
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Box3, BufferAttribute, BufferGeometry, MeshStandardMaterial, type Mesh, type Object3D,
} from 'three';
import {
  ARM_RINGS, ARM_SEGMENTS, LEG_RINGS, LEG_SEGMENTS, TORSO_RINGS, TORSO_SEGMENTS,
  MORPH_NAMES, bodyHeightM, morphWeights, tubeIndices, writeTubePositions,
  type BodyGeometry, type BodyModelInput, type Ellipsoid, type Section,
} from '@/lib/bodyModel';
import type { BodyGender } from '@/types';

/** Ten object de raycast khi tha do. */
export const BODY_OBJECT_NAME = 'body3d';

/** File .glb tuy chon. Trung tinh dung mesh nu (cach don gian nhat, xem README). */
export const GLB_URLS: Record<BodyGender, string> = {
  female: '/models/body-female.glb',
  male: '/models/body-male.glb',
  neutral: '/models/body-female.glb',
};

/** Mau than tu hue (do) - do bao hoa thap cho giong ma-no-canh. */
export function bodyColorCss(hue: number) {
  return `hsl(${Math.round(hue)}, 28%, 64%)`;
}

/* ---------------- Kiem tra file .glb ---------------- */

const glbChecks = new Map<string, Promise<boolean>>();

/** HEAD 1 lan / url: co file .glb that (khong phai trang 404 HTML) hay khong. */
function checkGlb(url: string): Promise<boolean> {
  let p = glbChecks.get(url);
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
      .catch(() => false);
    glbChecks.set(url, p);
  }
  return p;
}

function useGlbUrl(gender: BodyGender): string | null {
  const url = GLB_URLS[gender];
  const [found, setFound] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    void checkGlb(url).then((ok) => alive && setFound((f) => ({ ...f, [url]: ok })));
    return () => { alive = false; };
  }, [url]);
  return found[url] ? url : null;
}

/** File .glb hong -> roi ve mo hinh thu tuc thay vi lam vo ca canh. */
class GlbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------------- Mo hinh thu tuc ---------------- */

function useTube(rings: number, segments: number) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(rings * segments * 3), 3));
    g.setIndex(new BufferAttribute(tubeIndices(rings, segments), 1));
    return g;
  }, [rings, segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function writeTube(g: BufferGeometry, sections: Section[], segments: number) {
  const attr = g.getAttribute('position') as BufferAttribute;
  writeTubePositions(attr.array as Float32Array, sections, segments);
  attr.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
}

function EllipsoidMesh({ e, material, castShadow }: { e: Ellipsoid; material: MeshStandardMaterial; castShadow: boolean }) {
  return (
    <mesh
      position={[e.c.x, e.c.y, e.c.z]}
      scale={[e.r.x, e.r.y, e.r.z]}
      rotation={[0, 0, e.rotZ]}
      material={material}
      castShadow={castShadow}
    >
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  );
}

function ProceduralBody({
  geo, material, castShadow,
}: { geo: BodyGeometry; material: MeshStandardMaterial; castShadow: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const torso = useTube(TORSO_RINGS, TORSO_SEGMENTS);
  const legL = useTube(LEG_RINGS, LEG_SEGMENTS);
  const legR = useTube(LEG_RINGS, LEG_SEGMENTS);
  const armL = useTube(ARM_RINGS, ARM_SEGMENTS);
  const armR = useTube(ARM_RINGS, ARM_SEGMENTS);

  // Cap nhat dinh truoc khi ve frame ke tiep.
  useLayoutEffect(() => {
    writeTube(torso, geo.torso, TORSO_SEGMENTS);
    writeTube(legL, geo.legs[0], LEG_SEGMENTS);
    writeTube(legR, geo.legs[1], LEG_SEGMENTS);
    writeTube(armL, geo.arms[0], ARM_SEGMENTS);
    writeTube(armR, geo.arms[1], ARM_SEGMENTS);
    invalidate();
  }, [geo, torso, legL, legR, armL, armR, invalidate]);

  return (
    <>
      {[torso, legL, legR, armL, armR].map((g) => (
        <mesh key={g.uuid} geometry={g} material={material} castShadow={castShadow} />
      ))}
      <EllipsoidMesh e={geo.head} material={material} castShadow={castShadow} />
      {geo.hands.map((e, i) => <EllipsoidMesh key={`h${i}`} e={e} material={material} castShadow={castShadow} />)}
      {geo.feet.map((e, i) => <EllipsoidMesh key={`f${i}`} e={e} material={material} castShadow={castShadow} />)}
    </>
  );
}

/* ---------------- Mo hinh tu file .glb ---------------- */

/** Dat trong so morph (R3F cap nhat doi tuong three truc tiep, khong qua state React). */
function applyMorphs(meshes: Mesh[], weights: Record<string, number>) {
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) continue;
    for (const name of MORPH_NAMES) {
      const i = dict[name];
      if (i !== undefined) infl[i] = weights[name];
    }
  }
}

function GlbBody({
  url, input, material, castShadow,
}: { url: string; input: BodyModelInput; material: MeshStandardMaterial; castShadow: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const gltf = useGLTF(url);

  const { root, meshes, baseHeight, minY } = useMemo(() => {
    const root: Object3D = gltf.scene.clone(true);
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
      meshes.push(mesh);
    });
    const box = new Box3().setFromObject(root);
    return { root, meshes, baseHeight: Math.max(box.max.y - box.min.y, 0.01), minY: box.min.y };
  }, [gltf, material]);

  useLayoutEffect(() => {
    meshes.forEach((m) => { m.castShadow = castShadow; });
  }, [meshes, castShadow]);

  useLayoutEffect(() => {
    applyMorphs(meshes, morphWeights(input));
    // Scale deu theo chieu cao, chan cham san.
    const s = bodyHeightM(input) / baseHeight;
    root.scale.setScalar(s);
    root.position.setY(-minY * s);
    invalidate();
  }, [input, meshes, root, baseHeight, minY, invalidate]);

  return <primitive object={root} />;
}

/* ---------------- Component chinh ---------------- */

export function Body3D({
  geo, input, hue, visible = true, castShadow = true,
}: {
  geo: BodyGeometry;
  input: BodyModelInput;
  hue: number;
  visible?: boolean;
  castShadow?: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.62, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.color.setHSL(hue / 360, 0.28, 0.64);
    invalidate();
  }, [material, hue, invalidate]);

  const glbUrl = useGlbUrl(input.gender);
  const procedural = <ProceduralBody geo={geo} material={material} castShadow={castShadow} />;

  return (
    <group name={BODY_OBJECT_NAME} visible={visible}>
      {glbUrl ? (
        <GlbBoundary key={glbUrl} fallback={procedural}>
          <Suspense fallback={procedural}>
            <GlbBody url={glbUrl} input={input} material={material} castShadow={castShadow} />
          </Suspense>
        </GlbBoundary>
      ) : (
        procedural
      )}
    </group>
  );
}
// ===== END NEW =====
