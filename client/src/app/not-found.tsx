import Link from 'next/link';
export default function NotFound() { return <main className="mx-auto max-w-xl p-12 text-center"><h1 className="text-2xl font-semibold">Không tìm thấy trang</h1><p className="my-4">Trang này không tồn tại hoặc đã được chuyển đi.</p><Link className="underline" href="/wardrobe">Về tủ đồ</Link></main>; }
