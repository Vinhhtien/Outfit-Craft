'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shirt, LayoutGrid, Sparkles, CalendarDays, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const NAV = [
  { href: '/wardrobe', label: 'Tủ đồ', icon: Shirt },
  { href: '/studio', label: 'Phối đồ', icon: LayoutGrid },
  { href: '/suggest', label: 'Gợi ý', icon: Sparkles },
  { href: '/schedule', label: 'Lịch', icon: CalendarDays },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/wardrobe" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary)] text-white">
            <Shirt size={16} />
          </span>
          OutfitCraft
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              {user.displayName}
            </span>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-red-500"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
