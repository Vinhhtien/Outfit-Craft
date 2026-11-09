import { test, expect } from '@playwright/test';

const user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'qa@example.com', displayName: 'Kiểm thử', defaultCity: 'Hanoi' };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=';
const item = {
  _id: 'b'.repeat(24), name: 'Áo trắng', category: 'top', imageUrl: image, originalImageUrl: image, colors: ['#ffffff'],
  styles: [], seasons: [], occasions: [], wearCount: 0, tempRange: { min: 18, max: 35 },
};
const quota = { configured: true, dailySeconds: 600, usedSeconds: 0, remainingSeconds: 600, maxSessionSeconds: 120 };
const sessionId = 'c'.repeat(24);
/** Dev server bien dich SDK o lan dau, co the mat vai chuc giay. Ban production duoi 2 giay. */
const FIRST_LOAD = { timeout: 45000 };

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

async function setup(page, overrides = {}) {
  const calls = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('outfitcraft_token', 'qa-token');
    window.cameraStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.cameraStreams.push(stream);
      return stream;
    };
  });
  // Giu ket noi toi Decart o trang thai dang cho, khong can key that.
  await page.routeWebSocket(/decart/, () => {});
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const reply = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    if (path.startsWith('/try-on')) calls.push(`${request.method()} ${path}`);
    if (path === '/auth/me') return reply({ success: true, data: user });
    if (path === '/items') return reply({ success: true, data: [item], pagination: { page: 1, limit: 100, total: 1, pages: 1 } });
    if (path === '/try-on/quota') return reply({ success: true, data: overrides.quota ?? quota });
    if (path === '/try-on/sessions') return reply({ success: true, data: { sessionId, maxSeconds: 120 } }, 201);
    if (path.endsWith('/token')) return reply({ success: true, data: { apiKey: 'ek_fake', expiresAt: '2030-01-01T00:00:00Z' } });
    if (path.endsWith('/heartbeat')) return reply({ success: true, data: { active: true, usedSeconds: 0, remainingSeconds: 120 } });
    if (path.endsWith('/end')) return reply({ success: true, data: quota });
    if (path.endsWith('/prompt')) return reply({ success: true, data: { prompt: 'Substitute the current top with a white t-shirt.', source: 'ai' } });
    return reply({ success: true, data: [] });
  });
  return { calls, errors };
}

const openFromWardrobe = async (page) => {
  await page.goto('/wardrobe');
  await page.getByRole('button', { name: 'Thử trực tiếp', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Thử đồ trực tiếp' })).toBeVisible();
};
const cameraStates = (page) =>
  page.evaluate(() => window.cameraStreams.flatMap((stream) => stream.getTracks().map((track) => track.readyState)));

test('asks for consent before touching the camera', async ({ page }) => {
  const { calls } = await setup(page);
  await openFromWardrobe(page);
  await expect(page.getByText('một dịch vụ AI bên thứ ba')).toBeVisible();
  await expect(page.getByText('không được lưu lại')).toBeVisible();
  expect(await cameraStates(page)).toEqual([]);
  expect(calls).not.toContain('POST /try-on/sessions');
});

test('shows the body guide while connecting, and closing the panel releases everything', async ({ page }) => {
  const { calls, errors } = await setup(page);
  await openFromWardrobe(page);
  await page.getByRole('button', { name: 'Đồng ý và bật camera' }).click();

  await expect(page.getByText('Lùi lại để thấy toàn thân')).toBeVisible();
  await expect.poll(() => calls, FIRST_LOAD).toContain(`POST /try-on/sessions/${sessionId}/token`);
  expect(calls).toContain(`POST /try-on/items/${item._id}/prompt`);
  expect(await cameraStates(page)).toEqual(['live']);

  await page.getByRole('dialog', { name: 'Thử đồ trực tiếp' }).getByTitle('Đóng').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => cameraStates(page)).toEqual(['ended']);
  await expect.poll(() => calls).toContain(`POST /try-on/sessions/${sessionId}/end`);
  expect(errors).toEqual([]);
});

test('leaving the page releases the camera too', async ({ page }) => {
  const { calls } = await setup(page);
  await openFromWardrobe(page);
  await page.getByRole('button', { name: 'Đồng ý và bật camera' }).click();
  await expect.poll(() => calls, FIRST_LOAD).toContain(`POST /try-on/sessions/${sessionId}/token`);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => cameraStates(page)).toEqual(['ended']);
});

test('explains a denied camera and does not open a session', async ({ page }) => {
  const { calls } = await setup(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
  });
  await openFromWardrobe(page);
  await page.getByRole('button', { name: 'Đồng ý và bật camera' }).click();
  await expect(page.getByText('Bạn chưa cấp quyền dùng camera', { exact: false })).toBeVisible();
  expect(calls).not.toContain('POST /try-on/sessions');
});

test('blocks the start button when the daily time is spent', async ({ page }) => {
  await setup(page, { quota: { ...quota, usedSeconds: 600, remainingSeconds: 0 } });
  await openFromWardrobe(page);
  await expect(page.getByText('Bạn đã dùng hết thời lượng thử đồ trực tiếp hôm nay', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đồng ý và bật camera' })).toBeDisabled();
});

test('Studio opens the panel without disturbing the canvas', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/studio');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: `Thử trực tiếp ${item.name}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Thử đồ trực tiếp' });
  await expect(dialog).toBeVisible();
  await dialog.getByTitle('Đóng').click();
  await expect(dialog).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(page.getByTitle(`Thêm "${item.name}" lên canvas`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await setup(page);
  await openFromWardrobe(page);
  await page.getByRole('button', { name: 'Đồng ý và bật camera' }).click();
  await expect(page.getByText('Lùi lại để thấy toàn thân')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
