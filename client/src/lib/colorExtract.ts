/**
 * Trich xuat mau chu dao tu anh PNG da tach nen.
 * Dung de tu dong dien truong `colors` khi them do vao tu.
 *
 * Cach lam: luong tu hoa mau ve luoi 32 muc, bo pixel trong suot va
 * pixel gan trang/den (thuong la vien anh), roi lay cac cum pho bien nhat.
 */

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export async function extractColors(
  source: Blob | string,
  count = 3
): Promise<string[]> {
  const img = await loadImage(source);

  // Ve xuong canvas nho: du de lay mau, nhanh hon nhieu.
  const size = 100;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];

    if (a < 200) continue;                       // nen trong suot
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 245 && min > 245) continue;        // gan trang
    if (max < 12) continue;                      // gan den tuyet doi

    // Luong tu hoa ve buoc 32 de gom cac sac do gan nhau vao 1 cum.
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((c) =>
      toHex(
        Math.round(c.r / c.count),
        Math.round(c.g / c.count),
        Math.round(c.b / c.count)
      )
    );
}

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);

    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      reject(new Error('Không tải được ảnh'));
    };
    img.src = url;
  });
}
