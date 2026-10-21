import { test, expect } from '@playwright/test';

const admin = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'admin@example.com', displayName: 'Ngọc An', role: 'admin' };
const member = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: 'linh@example.com', displayName: 'Linh Giang', role: 'user', isActive: true, isVerified: true, createdAt: '2026-10-19T03:00:00Z', defaultCity: 'Hanoi' };
const log = { _id: 'log1', actorName: 'Ngọc An', action: 'edit_category', targetName: 'Áo', status: 'completed', reason: '', createdAt: '2026-10-19T03:00:00Z' };
const codes = ['top', 'bottom', 'outerwear', 'dress', 'shoes', 'bag', 'accessory'];
const names = ['Áo', 'Quần / Chân váy', 'Áo khoác', 'Váy liền', 'Giày', 'Túi', 'Phụ kiện'];
async function setup(page, role = 'admin') {
  const errors = [], writes = [];
  const state = { member: { ...member }, categories: codes.map((code, i) => ({ _id: code, code, name: names[i], layerOrder: i * 5, defaultTempMin: 15, defaultTempMax: 35, itemCount: 12 })), hidden: false };
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('outfitcraft_token', 'admin-ui-test'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^.*\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data }) });
    const paged = (data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, pagination: { page: 1, pages: 1, total: data.length, limit: 12 } }) });
    if (path === '/auth/me') return reply({ ...admin, role });
    if (path === '/categories') return reply(state.categories);
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON(); writes.push({ path, body });
      if (path.endsWith('/status')) state.member.isActive = body.isActive;
      if (path.includes('/categories/')) Object.assign(state.categories[0], body);
      if (path.endsWith('/visibility')) state.hidden = body.isHidden;
      return reply({});
    }
    if (path === '/admin/dashboard') return reply({ users: 24, items: 156, outfits: 38, lockedUsers: 2, publicOutfits: 12, hiddenOutfits: 1, recentLogs: [log] });
    if (path === '/admin/users') return paged(url.searchParams.get('q') === 'không tồn tại' ? [] : [state.member]);
    if (path === `/admin/users/${member._id}`) return reply({ ...state.member, itemCount: 12, outfitCount: 4 });
    if (path === '/admin/categories') return reply(state.categories);
    if (path === '/admin/outfits') return paged([{ _id: 'cccccccccccccccccccccccc', name: 'Một ngày dịu dàng', owner: { displayName: 'Linh Giang', email: member.email }, isHidden: state.hidden, tags: [], createdAt: member.createdAt }]);
    if (path === '/admin/logs') return paged([log]);
    return reply(null, 404);
  });
  return { errors, writes };
}
test('admin dashboard follows home colors and works on mobile @mobile', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Chào ngày mới, quản trị viên.' })).toBeVisible();
  await expect(page.getByText('156', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: 'Quản trị trên điện thoại' }).getByRole('link', { name: 'Người dùng' }).click();
  await expect(page.getByText(member.email, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('ordinary user cannot see admin content', async ({ page }) => {
  await setup(page, 'user'); await page.goto('/admin');
  await expect(page.getByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chào ngày mới, quản trị viên.' })).toHaveCount(0);
});
test('user search, detail and lock confirmation persist through the API', async ({ page }) => {
  const { errors, writes } = await setup(page); await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('12', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Khóa', exact: true }).click();
  await page.getByRole('textbox', { name: 'Lý do' }).fill('Tài khoản thử nghiệm vi phạm');
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('button', { name: 'Mở khóa', exact: true })).toBeVisible();
  expect(writes[0].body.isActive).toBe(false);
  await page.getByRole('searchbox').fill('không tồn tại');
  await expect(page.getByText('Không tìm thấy người dùng phù hợp.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('category editor validates temperature and saves permitted fields', async ({ page }) => {
  const { errors, writes } = await setup(page); await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Tên hiển thị' }).fill('Áo kiểu');
  await page.getByRole('spinbutton', { name: 'Nhiệt độ thấp nhất (°C)', exact: true }).fill('40');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Nhiệt độ thấp nhất');
  await page.getByRole('spinbutton', { name: 'Nhiệt độ thấp nhất (°C)', exact: true }).fill('18');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('heading', { name: 'Áo kiểu', exact: true })).toBeVisible();
  expect(writes[0].body).toEqual({ name: 'Áo kiểu', layerOrder: 0, defaultTempMin: 18, defaultTempMax: 35 });
  await page.screenshot({ path: 'test-results/admin-categories.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('outfit moderation and logs are accessible; initial failures can retry', async ({ page }) => {
  const { errors, writes } = await setup(page); await page.goto('/admin/outfits');
  await page.getByRole('button', { name: 'Ẩn outfit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Lý do' }).fill('Nội dung không phù hợp');
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('button', { name: 'Hiện lại outfit' })).toBeVisible();
  expect(writes[0].body.isHidden).toBe(true);
  await page.getByRole('navigation', { name: 'Quản trị', exact: true }).getByRole('link', { name: 'Nhật ký' }).click();
  await expect(page.getByText('Sửa danh mục', { exact: true })).toBeVisible();
  let failed = true;
  await page.route('**/api/admin/users**', async (route) => {
    if (failed) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Không tải được người dùng.' }) });
    await route.fallback();
  });
  await page.goto('/admin/users');
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được người dùng.' })).toBeVisible();
  failed = false; await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText(member.email)).toBeVisible();
  expect(errors).toEqual([]);
});
