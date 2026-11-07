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

const stylistMessage = {
  _id: 'e'.repeat(24), role: 'stylist', text: 'Áo trắng đi với quần jeans rất gọn gàng.', source: 'ai',
  items: [bottom, top], occasion: 'work', weather, notes: ['Tủ chưa có giày để phối cùng'],
};
const userMessage = { _id: 'f'.repeat(24), role: 'user', text: 'Hôm qua mặc gì?', items: [], notes: [] };
const conversation = (id, title) => ({ _id: id.repeat(24), title, lastMessageAt: '2026-11-07T07:00:00.000Z' });
const oldChat = conversation('1', 'Đi làm mặc gì');
const otherChat = conversation('2', 'Đi biển mặc gì');

test('a new chat appears in the history bar and keeps going in the same conversation', async ({ page }) => {
  const bodies = [];
  const { errors } = await setup(page, async ({ path, route, reply }) => {
    if (path !== '/suggestions/chat') return false;
    bodies.push(route.request().postDataJSON());
    await reply({
      success: true,
      data: { conversation: oldChat, message: { ...stylistMessage, _id: `reply-${bodies.length}` } },
    });
    return true;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByText('Hỏi stylist của bạn')).toBeVisible();
  await expect(page.getByText('Chưa có đoạn chat nào.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi' })).toBeDisabled();

  await page.getByLabel('Tin nhắn cho stylist').fill('Mai đi làm mặc gì?');
  await page.getByLabel('Tin nhắn cho stylist').press('Enter');
  await expect(page.getByText('Áo trắng đi với quần jeans rất gọn gàng.')).toBeVisible();
  await expect(page.getByText('• Tủ chưa có giày để phối cùng')).toBeVisible();
  expect(bodies[0]).toEqual({ message: 'Mai đi làm mặc gì?', occasion: 'daily', city: 'Hanoi' });
  await expect(page.getByRole('complementary', { name: 'Lịch sử chat' }).getByText('Đi làm mặc gì')).toBeVisible();

  // Ao dung truoc quan du server tra theo thu tu nao.
  await expect(page.getByRole('link', { name: 'Thử đồ' })).toHaveAttribute('href', `/studio?items=${top._id},${bottom._id}`);
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
  expect(bodies[1].conversationId).toBe(oldChat._id);
  expect(errors).toEqual([]);
});

test('old chats open from the history bar and a new chat starts clean', async ({ page }) => {
  const posts = [];
  const { errors } = await setup(page, async ({ path, route, reply }) => {
    if (path === '/suggestions/chats') { await reply({ success: true, data: [oldChat, otherChat] }); return true; }
    if (path === `/suggestions/chats/${oldChat._id}`) { await reply({ success: true, data: [userMessage, stylistMessage] }); return true; }
    if (path === `/suggestions/chats/${otherChat._id}`) {
      await reply({ success: true, data: [{ ...userMessage, _id: 'x', text: 'Đi biển nên mặc gì?' }] });
      return true;
    }
    if (path === '/suggestions/chat') {
      posts.push(route.request().postDataJSON());
      await reply({ success: true, data: { conversation: conversation('3', 'Mới'), message: { ...stylistMessage, _id: 'new', items: [] } } });
      return true;
    }
    return false;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  const history = page.getByRole('complementary', { name: 'Lịch sử chat' });
  await expect(page.getByText('Hỏi stylist của bạn')).toBeVisible();

  await history.getByRole('button', { name: /^Đi làm mặc gì/ }).click();
  await expect(page.getByText('Hôm qua mặc gì?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Thử đồ' })).toBeVisible();
  await page.screenshot({ path: 'test-results/suggest-chat.png', fullPage: true });

  await history.getByRole('button', { name: /^Đi biển mặc gì/ }).click();
  await expect(page.getByText('Đi biển nên mặc gì?')).toBeVisible();
  await expect(page.getByText('Hôm qua mặc gì?')).toHaveCount(0);

  await page.getByRole('button', { name: 'Đoạn chat mới' }).click();
  await expect(page.getByText('Hỏi stylist của bạn')).toBeVisible();
  await page.getByLabel('Tin nhắn cho stylist').fill('Câu mới');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].conversationId).toBeUndefined();
  await expect(history.getByRole('button', { name: /^Mới/ })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByRole('complementary', { name: 'Lịch sử chat' }).getByText('Đi làm mặc gì')).toBeVisible();
  expect(errors).toEqual([]);
});

