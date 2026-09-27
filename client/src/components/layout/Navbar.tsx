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

/** Chu viet tat cho avatar: "Linh Mai" -> "LM", "imlinggiang" -> "I". */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#16352F] bg-[#1F453E] font-jakarta text-white">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-4 px-4">
        <Link href="/wardrobe" className="flex shrink-0 items-baseline leading-none">
          <span className="font-script text-2xl text-[#E2ECC8]">Outfit</span>
          <span className="ml-1 font-serif-display text-lg tracking-[0.2em] text-white">CRAFT</span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all sm:px-5 ${
                  active
                    ? 'border-white bg-[#E2ECC8] text-[#1F453E] shadow-sm'
                    : 'border-white/60 bg-[#7C90A0]/80 text-white hover:bg-[#869BB2]'
                }`}
              >
                <Icon size={15} className="sm:hidden" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm font-medium text-[#E2ECC8] md:inline">
              {user.displayName}
            </span>
            <span
              title={user.displayName}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DCE6C3] font-serif-display text-xs font-bold text-[#1F453E]"
            >
              {initials(user.displayName)}
            </span>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="rounded-full p-1.5 text-white/80 transition-colors hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
