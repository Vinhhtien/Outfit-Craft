'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Shirt, Images, ScrollText, ArrowUpRight, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { VButton } from '@/components/ui/vintage';

const nav = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
  { href: '/admin/categories', label: 'Danh mục', icon: Shirt },
  { href: '/admin/outfits', label: 'Outfit công khai', icon: Images },
  { href: '/admin/logs', label: 'Nhật ký', icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hydrateError, hydrate, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { if (!isLoading && !user && !hydrateError) router.replace('/login'); }, [isLoading, user, hydrateError, router]);
  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] text-[#1F453E]" role="status">Đang kiểm tra quyền truy cập…</div>;
  if (hydrateError) return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] p-6 text-[#1F453E]"><div><p role="alert" className="mb-4">{hydrateError}</p><VButton onClick={() => void hydrate()}>Thử lại</VButton></div></div>;
  if (!user) return null;
  if (user.role !== 'admin') return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] p-6 text-center text-[#1F453E]"><div><ShieldCheck size={40} className="mx-auto mb-4" /><h1 className="font-serif-display text-3xl">Khu vực quản trị</h1><p className="my-5">Tài khoản của bạn không có quyền truy cập trang này.</p><Link href="/" className="underline">Về trang chủ</Link></div></div>;
  return <div className="min-h-screen bg-[#FAF9F5] font-jakarta text-[#1F453E]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#16352F] bg-[#1F453E] p-6 text-white lg:flex">
      <Link href="/" className="mt-2"><span className="font-script text-3xl text-[#E2ECC8]">Outfit</span><span className="ml-1 font-serif-display text-xl tracking-[0.15em]">CRAFT</span></Link>
      <p className="mb-10 mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-[#E2ECC8]/75">Không gian quản trị</p>
      <nav aria-label="Quản trị" className="space-y-2">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${pathname === href ? 'bg-[#E2ECC8] font-bold text-[#1F453E]' : 'text-white/80 hover:bg-white/10'}`}><Icon size={18} />{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl border border-white/20 p-4"><p className="font-serif-display text-xl text-[#E2ECC8]">Chăm chút từng bản phối.</p><Link href="/" className="mt-4 flex items-center gap-2 text-xs text-white/80">Ghé trang chủ <ArrowUpRight size={14} /></Link></div>
    </aside>
    <div className="lg:ml-60">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-[#1F453E]/15 px-5 py-4 md:px-10">
        <div><Link href="/" className="font-serif-display text-xl lg:hidden">OutfitCraft</Link><p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#52665F] lg:block">OutfitCraft / Quản trị</p></div>
        <div className="flex items-center gap-4"><div className="text-right"><p className="text-sm font-semibold">{user.displayName}</p><p className="text-xs text-[#52665F]">Quản trị viên</p></div><span className="grid h-10 w-10 place-items-center rounded-full bg-[#E2ECC8]"><ShieldCheck size={20} /></span><button aria-label="Đăng xuất" className="rounded-full p-2 hover:bg-[#E2ECC8]" onClick={() => { logout(); router.replace('/login'); }}><LogOut size={18} /></button></div>
      </header>
      <nav aria-label="Quản trị trên điện thoại" className="flex gap-2 overflow-x-auto border-b border-[#1F453E]/15 p-3 lg:hidden">{nav.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${pathname === href ? 'bg-[#1F453E] text-white' : 'bg-[#E2ECC8]/50'}`}>{label}</Link>)}</nav>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  </div>;
}
