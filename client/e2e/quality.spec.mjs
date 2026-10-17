import { test, expect } from '@playwright/test';
const user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'qa@example.com', displayName: 'Kiểm thử', defaultCity: 'Hanoi' };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=';
const baseItem = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Áo mẫu', category: 'top', imageUrl: image, originalImageUrl: image, colors: ['#ffffff'], styles: [], seasons: [], occasions: [], wearCount: 0, tempRange: { min: 18, max: 35 } };
async function setup(page, handler) {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('outfitcraft_token', 'qa-token'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    if (await handler?.({ route, path, url, reply })) return;
    if (path === '/auth/me') return reply({ success: true, data: user });
    if (path === '/auth/login') return reply({ success: true, data: { token: 'qa-renewed', user } });
    if (path === '/users/me/body-profile') return reply({ success: true, data: null });
    if (path === '/items') return reply({ success: true, data: [baseItem], pagination: { page: 1, pages: 1, total: 1 } });
    if (path === `/items/${baseItem._id}`) return reply({ success: true, data: baseItem });
    if (path === '/outfits' || path === '/schedule') return reply({ success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } });
    return reply({ success: false, message: 'Không có dữ liệu thử cho đường dẫn này.' }, 404);
  });
  return errors;
}

test('failed initial load exposes retry without a false empty wardrobe on desktop', async ({ page }) => {
  let failed = true;
  const errors = await setup(page, async ({ path, reply }) => {
    if (path === '/items' && failed) { await reply({ success: false, message: 'Không tải được tủ đồ. Vui lòng thử lại.' }, 503); return true; }
  });
  await page.goto('/wardrobe');
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được tủ đồ' })).toBeVisible();
  await expect(page.getByText('Tủ đồ đang trống')).toHaveCount(0);
  failed = false; await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Áo mẫu', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/wardrobe-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('wardrobe stays within the mobile viewport @mobile', async ({ page }) => {
  const errors = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/wardrobe');
  await expect(page.getByText('Áo mẫu', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/wardrobe-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('pending fit errors survive navigation and can be retried on another page', async ({ page }) => {
  let fail = true;
  const errors = await setup(page, async ({ path, reply }) => {
    if (path.endsWith('/fit')) {
      await reply(fail ? { success: false, message: 'Không lưu được vị trí món đồ.' } : { success: true, data: baseItem }, fail ? 503 : 200);
      return true;
    }
  });
  await page.addInitScript(({ owner, itemId }) => {
    if (sessionStorage.getItem('fit-seeded')) return;
    sessionStorage.setItem('fit-seeded', 'yes');
    sessionStorage.setItem(`outfitcraft:pending-fits:${owner}`, JSON.stringify([{ owner, itemId, fit: { category: 'top', anchorRef: 'neck', offsetX: 0, offsetY: 0, width: 1, height: 1 }, error: '' }]));
  }, { owner: user.id, itemId: baseItem._id });
  await page.goto('/studio');
  await expect(page.getByRole('button', { name: 'Thử lưu lại' })).toBeVisible();
  await page.getByRole('link', { name: 'Tủ đồ', exact: true }).click();
  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(page.getByText(/Chưa lưu được vị trí/)).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Thử lưu lại' }).click();
  await expect(page.getByText(/Chưa lưu được vị trí/)).toHaveCount(0);
  expect(await page.evaluate((owner) => sessionStorage.getItem(`outfitcraft:pending-fits:${owner}`), user.id)).toBeNull();
  expect(errors).toEqual([]);
});

test('late search response cannot replace a newer query', async ({ page }) => {
  const errors = await setup(page, async ({ path, url, reply }) => {
    if (path !== '/items') return;
    const q = url.searchParams.get('q');
    if (q === 'old') { await new Promise((resolve) => setTimeout(resolve, 1400)); await reply({ success: true, data: [{ ...baseItem, name: 'Kết quả cũ' }] }); return true; }
    if (q === 'new') { await reply({ success: true, data: [{ ...baseItem, name: 'Kết quả mới' }] }); return true; }
  });
  await page.goto('/wardrobe'); await expect(page.getByText('Áo mẫu', { exact: true })).toBeVisible();
  const search = page.getByPlaceholder('Tìm theo tên hoặc thương hiệu...');
  const oldRequest = page.waitForRequest((req) => req.url().includes('q=old'));
  await search.fill('old'); await oldRequest;
  await search.fill('new'); await expect(page.getByText('Kết quả mới', { exact: true })).toBeVisible();
  await page.waitForTimeout(1600);
  await expect(page.getByText('Kết quả cũ', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('slow initial data shows a loading skeleton until the result arrives', async ({ page }) => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const errors = await setup(page, async ({ path, reply }) => {
    if (path !== '/items') return;
    await waiting;
    await reply({ success: true, data: [baseItem], pagination: { page: 1, pages: 1, total: 1 } });
    return true;
  });
  await page.goto('/wardrobe');
  await expect(page.getByRole('status', { name: 'Đang tải danh sách' })).toBeVisible();
  await expect(page.getByText('Tủ đồ đang trống')).toHaveCount(0);
  release();
  await expect(page.getByText('Áo mẫu', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Đang tải danh sách' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('failed save keeps edited fields and session renewal preserves the open form', async ({ page }) => {
  let saves = 0;
  const errors = await setup(page, async ({ path, route, reply }) => {
    if (path === `/items/${baseItem._id}` && route.request().method() === 'PATCH') {
      saves++;
      if (saves === 1) await reply({ success: false, message: 'Không thể lưu lúc này.' }, 500);
      else if (saves === 2) await reply({ success: false, code: 'SESSION_EXPIRED', message: 'Phiên đã hết hạn.' }, 401);
      else await reply({ success: true, data: { ...baseItem, name: 'Tên đang chỉnh sửa' } });
      return true;
    }
  });
  await page.goto('/wardrobe'); await page.getByText('Áo mẫu', { exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Chi tiết món đồ' });
  await detail.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const name = detail.getByLabel(/Tên món đồ/);
  await name.fill('Tên đang chỉnh sửa');
  const save = detail.getByRole('button', { name: /Lưu/ });
  await save.click(); await expect(detail.getByText('Không thể lưu lúc này.')).toBeVisible();
  await expect(name).toHaveValue('Tên đang chỉnh sửa');
  await save.click();
  const session = page.getByRole('dialog', { name: 'Đăng nhập lại để tiếp tục' });
  await expect(session).toBeVisible();
  await session.getByLabel('Mật khẩu').fill('test-password');
  await session.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(session).toHaveCount(0); await expect(name).toHaveValue('Tên đang chỉnh sửa');
  await save.click(); await expect(detail.getByText('Tên đang chỉnh sửa', { exact: true })).toBeVisible();
  expect(saves).toBe(3); expect(errors).toEqual([]);
});

test('invalid file is rejected before running background removal or upload', async ({ page }) => {
  let uploads = 0;
  const errors = await setup(page, ({ path }) => { if (path.includes('with-images')) uploads++; });
  await page.goto('/wardrobe'); await page.getByRole('button', { name: 'Thêm món đồ', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Thêm món đồ mới' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(dialog.getByText('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.')).toBeVisible();
  expect(uploads).toBe(0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Studio surfaces profile load failure and recovers after retry', async ({ page }) => {
  let failed = true;
  const errors = await setup(page, async ({ path, reply }) => {
    if (path === '/users/me/body-profile' && failed) { await reply({ success: false, message: 'Không tải được hồ sơ dáng người.' }, 503); return true; }
  });
  await page.goto('/studio');
  const profileError = page.getByRole('alert').filter({ hasText: 'Không tải được hồ sơ dáng người.' });
  await expect(profileError).toBeVisible();
  failed = false; await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(profileError).toHaveCount(0);
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
