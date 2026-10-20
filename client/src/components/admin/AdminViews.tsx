'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Users, Shirt, Layers, LockKeyhole, ArrowUpRight, Search, RefreshCw, Eye, EyeOff, Pencil, ShieldCheck, ScrollText } from 'lucide-react';
import { adminApi, type AdminCategory, type AdminLogEntry, type AdminOutfit, type AdminUser } from '@/lib/adminApi';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/api';
import { VButton, VInput, VModal, VSpinner } from '@/components/ui/vintage';
import { CloudImage } from '@/components/ui/CloudImage';
import { useCategoryStore } from '@/store/categoryStore';

const box = 'rounded-2xl border border-[#1F453E]/15 bg-white';
const number = (value: number) => value.toLocaleString('vi-VN');
const date = (value: string) => new Date(value).toLocaleString('vi-VN');
const actions: Record<string, string> = { lock_user: 'Khóa tài khoản', unlock_user: 'Mở khóa tài khoản', edit_category: 'Sửa danh mục', hide_outfit: 'Ẩn outfit', show_outfit: 'Hiện outfit' };
const changeLabels: Record<string, string> = { name: 'Tên', layerOrder: 'Thứ tự lớp', defaultTempMin: 'Nhiệt độ tối thiểu', defaultTempMax: 'Nhiệt độ tối đa', isActive: 'Hoạt động', isHidden: 'Ẩn' };

