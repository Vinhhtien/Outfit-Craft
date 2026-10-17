'use client';
import { ErrorState } from '@/components/ui/AsyncState';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Không thể hiển thị trang</h1><ErrorState message="Trang đang gặp sự cố. Hãy thử tải lại nội dung." onRetry={reset} /></main>;
}
