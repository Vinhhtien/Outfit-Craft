/** Decart can anh mon do tren nen tron, toi thieu 512x512. */
const GARMENT_CANVAS = 768;
const GARMENT_INNER = 704;

/** PNG tach nen -> JPEG nen trang, can giua trong khung vuong. */
export function garmentImageBlob(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const failed = () => reject(new Error('Không tải được ảnh món đồ này. Vui lòng thử món khác.'));
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onerror = failed;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = GARMENT_CANVAS;
      const context = canvas.getContext('2d');
      if (!context || !image.naturalWidth || !image.naturalHeight) return failed();
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, GARMENT_CANVAS, GARMENT_CANVAS);
      const scale = Math.min(GARMENT_INNER / image.naturalWidth, GARMENT_INNER / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (GARMENT_CANVAS - width) / 2, (GARMENT_CANVAS - height) / 2, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : failed()), 'image/jpeg', 0.9);
    };
    image.src = url;
  });
}

/** Cho video co frame dau tien. Het gio van tiep tuc, noi goi tu xu ly khi chua chup duoc. */
export function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); video.removeEventListener('loadeddata', done); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    video.addEventListener('loadeddata', done);
  });
}

/** Chup frame hien tai cua video. Chua co hinh -> null. */
export function captureVideoFrame(video: HTMLVideoElement | null, quality = 0.92): Promise<Blob | null> {
  if (!video?.videoWidth || !video.videoHeight) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
