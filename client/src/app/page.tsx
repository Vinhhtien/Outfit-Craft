'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuthStore } from '@/store/authStore';
import { outfitApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import type { Outfit, User } from '@/types';

/*
 * Trang chu (Landing Page) dung chung cho Khach va Nguoi dung da dang nhap.
 * Moi section la 1 component rieng; CTA thay doi theo `viewer` lay tu useAuthStore.
 */

/** 'loading' = AuthProvider dang hydrate token -> chua biet la Khach hay User, tranh nhay CTA. */
type Viewer = 'loading' | 'guest' | 'user';

/** GET /outfits/feed chi select cac truong nay va populate owner (displayName, avatarUrl). */
type FeedOutfit = Pick<Outfit, '_id' | 'name' | 'thumbnailUrl' | 'tags' | 'likeCount' | 'createdAt'> & {
  owner: { _id: string; displayName: string; avatarUrl?: string } | string;
};

const PILL =
  'inline-flex items-center justify-center rounded-full border px-7 py-3 font-jakarta text-xs font-bold uppercase tracking-wider transition-colors';
const PILL_PRIMARY = `${PILL} border-[#1F453E] bg-[#1F453E] text-white shadow-sm hover:bg-[#16352F]`;
const PILL_OUTLINE = `${PILL} border-[#1F453E] bg-transparent text-[#1F453E] hover:bg-[#FAF9F5]/70`;

export default function Home() {
  const { user, isLoading } = useAuthStore();
  const viewer: Viewer = isLoading ? 'loading' : user ? 'user' : 'guest';

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-jakarta text-[#1F453E]">
      <Navbar />
      <main>
        <HeroSection viewer={viewer} user={user} />
        <StorySection />
        <FeaturesSection />
        <ShowcaseSection viewer={viewer} userId={user?.id ?? null} />
      </main>
      <FinalCtaFooter viewer={viewer} />
    </div>
  );
}

/* ---------------- 1. Hero Banner ---------------- */
function HeroSection({ viewer, user }: { viewer: Viewer; user: User | null }) {
  return (
    <section className="bg-[repeating-linear-gradient(90deg,#E2ECC8_0px,#E2ECC8_28px,#EAF2D3_28px,#EAF2D3_56px)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-12 md:grid-cols-2 md:pb-16 md:pt-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#869BB2]">Tủ đồ số · Phối đồ</p>

          {viewer === 'user' && user ? (
            <h1 className="mt-4 font-serif-display text-4xl leading-tight md:text-5xl">
              Chào mừng trở lại, <span className="italic">{user.displayName}</span>
            </h1>
          ) : (
            <h1 className="mt-4 font-serif-display text-4xl leading-tight md:text-5xl">
              Số hóa tủ đồ, <span className="italic">nâng niu</span> từng bản phối.
            </h1>
          )}

          <p className="mt-5 max-w-md text-base leading-relaxed text-[#1F453E]/80">
            {viewer === 'user'
              ? 'Tủ đồ của bạn đang chờ. Mở kệ đồ số hoặc vào phòng phối đồ để bắt đầu một ngày mới.'
              : 'Chụp ảnh, tách nền và sắp xếp mọi món đồ vào một tủ đồ số gọn gàng — rồi phối chúng theo cách của riêng bạn.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {viewer === 'loading' && (
              <>
                <span className="h-11 w-48 animate-pulse rounded-full bg-[#1F453E]/15" />
                <span className="h-11 w-40 animate-pulse rounded-full bg-[#1F453E]/10" />
              </>
            )}
            {viewer === 'guest' && (
              <>
                <Link href="/register" className={PILL_PRIMARY}>
                  Bắt đầu số hóa
                </Link>
                <a href="#cau-chuyen" className={PILL_OUTLINE}>
                  Tìm hiểu thêm
                </a>
              </>
            )}
            {viewer === 'user' && (
              <>
                {user?.role === 'admin' && (
                  <Link href="/admin" className={PILL_PRIMARY}>
                    Vào trang quản trị
                  </Link>
                )}
                <Link href="/wardrobe" className={user?.role === 'admin' ? PILL_OUTLINE : PILL_PRIMARY}>
                  Vào tủ đồ của bạn
                </Link>
                <Link href="/studio" className={PILL_OUTLINE}>
                  Phối đồ ngay
                </Link>
              </>
            )}
          </div>

          {viewer === 'guest' && (
            <p className="mt-4 text-sm text-[#1F453E]/70">
              Đã có tài khoản?{' '}
              <Link href="/login" className="font-semibold underline underline-offset-4 hover:text-[#16352F]">
                Đăng nhập
              </Link>
            </p>
          )}
        </div>

        {/* ===== HERO BANNER ===== */}
        {/* Anh doc (475x1024) trong khung vom 3:4 -> object-cover cat bot tren/duoi, giu thanh treo + quan ao o giua. */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-t-full border-2 border-[#1F453E] bg-[#FAF9F5]/60">
          <Image
            src="/images/hero-wardrobe.jpg"
            alt="Giá treo quần áo gỗ với áo sơ mi linen, áo len xanh xô thơm và áo khoác xanh rêu"
            fill
            priority
            sizes="(max-width: 416px) 100vw, 384px"
            className="object-cover"
          />
        </div>
      </div>

      <ScallopEdge />
    </section>
  );
}

/** Vien day luon song: moi vom rong 28px trung 1 soc nen, phan duoi vom lap day mau kem cua section ke tiep. */
function ScallopEdge() {
  return (
    <svg className="block h-4 w-full" aria-hidden="true">
      <defs>
        <pattern id="home-hero-scallop" width="28" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 16 A14 14 0 0 1 28 16 Z" fill="#FAF9F5" />
          <path d="M0 16 A14 14 0 0 1 28 16" fill="none" stroke="#1F453E" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="100%" height="16" fill="url(#home-hero-scallop)" />
    </svg>
  );
}

/* ---------------- 2. Storytelling ---------------- */
function StorySection() {
  return (
    // scroll-mt-16: chua cho Navbar sticky (h-16) khi bam "Tim hieu them".
    <section id="cau-chuyen" className="scroll-mt-16 bg-[#FAF9F5] px-4 py-20 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#869BB2]">Câu chuyện</p>
        <h2 className="mt-4 font-serif-display text-3xl leading-snug md:text-4xl">
          Một tủ đồ đầy ắp, nhưng bạn luôn cảm thấy không có gì để mặc?
        </h2>
        <span className="mx-auto mt-6 block h-px w-16 bg-[#1F453E]/30" />
        <p className="mt-6 text-base leading-relaxed text-[#1F453E]/80 md:text-lg">
          OutfitCraft mang đến trải nghiệm nâng niu từng món đồ của bạn. Chúng tôi giúp bạn nhìn lại những gì
          mình đang có, biến chúng thành những bản phối mới mẻ mà không cần phải mua sắm thêm.
        </p>
      </div>
    </section>
  );
}

/* ---------------- 3. Core Features ---------------- */
/** Noi dung gioi thieu tinh nang (copy tinh cua trang, khong phai du lieu dong). */
const FEATURES = [
  {
    title: 'Tách nền tự động',
    description:
      'Chụp một tấm ảnh, OutfitCraft tự xóa phông nền ngay trên trình duyệt để món đồ sẵn sàng lên kệ tủ đồ số.',
  },
  {
    title: 'Phòng phối đồ tương tác',
    description:
      'Kéo, thả, xoay và xếp lớp từng món trên canvas để thử bản phối trước khi mặc thật.',
  },
  {
    title: 'Gợi ý theo thời tiết',
    description:
      'Dựa trên thời tiết tại thành phố của bạn, hệ thống chọn ra những món phù hợp nhất từ chính tủ đồ bạn đang có.',
  },
];

function FeaturesSection() {
  return (
    <section className="bg-[#FAF9F5] px-4 pb-20 md:pb-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <article
            key={f.title}
            className="rounded-2xl border border-[#9EB0A8] bg-white p-7 transition-shadow hover:shadow-md"
          >
            {/* TODO: User se tu chen Icon/Anh minh hoa tinh nang vao khung nay. */}
            <div className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-[#1F453E]/40 bg-[#E2ECC8]/50">
              <span className="font-serif-display text-sm text-[#1F453E]/50">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-6 font-serif-display text-xl">{f.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#1F453E]/75">{f.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 4. Community Showcase ---------------- */
/** So o skeleton khi dang tai (chi la khung, khong phai du lieu). */
const SKELETON_COUNT = 4;

/** Server tra 12 ban phoi cong khai moi nhat/trang; trang chu hien toi da 8. */
const SHOWCASE_LIMIT = 8;

function ShowcaseSection({ viewer, userId }: { viewer: Viewer; userId: string | null }) {
  /*
   * LUU Y: GET /outfits/feed hien nam sau middleware `protect` (server/src/routes/outfit.routes.ts).
   * Khach goi se bi 401 va interceptor trong lib/api.ts se day ve /login -> chi goi API khi da dang nhap.
   * TODO: Neu muon Khach cung xem duoc feed, chuyen route '/feed' len truoc `router.use(protect)` o server
   *       roi bo dieu kien `if (!userId) return;` ben duoi.
   */
  const [feed, setFeed] = useState<{ forUserId: string | null; outfits: FeedOutfit[]; error: string | null }>({
    forUserId: null,
    outfits: [],
    error: null,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    outfitApi
      .feed(1)
      .then((res) => {
        if (!cancelled) setFeed({ forUserId: userId, outfits: res.data as unknown as FeedOutfit[], error: null });
      })
      .catch((err) => {
        if (!cancelled) setFeed({ forUserId: userId, outfits: [], error: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isCurrent = userId !== null && feed.forUserId === userId;
  const loading = viewer === 'loading' || (viewer === 'user' && !isCurrent);
  const outfits = isCurrent ? feed.outfits.slice(0, SHOWCASE_LIMIT) : [];
  const error = isCurrent ? feed.error : null;

  return (
    <section className="border-t border-[#1F453E]/10 bg-[#FAF9F5] px-4 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#869BB2]">Cộng đồng</p>
            <h2 className="mt-3 font-serif-display text-3xl md:text-4xl">Bản phối nổi bật tuần này</h2>
          </div>
          {viewer === 'user' && (
            <div className="flex items-center gap-4">
              <Link href="/ootd" className="text-sm font-semibold underline underline-offset-4 hover:text-[#16352F]">
                Xem tất cả trên Bảng tin OOTD →
              </Link>
              <Link href="/studio" className="text-sm font-semibold underline underline-offset-4 hover:text-[#16352F]">
                Tạo bản phối của bạn
              </Link>
            </div>
          )}
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <div key={i}>
                  <div className="aspect-[3/4] animate-pulse rounded-2xl bg-[#E2ECC8]/50" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-[#E2ECC8]/70" />
                </div>
              ))}
            </div>
          ) : viewer === 'guest' ? (
            <ShowcaseNotice
              text="Đăng nhập để khám phá những bản phối mà cộng đồng OutfitCraft chia sẻ."
              href="/login"
              cta="Đăng nhập"
            />
          ) : error ? (
            <ShowcaseNotice text={`Không tải được bản phối: ${error}`} />
          ) : outfits.length === 0 ? (
            <ShowcaseNotice
              text="Chưa có bản phối công khai nào. Hãy là người đầu tiên chia sẻ!"
              href="/studio"
              cta="Phối đồ ngay"
            />
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {outfits.map((outfit) => (
                <ShowcaseCard key={outfit._id} outfit={outfit} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({ outfit }: { outfit: FeedOutfit }) {
  const ownerName = typeof outfit.owner === 'object' ? outfit.owner.displayName : null;

  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#9EB0A8]/60 bg-[#E2ECC8]/50">
        {/* Anh lay tu data that (outfit.thumbnailUrl - anh chup canvas luu tren Cloudinary).
            Dung <img> nhu Navbar vi next.config chua khai bao remotePatterns cho Cloudinary. */}
        {outfit.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={outfit.thumbnailUrl}
            alt={outfit.name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-[#1F453E]/40">
            Chưa có ảnh
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-serif-display text-base">{outfit.name}</h3>
          {ownerName && <p className="truncate text-xs text-[#1F453E]/60">{ownerName}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-[#869BB2]">
          <Heart size={13} />
          {outfit.likeCount}
        </span>
      </div>
    </article>
  );
}

function ShowcaseNotice({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#9EB0A8] bg-[#E2ECC8]/30 px-6 py-14 text-center">
      <p className="mx-auto max-w-md text-sm text-[#1F453E]/75">{text}</p>
      {href && cta && (
        <Link href={href} className={`${PILL_PRIMARY} mt-6`}>
          {cta}
        </Link>
      )}
    </div>
  );
}

/* ---------------- 5. Final CTA & Mini Footer ---------------- */
function FinalCtaFooter({ viewer }: { viewer: Viewer }) {
  return (
    <footer className="bg-[#1F453E] px-4 text-white">
      <div className="mx-auto max-w-3xl py-20 text-center md:py-24">
        {viewer === 'loading' ? (
          <>
            <span className="mx-auto block h-10 w-80 max-w-full animate-pulse rounded-full bg-white/10" />
            <span className="mx-auto mt-8 block h-11 w-48 animate-pulse rounded-full bg-white/15" />
          </>
        ) : (
          <>
            <h2 className="font-serif-display text-3xl md:text-4xl">
              {viewer === 'user' ? 'Hôm nay bạn mặc gì?' : 'Sẵn sàng xây dựng tủ đồ trong mơ?'}
            </h2>
            <Link
              href={viewer === 'user' ? '/schedule' : '/register'}
              className={`${PILL} mt-8 border-white bg-white text-[#1F453E] hover:bg-[#E2ECC8]`}
            >
              {viewer === 'user' ? 'Lên lịch trang phục' : 'Đăng ký ngay'}
            </Link>
          </>
        )}
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/15 py-8">
        <p className="flex items-baseline leading-none">
          <span className="font-script text-2xl text-[#E2ECC8]">Outfit</span>
          <span className="ml-1.5 font-serif-display text-lg tracking-[0.2em]">CRAFT</span>
        </p>
        <p className="text-sm text-white/70">Mỗi món đồ cũ là một câu chuyện mới.</p>
      </div>
    </footer>
  );
}
