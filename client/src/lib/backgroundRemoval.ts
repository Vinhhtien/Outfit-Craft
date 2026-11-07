/**
 * Tach nen anh ngay tren trinh duyet bang @imgly/background-removal.
 * Buoc tach nen chay hoan toan client-side (WASM) -> khong ton quota API.
 * Sau buoc nay AddItemModal gui anh da tach nen cho Gemini de goi y thong tin (xem /items/auto-tag).
 *
 * Lan dau chay se tai model (~vai chuc MB) nen can hien progress.
 */

export interface RemoveBgOptions {
  /** 0 -> 1 */
  onProgress?: (progress: number, stage: string) => void;
}

export async function removeBackground(
  file: File | Blob,
  options: RemoveBgOptions = {}
): Promise<Blob> {
  // Import dong: thu vien nang va chi chay duoc tren browser.
  const { removeBackground: imglyRemove } = await import('@imgly/background-removal');

  return imglyRemove(file, {
    output: { format: 'image/png', quality: 0.9 },
    progress: (key: string, current: number, total: number) => {
      const stage = key.startsWith('fetch') ? 'Đang tải model AI' : 'Đang tách nền';
      options.onProgress?.(total > 0 ? current / total : 0, stage);
    },
  });
}

/** Thu nho anh truoc khi tach nen de chay nhanh hon va nhe RAM. */
export function resizeImage(
  file: File,
  maxSize = 1024
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (!width || !height || width * height > 40000000) return reject(new Error('Ảnh có độ phân giải quá lớn. Vui lòng chọn ảnh dưới 40 megapixel.'));
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Trình duyệt không hỗ trợ canvas 2D'));

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Không xử lý được ảnh'))),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được file ảnh'));
    };
    img.src = url;
  });
}
