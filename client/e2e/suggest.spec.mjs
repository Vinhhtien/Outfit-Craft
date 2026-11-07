import { test, expect } from '@playwright/test';

const user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'qa@example.com', displayName: 'Kiểm thử', defaultCity: 'Hanoi' };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=';
const piece = (id, name, category) => ({
  _id: id.repeat(24), name, category, imageUrl: image, originalImageUrl: image, colors: ['#ffffff'],
  styles: [], seasons: [], occasions: [], wearCount: 0, tempRange: { min: 18, max: 35 },
});
const top = piece('b', 'Áo trắng', 'top');
const otherTop = piece('c', 'Áo đỏ', 'top');
const bottom = piece('d', 'Quần jeans', 'bottom');
const weather = { city: 'Hanoi', temp: 27, feelsLike: 29, humidity: 70, condition: 'Clear', description: 'trời quang', icon: '01d', isRaining: false };
const option = (key, shirt) => ({ key, top: shirt, bottom, totalScore: 80, reasons: ['Phù hợp nhiệt độ 27°C'] });

async function setup(page, handler) {
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('outfitcraft_token', 'qa-token'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api/, '');
    const reply = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    if (await handler?.({ route, path, url, reply })) return;
    if (path === '/auth/me') return reply({ success: true, data: user });
    if (path === '/suggestions') {
      requests.push(Object.fromEntries(url.searchParams));
      const shuffled = url.searchParams.get('shuffle') === '1';
      const options = shuffled ? [option('2222222222', otherTop)] : [option('1111111111', top), option('3333333333', otherTop)];
      return reply({
        success: true,
        data: {
          weather, suggestion: options[0], options, missing: [],
          seasonWarning: url.searchParams.get('seasons') === 'winter' ? 'Bạn đang lọc đồ mùa đông, nhưng hôm nay 27°C nên có thể chưa hợp thời tiết.' : undefined,
          advice: shuffled ? 'Lời khuyên theo quy tắc.' : 'Lời khuyên từ stylist.',
          adviceSource: shuffled ? 'rule' : 'ai',
        },
      });
    }
    return reply({ success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } });
  });
  return { errors, requests };
}

test('shuffle asks for a new outfit and remembers what was shown', async ({ page }) => {
  const { errors, requests } = await setup(page);
  await page.goto('/suggest');
  await expect(page.getByText('Lời khuyên từ stylist.')).toBeVisible();
  await expect(page.getByText('Phương án 1/2')).toBeVisible();
  expect(requests.at(-1).shuffle).toBeUndefined();

  await page.getByRole('button', { name: 'Phương án tiếp theo' }).click();
  await expect(page.getByText('Phương án 2/2')).toBeVisible();

  await page.getByRole('button', { name: 'Xáo trộn' }).click();
  await expect(page.getByText('Lời khuyên theo quy tắc.')).toBeVisible();
  await expect(page.getByText('Áo đỏ', { exact: true })).toBeVisible();
  expect(requests.at(-1).shuffle).toBe('1');
  expect(requests.at(-1).seen).toBe('1111111111,3333333333');

  // Lan tai thuong sau do khong con la xao tron.
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByText('Lời khuyên từ stylist.')).toBeVisible();
  expect(requests.at(-1).shuffle).toBeUndefined();
  expect(errors).toEqual([]);
});

test('season and color filters reach the API and can be cleared', async ({ page }) => {
  const { errors, requests } = await setup(page);
  await page.goto('/suggest');
  await expect(page.getByText('Lời khuyên từ stylist.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bỏ lọc' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Đông', exact: true }).click();
  await expect(page.getByText('Bạn đang lọc đồ mùa đông')).toBeVisible();
  expect(requests.at(-1).seasons).toBe('winter');

  await page.getByRole('button', { name: 'Đỏ', exact: true }).click();
  await page.getByRole('button', { name: 'Xanh lá', exact: true }).click();
  await expect.poll(() => requests.at(-1).colorGroups).toBe('red,green');
  await page.screenshot({ path: 'test-results/suggest-filters.png', fullPage: true });

  await page.getByRole('button', { name: 'Bỏ lọc' }).click();
  await expect(page.getByText('Bạn đang lọc đồ mùa đông')).toHaveCount(0);
  await expect.poll(() => requests.at(-1).colorGroups).toBeUndefined();
  expect(requests.at(-1).seasons).toBeUndefined();
  expect(errors).toEqual([]);
});

test('filters and shuffle stay out of the ranked view', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Danh sách chấm điểm' }).click();
  await expect(page.getByRole('button', { name: 'Xáo trộn' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đông', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stylist chat shows the outfit with try-on and save, and survives tab changes', async ({ page }) => {
  const bodies = [];
  const { errors } = await setup(page, async ({ path, route, reply }) => {
    if (path !== '/suggestions/chat') return false;
    bodies.push(route.request().postDataJSON());
    await reply({
      success: true,
      data: {
        reply: 'Áo trắng đi với quần jeans rất gọn gàng.', source: 'ai', weather, occasion: 'work',
        suggestion: option('4444444444', top), notes: ['Tủ chưa có giày để phối cùng'],
      },
    });
    return true;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByText('Hỏi stylist của bạn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi' })).toBeDisabled();

  await page.getByLabel('Tin nhắn cho stylist').fill('Mai đi làm mặc gì?');
  await page.getByLabel('Tin nhắn cho stylist').press('Enter');
  await expect(page.getByText('Áo trắng đi với quần jeans rất gọn gàng.')).toBeVisible();
  await expect(page.getByText('• Tủ chưa có giày để phối cùng')).toBeVisible();
  expect(bodies[0]).toMatchObject({ message: 'Mai đi làm mặc gì?', history: [], occasion: 'daily', seen: [], city: 'Hanoi' });

  await expect(page.getByRole('link', { name: 'Thử đồ' })).toHaveAttribute('href', `/studio?items=${top._id},${bottom._id}`);
  await page.screenshot({ path: 'test-results/suggest-chat.png', fullPage: true });

  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Bộ đồ gợi ý' }).click();
  await expect(page.getByText('Áo trắng đi với quần jeans rất gọn gàng.')).toBeHidden();
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByText('Áo trắng đi với quần jeans rất gọn gàng.')).toBeVisible();

  await page.getByLabel('Tin nhắn cho stylist').fill('Đổi bộ khác');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].seen).toEqual(['4444444444']);
  expect(bodies[1].history.map((turn) => turn.role)).toEqual(['user', 'stylist']);
  expect(errors).toEqual([]);
});

test('an unavailable stylist shows the reason and is not sent back as history', async ({ page }) => {
  const bodies = [];
  const { errors } = await setup(page, async ({ path, route, reply }) => {
    if (path !== '/suggestions/chat') return false;
    bodies.push(route.request().postDataJSON());
    await reply({ success: false, message: 'Stylist AI đang tạm nghỉ.' }, 503);
    return true;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await page.getByLabel('Tin nhắn cho stylist').fill('Chào bạn');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Stylist AI đang tạm nghỉ.')).toBeVisible();

  await page.getByLabel('Tin nhắn cho stylist').fill('Thử lại nhé');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].history).toEqual([{ role: 'user', text: 'Chào bạn' }]);
  expect(errors).toEqual([]);
});

test('suggest page stays within the mobile viewport @mobile', async ({ page }) => {
  const { errors } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/suggest');
  await expect(page.getByText('Lời khuyên từ stylist.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/suggest-mobile.png', fullPage: true });

  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByLabel('Tin nhắn cho stylist')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/suggest-chat-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
