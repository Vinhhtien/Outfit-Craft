/**
 * Tach nen anh ngay tren trinh duyet bang model RMBG-1.4 (briaai) qua @huggingface/transformers.
 * Buoc tach nen chay hoan toan client-side (WASM) -> khong ton quota API.
 * Sau buoc nay AddItemModal gui anh da tach nen cho Gemini de goi y thong tin (xem /items/auto-tag).
 *
 * Vi sao khong dung @imgly/background-removal (ISNet) lam model chinh: voi do hoa tiet camo xam
 * chup tren nen be tong xam, ISNet chi giu duoc soc trang va nua tren, nua duoi ong quan bi trong suot.
 * RMBG-1.4 tach dung ca chiec quan. imgly van duoc giu lam du phong khi RMBG loi.
 *
 * Lan dau chay se tai model (~44MB, ban luong tu hoa q8) nen can hien progress; cac lan sau trinh duyet da cache.
 * License RMBG-1.4: chi dung phi thuong mai (do an hoc tap). Dung cho san pham thuong mai can thoa thuan voi Bria.
 */

import type { BackgroundRemovalPipeline, ProgressInfo } from '@huggingface/transformers';

export interface RemoveBgOptions {
  /** 0 -> 1 */
  onProgress?: (progress: number, stage: string) => void;
}

const MODEL_ID = 'briaai/RMBG-1.4';
const STAGE_DOWNLOAD = 'Đang tải model AI';
const STAGE_REMOVE = 'Đang tách nền';

/** Pipeline chi tao mot lan; model tai xong duoc dung lai cho cac lan tach nen sau. */
let segmenterPromise: Promise<BackgroundRemovalPipeline> | null = null;
/** Lan tai model dang chay chi bao tien do cho lan goi da kich hoat no. */
let downloadListener: RemoveBgOptions['onProgress'];

function loadSegmenter(): Promise<BackgroundRemovalPipeline> {
  if (!segmenterPromise) {
    // Tong hop tien do cua tat ca file (config + model) de thanh progress khong nhay lui.
    const files = new Map<string, { loaded: number; total: number }>();
    const report = (info: ProgressInfo) => {
      if (info.status !== 'progress') return;
      files.set(info.file, { loaded: info.loaded, total: info.total });
      let loaded = 0;
      let total = 0;
      files.forEach((f) => { loaded += f.loaded; total += f.total; });
      downloadListener?.(total > 0 ? loaded / total : 0, STAGE_DOWNLOAD);
    };

    segmenterPromise = import('@huggingface/transformers')
      .then(({ pipeline }) =>
        pipeline('background-removal', MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback: report })
      )
      .catch((err) => {
        // Cho phep thu lai o lan sau (vd mat mang khi dang tai model).
        segmenterPromise = null;
        throw err;
      });
  }
  return segmenterPromise;
}

async function removeWithRmbg(file: File | Blob, options: RemoveBgOptions): Promise<Blob> {
  downloadListener = options.onProgress;
  options.onProgress?.(0, STAGE_DOWNLOAD);
  let segmenter: BackgroundRemovalPipeline;
  try {
    segmenter = await loadSegmenter();
  } finally {
    downloadListener = undefined;
  }

  options.onProgress?.(1, STAGE_REMOVE);
  const { RawImage } = await import('@huggingface/transformers');
  const input = await RawImage.fromBlob(file);
  const [output] = await segmenter(input);
  if (!output || output.channels !== 4) throw new Error('RMBG-1.4 không trả về ảnh có kênh alpha');
  return output.toBlob('image/png');
}

async function removeWithImgly(file: File | Blob, options: RemoveBgOptions): Promise<Blob> {
  const { removeBackground: imglyRemove } = await import('@imgly/background-removal');
  return imglyRemove(file, {
    output: { format: 'image/png', quality: 0.9 },
    progress: (key: string, current: number, total: number) => {
      const stage = key.startsWith('fetch') ? STAGE_DOWNLOAD : STAGE_REMOVE;
      options.onProgress?.(total > 0 ? current / total : 0, stage);
    },
  });
}

export async function removeBackground(
  file: File | Blob,
  options: RemoveBgOptions = {}
): Promise<Blob> {
  // Import dong ben trong cac ham con: thu vien nang va chi chay duoc tren browser.
  try {
    return await removeWithRmbg(file, options);
  } catch (err) {
    console.warn('[background-removal] RMBG-1.4 lỗi, chuyển sang imgly:', err);
    return removeWithImgly(file, options);
  }
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
