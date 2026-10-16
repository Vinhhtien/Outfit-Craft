'use client';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="vi"><body><main style={{ maxWidth: 560, margin: '15vh auto', padding: 24, fontFamily: 'sans-serif' }}><h1>Không thể mở OutfitCraft</h1><p>Ứng dụng đang gặp sự cố. Vui lòng thử lại.</p><button onClick={reset}>Thử lại</button></main></body></html>;
}