test('deleting a chat asks first and clears it if it was open', async ({ page }) => {
  let saved = [oldChat, otherChat];
  const deleted = [];
  const { errors } = await setup(page, async ({ path, route, reply }) => {
    if (path === '/suggestions/chats') { await reply({ success: true, data: saved }); return true; }
    if (path.startsWith('/suggestions/chats/')) {
      if (route.request().method() === 'DELETE') {
        const id = path.split('/').at(-1);
        deleted.push(id);
        saved = saved.filter((c) => c._id !== id);
        await reply({ success: true, data: null });
      } else await reply({ success: true, data: [userMessage] });
      return true;
    }
    return false;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  const history = page.getByRole('complementary', { name: 'Lịch sử chat' });
  await history.getByRole('button', { name: /^Đi làm mặc gì/ }).click();
  await expect(page.getByText('Hôm qua mặc gì?')).toBeVisible();

  await page.getByRole('button', { name: 'Xoá đoạn chat Đi làm mặc gì' }).click();
  await history.getByRole('button', { name: 'Huỷ' }).click();
  expect(deleted).toEqual([]);

  await page.getByRole('button', { name: 'Xoá đoạn chat Đi làm mặc gì' }).click();
  await history.getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(history.getByText('Đi làm mặc gì')).toHaveCount(0);
  await expect(history.getByText('Đi biển mặc gì')).toBeVisible();
  await expect(page.getByText('Hỏi stylist của bạn')).toBeVisible();
  await expect(page.getByText('Hôm qua mặc gì?')).toHaveCount(0);
  expect(deleted).toEqual([oldChat._id]);
  expect(errors).toEqual([]);
});

test('chat load failures can be retried and do not block the rest of the page', async ({ page }) => {
  let failList = true;
  let failOpen = true;
  const { errors } = await setup(page, async ({ path, reply }) => {
    if (path === '/suggestions/chats') {
      await (failList
        ? reply({ success: false, message: 'Không tải được lịch sử chat.' }, 503)
        : reply({ success: true, data: [oldChat] }));
      return true;
    }
    if (path === `/suggestions/chats/${oldChat._id}`) {
      await (failOpen
        ? reply({ success: false, message: 'Không mở được đoạn chat.' }, 503)
        : reply({ success: true, data: [userMessage] }));
      return true;
    }
    return false;
  });
  await page.goto('/suggest');
  await expect(page.getByText('Lời khuyên từ stylist.')).toBeVisible();
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await expect(page.getByText('Không tải được lịch sử chat.')).toBeVisible();

  failList = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByRole('button', { name: /^Đi làm mặc gì/ }).click();
  await expect(page.getByText('Không mở được đoạn chat.')).toBeVisible();

  failOpen = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Hôm qua mặc gì?')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an unavailable stylist shows the reason and adds nothing to the history bar', async ({ page }) => {
  let posts = 0;
  const { errors } = await setup(page, async ({ path, reply }) => {
    if (path !== '/suggestions/chat') return false;
    posts++;
    await reply({ success: false, message: 'Stylist AI đang tạm nghỉ.' }, 503);
    return true;
  });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  await page.getByLabel('Tin nhắn cho stylist').fill('Chào bạn');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Stylist AI đang tạm nghỉ.')).toBeVisible();
  await expect(page.getByText('Chào bạn', { exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có đoạn chat nào.')).toBeVisible();

  await page.getByLabel('Tin nhắn cho stylist').fill('Thử lại nhé');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect.poll(() => posts).toBe(2);
  expect(errors).toEqual([]);
});

test('the history bar works as a drawer on mobile @mobile', async ({ page }) => {
  const { errors } = await setup(page, async ({ path, reply }) => {
    if (path === '/suggestions/chats') { await reply({ success: true, data: [oldChat] }); return true; }
    if (path === `/suggestions/chats/${oldChat._id}`) { await reply({ success: true, data: [userMessage] }); return true; }
    return false;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/suggest');
  await page.getByRole('button', { name: 'Hỏi stylist' }).click();
  const history = page.getByRole('complementary', { name: 'Lịch sử chat' });
  await expect(history).toBeHidden();
  await expect(page.getByLabel('Tin nhắn cho stylist')).toBeVisible();

  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click();
  await expect(history).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/suggest-history-mobile.png', fullPage: true });

  await history.getByRole('button', { name: /^Đi làm mặc gì/ }).click();
  await expect(history).toBeHidden();
  await expect(page.getByText('Hôm qua mặc gì?')).toBeVisible();
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