function Heading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[#687F92]">{eyebrow}</p><h1 className="font-serif-display text-3xl md:text-4xl">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#52665F]">{description}</p></div>{children}</div>;
}
function Badge({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${danger ? 'bg-[#F5E2DA] text-[#8C2D19]' : 'bg-[#E2ECC8]/75 text-[#1F453E]'}`}>{children}</span>;
}
function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return <div role="alert" className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8C2D19]/20 bg-[#F5E2DA]/40 p-4 text-sm text-[#8C2D19]"><p>{error}</p>{retry && <VButton variant="outline" onClick={retry}>Thử lại</VButton>}</div>;
}
function Empty({ text }: { text: string }) { return <div className="py-16 text-center"><Search size={28} className="mx-auto mb-4 text-[#869BB2]" /><p className="text-sm text-[#52665F]">{text}</p></div>; }
function Refresh({ reload, loading }: { reload: () => void; loading: boolean }) { return <VButton variant="outline" disabled={loading} onClick={reload}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới</VButton>; }
function Pager({ pagination, change, loading }: { pagination: { page: number; pages: number; total: number }; change: (page: number) => void; loading: boolean }) {
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#52665F]"><span>{number(pagination.total)} kết quả · Trang {pagination.page}/{Math.max(1, pagination.pages)}</span><div className="flex gap-2"><VButton variant="outline" disabled={loading || pagination.page <= 1} onClick={() => change(pagination.page - 1)}>Trước</VButton><VButton variant="outline" disabled={loading || pagination.page >= pagination.pages} onClick={() => change(pagination.page + 1)}>Sau</VButton></div></div>;
}
function Filters({ q, setQ, status, setStatus, options, placeholder }: { q: string; setQ: (value: string) => void; status?: string; setStatus?: (value: string) => void; options?: [string, string][]; placeholder: string }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Tìm kiếm</span><Search size={17} className="absolute left-4 top-3.5 text-[#52665F]" /><input type="search" value={q} maxLength={100} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} className="w-full rounded-full border border-[#1F453E]/25 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#1F453E]/25" /></label>{options && <label><span className="sr-only">Lọc trạng thái</span><select value={status} onChange={(e) => setStatus?.(e.target.value)} className="w-full rounded-full border border-[#1F453E]/25 bg-white px-5 py-3 text-sm sm:w-52">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}</div>;
}

export function DashboardView() {
  const loader = useCallback((signal: AbortSignal) => adminApi.dashboard(signal), []);
  const { data, loading, error, reload } = useResource(loader);
  const stats = data ? [
    { label: 'Người dùng', value: data.users, icon: Users, color: 'bg-[#E2ECC8]', href: '/admin/users' },
    { label: 'Món đồ', value: data.items, icon: Shirt, color: 'bg-[#E5EAF0]', href: '/admin/categories' },
    { label: 'Bản phối', value: data.outfits, icon: Layers, color: 'bg-[#F2E9D8]', href: '/admin/outfits' },
    { label: 'Tài khoản bị khóa', value: data.lockedUsers, icon: LockKeyhole, color: 'bg-[#F5E2DA]', href: '/admin/users?status=locked' },
  ] : [];
  return <>
    <Heading eyebrow="Góc nhìn tổng thể" title="Chào ngày mới, quản trị viên." description="Một góc nhỏ để chăm sóc cộng đồng và giữ tủ đồ số luôn gọn gàng."><Refresh reload={reload} loading={loading} /></Heading>
    <div className="mb-8 overflow-hidden rounded-2xl border border-[#1F453E]/20 bg-[repeating-linear-gradient(90deg,#E2ECC8_0px,#E2ECC8_28px,#EAF2D3_28px,#EAF2D3_56px)] p-7 md:p-9"><div className="flex items-center gap-3"><ShieldCheck size={25} /><p className="text-xs font-bold uppercase tracking-[0.15em]">Không gian quản trị OutfitCraft</p></div><p className="mt-4 max-w-xl font-serif-display text-2xl leading-snug md:text-3xl">Chăm chút cộng đồng,<br /><span className="italic">nâng niu từng bản phối.</span></p></div>
    {error && <ErrorBox error={error} retry={reload} />}
    {loading && !data && <VSpinner label="Đang tải thống kê" />}
    {data && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, color, href }) => <Link key={label} href={href} className={`${box} p-5 transition-shadow hover:shadow-md`}><div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={20} /></span><ArrowUpRight size={16} className="text-[#869BB2]" /></div><p className="mb-1 mt-6 font-serif-display text-4xl">{number(value)}</p><p className="text-xs text-[#52665F]">{label}</p></Link>)}</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className={`${box} p-6`}><div className="mb-5 flex items-center justify-between"><h2 className="font-serif-display text-xl">Hoạt động gần đây</h2><Link href="/admin/logs" className="text-xs underline underline-offset-4">Xem tất cả</Link></div><LogList entries={data.recentLogs} /></section><section className="rounded-2xl bg-[#1F453E] p-7 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E2ECC8]">Cộng đồng phối đồ</p><h2 className="mt-5 font-serif-display text-3xl">Những bản phối<br />được sẻ chia.</h2><p className="mt-6 text-sm text-white/80">{number(data.publicOutfits)} outfit công khai, trong đó {number(data.hiddenOutfits)} outfit đang bị ẩn.</p><Link href="/admin/outfits" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#E2ECC8] px-5 py-3 text-xs font-bold text-[#1F453E]">Quản lý outfit <ArrowUpRight size={15} /></Link></section></div>
    </>}
  </>;
}

function ReasonDialog({ title, subject, onClose, save, onSaved }: { title: string; subject: string; onClose: () => void; save: (reason: string) => Promise<unknown>; onSaved: () => void }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  return <VModal open onClose={onClose} title={title} busy={busy} serifTitle><form onSubmit={async (event) => {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await save(reason.trim()); onSaved(); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); submitting.current = false; }
  }}><p className="mb-5 break-words text-sm text-[#52665F]">{subject}</p><label className="block text-sm font-semibold">Lý do<textarea autoFocus required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} className="mt-2 min-h-28 w-full rounded-xl border border-[#9EB0A8] p-3 font-normal outline-none focus:ring-2 focus:ring-[#E2ECC8]" placeholder="Ghi lý do để lưu vào nhật ký…" /></label>{error && <ErrorBox error={error} />}<div className="mt-6 flex justify-end gap-3"><VButton variant="outline" disabled={busy} onClick={onClose}>Hủy</VButton><VButton type="submit" loading={busy} disabled={reason.trim().length < 3}>Xác nhận</VButton></div></form></VModal>;
}

export function UsersView() {
  const [q, setQ] = useState(''), [status, setStatus] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('status') ?? ''), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null), [target, setTarget] = useState<AdminUser | null>(null), [notice, setNotice] = useState('');
  const loader = useCallback((signal: AbortSignal) => adminApi.users({ q, status, page }, signal), [q, status, page]);
  const { data, loading, error, reload } = useResource(loader, 250);
  return <><Heading eyebrow="Cộng đồng OutfitCraft" title="Người dùng" description="Tra cứu tài khoản và quản lý trạng thái hoạt động của thành viên."><Refresh reload={reload} loading={loading} /></Heading>
    {notice && <p role="status" className="mb-4 rounded-xl bg-[#E2ECC8] p-4 text-sm">{notice}</p>}
    <Filters q={q} setQ={(value) => { setQ(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} placeholder="Tìm theo tên hoặc email…" options={[[ '', 'Tất cả trạng thái' ], ['active', 'Đang hoạt động'], ['locked', 'Đã khóa'], ['unverified', 'Chưa xác thực']]} />
    {error && <ErrorBox error={error} retry={reload} />}
    <div className={`${box} overflow-hidden`} aria-busy={loading}>{loading && <div className="flex items-center gap-2 border-b border-[#1F453E]/10 p-4 text-xs"><VSpinner /> Đang tải người dùng…</div>}
      {data?.data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[730px] text-left text-sm"><thead className="bg-[#E2ECC8]/35 text-xs text-[#52665F]"><tr>{['Thành viên', 'Vai trò', 'Xác thực', 'Trạng thái', 'Thao tác'].map((label) => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#1F453E]/10">{data.data.map((user) => <tr key={user._id} className="hover:bg-[#FAF9F5]"><td className="px-5 py-5"><p className="font-semibold">{user.displayName}</p><p className="mt-1 text-xs text-[#52665F]">{user.email}</p></td><td className="px-5 py-4">{user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</td><td className="px-5 py-4 text-xs">{user.isVerified === false ? 'Chưa xác thực' : 'Đã xác thực'}</td><td className="px-5 py-4"><Badge danger={user.isActive === false}>{user.isActive === false ? 'Đã khóa' : 'Hoạt động'}</Badge></td><td className="px-5 py-4"><div className="flex items-center gap-4"><button className="font-semibold underline underline-offset-4" onClick={() => setSelected(user._id)}>Chi tiết</button>{user.role !== 'admin' && <button disabled={loading || !!error} className="text-xs text-[#8C2D19] underline underline-offset-4 disabled:opacity-40" onClick={() => setTarget(user)}>{user.isActive === false ? 'Mở khóa' : 'Khóa'}</button>}</div></td></tr>)}</tbody></table></div> : !loading && <Empty text="Không tìm thấy người dùng phù hợp." />}
    </div>{data && <Pager pagination={data.pagination} change={setPage} loading={loading} />}
    {selected && <UserDetail key={selected} id={selected} close={() => setSelected(null)} />}
    {target && <ReasonDialog title={target.isActive === false ? 'Mở khóa tài khoản' : 'Khóa tài khoản'} subject={`${target.displayName} · ${target.email}`} onClose={() => setTarget(null)} save={(reason) => adminApi.userStatus(target._id, target.isActive === false, reason)} onSaved={() => { setTarget(null); setNotice('Đã cập nhật trạng thái tài khoản.'); void reload(); }} />}
  </>;
}
function UserDetail({ id, close }: { id: string; close: () => void }) {
  const loader = useCallback((signal: AbortSignal) => adminApi.user(id, signal), [id]);
  const { data, loading, error, reload } = useResource(loader);
  return <VModal open onClose={close} title="Chi tiết người dùng" serifTitle>{loading && <VSpinner />}{error && <ErrorBox error={error} retry={reload} />}{data && <div><div className="mb-6 rounded-xl bg-[#E2ECC8]/40 p-5"><h3 className="font-serif-display text-2xl">{data.displayName}</h3><p className="mt-2 break-all text-sm">{data.email}</p></div><dl className="space-y-3 text-sm">{[
    ['Vai trò', data.role === 'admin' ? 'Quản trị viên' : 'Người dùng'], ['Trạng thái', data.isActive === false ? 'Đã khóa' : 'Hoạt động'],
    ['Email', data.isVerified === false ? 'Chưa xác thực' : 'Đã xác thực'], ['Thành phố', data.defaultCity || 'Chưa cập nhật'], ['Ngày đăng ký', date(data.createdAt)], ['Số món đồ', data.itemCount ?? 0], ['Số outfit', data.outfitCount ?? 0],
  ].map(([label, value]) => <div key={label} className="flex justify-between gap-5 border-b border-[#1F453E]/10 pb-3"><dt className="text-[#52665F]">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl>{data.lockReason && <p className="mt-4 break-words text-sm text-[#8C2D19]">Lý do khóa: {data.lockReason}</p>}</div>}</VModal>;
}

export function CategoriesView() {
  const loader = useCallback((signal: AbortSignal) => adminApi.categories(signal), []);
  const { data, loading, error, reload } = useResource(loader);
  const [target, setTarget] = useState<AdminCategory | null>(null), [notice, setNotice] = useState('');
  return <><Heading eyebrow="Sắp xếp tủ đồ" title="Danh mục quần áo" description="Chăm chút bảy nhóm đồ, thứ tự lớp và nhiệt độ mặc định cho những món đồ mới."><Refresh reload={reload} loading={loading} /></Heading>
    {notice && <p role="status" className="mb-5 rounded-xl bg-[#E2ECC8] p-4 text-sm">{notice}</p>}{error && <ErrorBox error={error} retry={reload} />}{loading && <VSpinner />}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data?.map((category) => <section key={category.code} className={`${box} p-6`}><div className="mb-6 flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#E2ECC8]"><Shirt size={23} /></span><Badge>{number(category.itemCount)} món đồ</Badge></div><h2 className="font-serif-display text-2xl">{category.name}</h2><p className="mt-1 text-xs uppercase tracking-widest text-[#687F92]">{category.code}</p><div className="my-6 grid grid-cols-2 gap-3 rounded-xl bg-[#FAF9F5] p-4"><div><p className="text-[11px] text-[#52665F]">Thứ tự lớp</p><p className="mt-1 font-semibold">{category.layerOrder}</p></div><div><p className="text-[11px] text-[#52665F]">Nhiệt độ mặc định</p><p className="mt-1 font-semibold">{category.defaultTempMin}–{category.defaultTempMax}°C</p></div></div><VButton variant="outline" disabled={loading || !!error} onClick={() => setTarget(category)}><Pencil size={13} /> Chỉnh sửa</VButton></section>)}</div>
    {target && <CategoryEditor key={target.code} category={target} close={() => setTarget(null)} saved={() => { setTarget(null); setNotice('Đã cập nhật danh mục. Nhiệt độ mới áp dụng cho món đồ tạo sau này.'); void reload(); void useCategoryStore.getState().load().catch(() => {}); }} />}
  </>;
}
function CategoryEditor({ category, close, saved }: { category: AdminCategory; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ name: category.name, layerOrder: category.layerOrder, defaultTempMin: category.defaultTempMin, defaultTempMax: category.defaultTempMax });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  return <VModal open onClose={close} title={`Chỉnh sửa ${category.name}`} busy={busy} serifTitle><form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); if (submitting.current) return;
    if (form.defaultTempMin > form.defaultTempMax) { setError('Nhiệt độ thấp nhất không được lớn hơn nhiệt độ cao nhất.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await adminApi.updateCategory(category.code, form); saved(); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); submitting.current = false; }
  }}><VInput label="Tên hiển thị" required maxLength={50} value={form.name} disabled={busy} onChange={(e) => setForm({ ...form, name: e.target.value })} /><VInput label="Thứ tự lớp (số lớn nằm trên)" type="number" required min={0} max={100} step={1} value={form.layerOrder} disabled={busy} onChange={(e) => setForm({ ...form, layerOrder: Number(e.target.value) })} /><div className="grid grid-cols-2 gap-4"><VInput label="Nhiệt độ thấp nhất (°C)" type="number" required min={-50} max={60} step="any" value={form.defaultTempMin} disabled={busy} onChange={(e) => setForm({ ...form, defaultTempMin: Number(e.target.value) })} /><VInput label="Nhiệt độ cao nhất (°C)" type="number" required min={-50} max={60} step="any" value={form.defaultTempMax} disabled={busy} onChange={(e) => setForm({ ...form, defaultTempMax: Number(e.target.value) })} /></div><p className="text-xs leading-5 text-[#52665F]">Nhiệt độ áp dụng khi thêm món đồ mới. Thứ tự lớp áp dụng khi thêm đồ vào Studio; bố cục đã lưu được giữ nguyên.</p>{error && <ErrorBox error={error} />}<div className="flex justify-end gap-3 pt-3"><VButton variant="outline" disabled={busy} onClick={close}>Hủy</VButton><VButton type="submit" loading={busy}>Lưu thay đổi</VButton></div></form></VModal>;
}

export function OutfitsView() {
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1), [target, setTarget] = useState<AdminOutfit | null>(null), [notice, setNotice] = useState('');
  const loader = useCallback((signal: AbortSignal) => adminApi.outfits({ q, status, page }, signal), [q, status, page]);
  const { data, loading, error, reload } = useResource(loader, 250);
  return <><Heading eyebrow="Những bản phối được sẻ chia" title="Outfit công khai" description="Xem và kiểm duyệt các bản phối xuất hiện trong cộng đồng."><Refresh reload={reload} loading={loading} /></Heading>
    {notice && <p role="status" className="mb-5 rounded-xl bg-[#E2ECC8] p-4 text-sm">{notice}</p>}
    <Filters q={q} setQ={(v) => { setQ(v); setPage(1); }} status={status} setStatus={(v) => { setStatus(v); setPage(1); }} placeholder="Tìm tên outfit, tên hoặc email người đăng…" options={[[ '', 'Tất cả trạng thái' ], ['visible', 'Đang hiển thị'], ['hidden', 'Đã bị ẩn']]} />
    {error && <ErrorBox error={error} retry={reload} />}{loading && <div className="mb-4 flex items-center gap-2 text-sm" role="status"><VSpinner /> Đang tải outfit…</div>}
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy={loading}>{data?.data.map((outfit) => <article key={outfit._id} className={`${box} overflow-hidden`}><div className="relative aspect-[4/3] bg-[#E2ECC8]/25"><CloudImage src={outfit.thumbnailUrl} alt={outfit.name} className="h-full w-full object-contain p-3" /><div className="absolute left-3 top-3"><Badge danger={outfit.isHidden}>{outfit.isHidden ? 'Đã bị ẩn' : 'Đang hiển thị'}</Badge></div></div><div className="p-5"><h2 className="break-words font-serif-display text-xl">{outfit.name}</h2><p className="mt-2 text-xs text-[#52665F]">{outfit.owner?.displayName ?? 'Tài khoản không còn tồn tại'} · {date(outfit.createdAt)}</p>{outfit.moderationReason && <p className="mt-3 break-words text-xs text-[#8C2D19]">Lý do ẩn: {outfit.moderationReason}</p>}<VButton variant="outline" disabled={loading || !!error} className="mt-5" onClick={() => setTarget(outfit)}>{outfit.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}{outfit.isHidden ? 'Hiện lại outfit' : 'Ẩn outfit'}</VButton></div></article>)}</div>
    {!loading && data?.data.length === 0 && <Empty text="Không tìm thấy outfit công khai phù hợp." />}{data && <Pager pagination={data.pagination} change={setPage} loading={loading} />}
    {target && <ReasonDialog title={target.isHidden ? 'Hiện lại outfit' : 'Ẩn outfit khỏi cộng đồng'} subject={target.name} onClose={() => setTarget(null)} save={(reason) => adminApi.visibility(target._id, !target.isHidden, reason)} onSaved={() => { setTarget(null); setNotice('Đã cập nhật trạng thái hiển thị outfit.'); void reload(); }} />}
  </>;
}

function LogList({ entries }: { entries: AdminLogEntry[] }) {
  if (!entries.length) return <Empty text="Chưa có hoạt động quản trị nào." />;
  return <div className="divide-y divide-[#1F453E]/10">{entries.map((entry) => <div key={entry._id} className="flex gap-3 py-4"><span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E2ECC8]/60"><ScrollText size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{actions[entry.action] ?? entry.action}</p><span className="text-[11px] text-[#52665F]">{date(entry.createdAt)}</span></div><p className="mt-1 break-words text-xs leading-5 text-[#52665F]">{entry.actorName} · {entry.targetName}</p>{entry.reason && <p className="mt-2 break-words text-sm">{entry.reason}</p>}{entry.changes && <details className="mt-2 text-xs text-[#52665F]"><summary className="cursor-pointer">Chi tiết thay đổi</summary><dl className="mt-2 space-y-1">{Object.entries(entry.changes.after).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{changeLabels[key] ?? key}: </dt><dd className="inline break-words">{String(entry.changes!.before[key])} → {String(value)}</dd></div>)}</dl></details>}{entry.status !== 'completed' && <div className="mt-2"><Badge danger={entry.status === 'failed'}>{entry.status === 'failed' ? 'Thao tác thất bại' : 'Chưa xác nhận hoàn tất'}</Badge></div>}</div></div>)}</div>;
}
export function LogsView() {
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const loader = useCallback((signal: AbortSignal) => adminApi.logs({ q, page }, signal), [q, page]);
  const { data, loading, error, reload } = useResource(loader, 250);
  return <><Heading eyebrow="Lịch sử chăm sóc hệ thống" title="Nhật ký quản trị" description="Theo dõi người thực hiện, thời điểm và lý do của các thay đổi."><Refresh reload={reload} loading={loading} /></Heading><Filters q={q} setQ={(v) => { setQ(v); setPage(1); }} placeholder="Tìm theo quản trị viên hoặc đối tượng…" />{error && <ErrorBox error={error} retry={reload} />}<section className={`${box} px-5 md:px-7`} aria-busy={loading}>{loading && <div className="py-5"><VSpinner /></div>}{data && <LogList entries={data.data} />}</section>{data && <Pager pagination={data.pagination} change={setPage} loading={loading} />}</>;
}
