// ===== NEW: Body 3D =====
/** Trinh duyet co WebGL khong? Khong co -> roi ve mannequin SVG (mannequin.ts) va canvas 2D. */
export function hasWebGL(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

let cached: boolean | null = null;

/** Nhu hasWebGL nhung chi do 1 lan (tao context ton tai nguyen). */
export function webglAvailable(): boolean {
  if (cached === null) cached = hasWebGL();
  return cached;
}

/** Chi dung trong test. */
export function resetWebGLCache(): void {
  cached = null;
}
// ===== END NEW =====
