import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createTestMongo, stopTestMongo } from './testMongo.mjs';

Object.assign(process.env, {
  NODE_ENV: 'test', JWT_SECRET: 'stylist-test-only', MONGO_URI: 'mongodb://127.0.0.1:1/unused',
  GEMINI_API_KEY: 'test-gemini-key', OPENWEATHER_API_KEY: 'test-weather-key',
});
const { default: app } = await import('../src/app.ts');
const { User } = await import('../src/models/User.ts');
const { ClothingItem } = await import('../src/models/ClothingItem.ts');
const { StylistMessage } = await import('../src/models/StylistMessage.ts');
const { StylistConversation } = await import('../src/models/StylistConversation.ts');

const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=', 'base64');
const owner ='aaaaaaaaaaaaaaaaaaaaaaaa', limited = 'bbbbbbbbbbbbbbbbbbbbbbbb', emptyOwner = 'cccccccccccccccccccccccc';
const token = (sub) => jwt.sign({ sub }, process.env.JWT_SECRET);
const realFetch = globalThis.fetch;
let mongo, server, base, redTop, whiteTop, jeans, shoes, bag;
/** Hang doi cau tra loi Gemini gia lap; null = goi that bai. */
let geminiReplies = [];
let geminiCalls = [];

const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function request(path, options = {}, actor = owner) {
  const result = await realFetch(base + path, {
    ...options,
    headers: { Authorization: `Bearer ${token(actor)}`, 'Content-Type': 'application/json', ...options.headers },
  });
  return { status: result.status, body: await result.json() };
}
const chat = (body, actor) => request('/suggestions/chat', { method: 'POST', body: JSON.stringify(body) }, actor);

before(async () => {
  mongo = await createTestMongo();
  await mongoose.connect(mongo.getUri());
  await User.create([owner, limited, emptyOwner].map((_id, i) => ({
    _id, email: `user${i}@example.test`, password: 'password123', displayName: `User ${i}`, isVerified: true,
  })));
  const piece = (name, category, color, extra = {}) => ({
    owner, name, category, colors: [color], seasons: ['summer'],
    imageUrl: 'https://example.test/a.png', originalImageUrl: 'https://example.test/a.png', ...extra,
  });
  [redTop, whiteTop, jeans, shoes, bag] = await ClothingItem.create([
    piece('Áo đỏ', 'top', '#ff0000', { styles: ['casual'] }),
    piece('Áo trắng', 'top', '#ffffff'),
    piece('Quần jeans', 'bottom', '#5b7db1'),
    piece('Giày đen', 'shoes', '#000000'),
    piece('Túi đen', 'bag', '#000000'),
  ]);
  await ClothingItem.create(piece('Áo đông', 'top', '#000000', { seasons: ['winter'] }));

  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes('openweathermap.org')) {
      return respond(200, {
        name: 'Hanoi', main: { temp: 27, feels_like: 29, humidity: 70 },
        weather: [{ main: 'Clear', description: 'trời quang', icon: '01d' }],
      });
    }
    if (target.includes('generativelanguage.googleapis.com')) {
      geminiCalls.push({ url: target, headers: init.headers, body: JSON.parse(init.body) });
      const reply = geminiReplies.shift();
      if (reply === null || reply === undefined) return respond(503, { error: { message: 'unavailable' } });
      return respond(200, { candidates: [{ content: { parts: [{ text: reply }] } }] });
    }
    return realFetch(url, init);
  };

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 180000 });

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await stopTestMongo(mongo);
});

beforeEach(async () => {
  geminiReplies = [];
  geminiCalls = [];
  await Promise.all([StylistMessage.deleteMany({}), StylistConversation.deleteMany({})]);
});

test('plain suggestion keeps its response shape and asks the AI once', async () => {
  geminiReplies = ['Bộ này rất hợp với bạn.'];
  const { status, body } = await request('/suggestions');
  assert.equal(status, 200);
  const { weather, suggestion, options, advice, adviceSource, anchor } = body.data;
  assert.equal(weather.city, 'Hanoi');
  assert.deepEqual(suggestion, options[0]);
  assert.ok(suggestion.top && suggestion.bottom && suggestion.shoes);
  assert.equal(advice, 'Bộ này rất hợp với bạn.');
  assert.equal(adviceSource, 'ai');
  assert.equal(anchor, undefined);

  assert.equal(geminiCalls.length, 1);
  const [call] = geminiCalls;
  assert.match(call.url, /\/models\/gemini-flash-lite-latest:generateContent$/);
  assert.ok(!call.url.includes('test-gemini-key'));
  assert.equal(call.headers['x-goog-api-key'], 'test-gemini-key');
  assert.match(call.body.contents[0].parts[0].text, /Quần jeans \(quần, màu xanh dương\)/);
});

test('when the AI fails the suggestion still works with rule advice', async () => {
  const { status, body } = await request('/suggestions');
  assert.equal(status, 200);
  assert.equal(body.data.adviceSource, 'rule');
  assert.match(body.data.advice, /27°C/);
});

test('pinned suggestions still return the anchor details', async () => {
  geminiReplies = ['Áo đỏ nổi bật.'];
  const { status, body } = await request(`/suggestions?anchor=${redTop._id}`);
  assert.equal(status, 200);
  assert.equal(body.data.anchor.item._id, String(redTop._id));
  assert.equal(body.data.anchor.isDormant, false);
  assert.deepEqual(body.data.anchor.missing, []);
  for (const option of body.data.options) assert.equal(option.top._id, String(redTop._id));
  assert.match(geminiCalls[0].body.contents[0].parts[0].text, /xoay quanh món "Áo đỏ"/);

  const unknown = await request('/suggestions?anchor=dddddddddddddddddddddddd');
  assert.equal(unknown.status, 404);
});

test('season and color filters apply through the API', async () => {
  const { body } = await request('/suggestions?seasons=summer&colorGroups=red');
  assert.equal(body.data.seasonWarning, undefined);
  for (const option of body.data.options) assert.equal(option.top._id, String(redTop._id));

  const winter = await request('/suggestions?seasons=winter');
  assert.match(winter.body.data.seasonWarning, /mùa đông/);
  assert.ok(winter.body.data.missing.some((m) => m.includes('hợp mùa đã chọn')));

  assert.equal((await request('/suggestions?seasons=rainy')).status, 400);
  assert.equal((await request('/suggestions?colorGroups=gold')).status, 400);
  assert.equal((await request('/suggestions?occasion=beach')).status, 400);
});

test('shuffling never calls the AI and skips outfits already shown', async () => {
  const first = await request('/suggestions?shuffle=1');
  assert.equal(first.status, 200);
  assert.equal(first.body.data.adviceSource, 'rule');
  assert.equal(geminiCalls.length, 0);

  const seen = first.body.data.options[0].key;
  const next = await request(`/suggestions?shuffle=1&seen=${seen},not-a-key`);
  assert.equal(next.status, 200);
  assert.ok(next.body.data.options.every((option) => option.key !== seen));
});

test('chat requires a session and a valid message', async () => {
  assert.equal((await realFetch(`${base}/suggestions/chat`, { method: 'POST' })).status, 401);
  assert.equal((await chat({ message: '   ' })).status, 400);
  assert.equal((await chat({ message: 'x'.repeat(501) })).status, 400);
  assert.equal(geminiCalls.length, 0);
});

test('chat picks real wardrobe items from the parsed request', async () => {
  geminiReplies = [
    JSON.stringify({ intent: 'outfit', occasion: 'date', colorGroups: ['red'], seasons: ['summer'], styles: ['casual'] }),
    'Áo đỏ sẽ là điểm nhấn của bạn.',
  ];
  const { status, body } = await chat({ message: 'Đi hẹn hò, muốn mặc màu đỏ', occasion: 'daily' });
  assert.equal(status, 200);
  assert.equal(body.data.message.text, 'Áo đỏ sẽ là điểm nhấn của bạn.');
  assert.equal(body.data.message.role, 'stylist');
  assert.equal(body.data.message.source, 'ai');
  assert.equal(body.data.message.occasion, 'date');
  assert.equal(body.data.message.weather.temp, 27);
  const pickedIds = body.data.message.items.map((item) => item._id);
  assert.ok(pickedIds.includes(String(redTop._id)));
  assert.ok(pickedIds.includes(String(jeans._id)));
  assert.equal(body.data.message.items[0].name.length > 0, true);
  assert.equal(geminiCalls.length, 2);
  assert.equal(geminiCalls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.match(geminiCalls[1].body.contents[0].parts[0].text, /Áo đỏ \(áo, màu đỏ, phong cách/);
});

const openChat = (id, actor) => request(`/suggestions/chats/${id}`, {}, actor);

test('chat history reaches the AI and a different outfit avoids the shown one', async () => {
  const intent = JSON.stringify({ intent: 'outfit', wantsDifferent: true });
  geminiReplies = [JSON.stringify({ intent: 'outfit' }), 'Bộ đầu tiên.'];
  const first = await chat({ message: 'Chọn giúp mình một bộ' });
  const seen = first.body.data.message.outfitKey;
  const conversationId = first.body.data.conversation._id;
  assert.match(seen, /^[0-9a-f]{10}$/);

  geminiCalls = [];
  geminiReplies = [intent, 'Đây là bộ khác.'];
  const next = await chat({ message: 'Đổi bộ khác', conversationId });
  assert.equal(next.status, 200);
  assert.equal(next.body.data.conversation._id, conversationId);
  assert.notEqual(next.body.data.message.outfitKey, seen);
  const prompt = geminiCalls[0].body.contents[0].parts[0].text;
  assert.match(prompt, /Người dùng: Chọn giúp mình một bộ/);
  assert.match(prompt, /Stylist: Bộ đầu tiên\./);
});

test('each new chat is its own conversation with its own memory', async () => {
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Một.' })];
  const first = await chat({ message: 'Đoạn thứ nhất\nDòng thứ hai' });
  geminiCalls = [];
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Hai.' })];
  const second = await chat({ message: 'x'.repeat(80) });

  assert.notEqual(first.body.data.conversation._id, second.body.data.conversation._id);
  assert.equal(first.body.data.conversation.title, 'Đoạn thứ nhất');
  assert.equal(second.body.data.conversation.title, 'x'.repeat(60));
  assert.doesNotMatch(geminiCalls[0].body.contents[0].parts[0].text, /Đoạn thứ nhất/);
});

test('the list shows the most recently used chat first and opens its messages', async () => {
  geminiReplies = [JSON.stringify({ intent: 'outfit' }), 'Bộ đầu tiên.'];
  const older = await chat({ message: 'Chọn giúp mình một bộ' });
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Có.' })];
  const newer = await chat({ message: 'Đoạn khác' });
  const olderId = older.body.data.conversation._id;

  assert.deepEqual((await request('/suggestions/chats')).body.data.map((c) => c.title), ['Đoạn khác', 'Chọn giúp mình một bộ']);

  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Có chứ.' })];
  await chat({ message: 'Áo đỏ dễ phối không?', conversationId: olderId });
  const list = (await request('/suggestions/chats')).body.data;
  assert.deepEqual(list.map((c) => c._id), [olderId, newer.body.data.conversation._id]);
  assert.ok(list[0].lastMessageAt);

  const { status, body } = await openChat(olderId);
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((m) => m.text), ['Chọn giúp mình một bộ', 'Bộ đầu tiên.', 'Áo đỏ dễ phối không?', 'Có chứ.']);
  assert.deepEqual(body.data.map((m) => m.role), ['user', 'stylist', 'user', 'stylist']);
  assert.ok(body.data[1].items[0].imageUrl);
  assert.deepEqual(body.data[3].items, []);
});

test('conversations are private to their owner', async () => {
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Riêng tư.' })];
  const mine = await chat({ message: 'Của mình' });
  const id = mine.body.data.conversation._id;

  assert.deepEqual((await request('/suggestions/chats', {}, emptyOwner)).body.data, []);
  assert.equal((await openChat(id, emptyOwner)).status, 404);
  assert.equal((await request(`/suggestions/chats/${id}`, { method: 'DELETE' }, emptyOwner)).status, 404);
  assert.equal((await chat({ message: 'Chen vào', conversationId: id }, emptyOwner)).status, 404);
  assert.equal((await openChat('khong-hop-le')).status, 404);
  assert.equal((await chat({ message: 'Xin chào', conversationId: 'khong-hop-le' })).status, 400);
  assert.equal((await realFetch(`${base}/suggestions/chats`)).status, 401);
  assert.equal(await StylistMessage.countDocuments({ conversation: id }), 2);
});

test('a failed chat leaves no empty conversation or half saved message', async () => {
  assert.equal((await chat({ message: 'Chọn đồ giúp mình' })).status, 503);
  geminiReplies = [JSON.stringify({ intent: 'outfit' })];
  assert.equal((await chat({ message: 'Chọn đồ giúp mình' }, emptyOwner)).status, 400);
  assert.equal(await StylistMessage.countDocuments(), 0);
  assert.equal(await StylistConversation.countDocuments(), 0);
});

test('saved chats drop deleted items but keep the message', async () => {
  const conversation = await StylistConversation.create({ owner, title: 'Bộ cũ' });
  const temporary = await ClothingItem.create({
    owner, name: 'Áo tạm', category: 'top', colors: ['#ffffff'],
    imageUrl: 'https://example.test/t.png', originalImageUrl: 'https://example.test/t.png',
  });
  await StylistMessage.create({
    owner, conversation: conversation._id, role: 'stylist', text: 'Bộ cũ', source: 'ai', items: [temporary._id, jeans._id],
  });
  await temporary.deleteOne();

  const { body } = await openChat(conversation._id);
  assert.equal(body.data[0].text, 'Bộ cũ');
  assert.deepEqual(body.data[0].items.map((item) => item._id), [String(jeans._id)]);
});

test('each chat keeps its newest messages and each user their newest chats', async () => {
  const conversation = await StylistConversation.create({ owner, title: 'Dài' });
  await StylistMessage.insertMany(Array.from({ length: 100 }, (_, i) => ({
    owner, conversation: conversation._id, role: 'user', text: `Tin ${i}`,
  })));
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Tin mới nhất' })];
  await chat({ message: 'Hỏi thêm', conversationId: String(conversation._id) });
  const { body } = await openChat(conversation._id);
  assert.equal(body.data.length, 100);
  assert.equal(body.data.at(-1).text, 'Tin mới nhất');
  assert.equal(await StylistMessage.countDocuments({ conversation: conversation._id, text: 'Tin 0' }), 0);

  const old = await StylistConversation.insertMany(Array.from({ length: 50 }, (_, i) => ({
    owner, title: `Đoạn ${i}`, lastMessageAt: new Date(2020, 0, i + 1),
  })));
  await StylistMessage.create({ owner, conversation: old[0]._id, role: 'user', text: 'Cũ nhất' });
  const other = await StylistConversation.create({ owner: emptyOwner, title: 'Của người khác', lastMessageAt: new Date(2000, 0, 1) });
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Ok' })];
  await chat({ message: 'Đoạn mới' });

  assert.equal(await StylistConversation.countDocuments({ owner }), 50);
  assert.equal(await StylistConversation.countDocuments({ _id: old[0]._id }), 0);
  assert.equal(await StylistMessage.countDocuments({ conversation: old[0]._id }), 0);
  assert.equal(await StylistConversation.countDocuments({ _id: other._id }), 1);
});

test('deleting a chat removes it and only its own messages', async () => {
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Một.' })];
  const first = await chat({ message: 'Xoá đoạn này' });
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Hai.' })];
  const second = await chat({ message: 'Giữ đoạn này' });
  const id = first.body.data.conversation._id;

  assert.equal((await request(`/suggestions/chats/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await openChat(id)).status, 404);
  assert.equal(await StylistMessage.countDocuments({ conversation: id }), 0);
  assert.deepEqual((await request('/suggestions/chats')).body.data.map((c) => c.title), ['Giữ đoạn này']);
  assert.equal((await openChat(second.body.data.conversation._id)).body.data.length, 2);
});

test('chat answers general questions without building an outfit', async () => {
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Váy đỏ hợp giày đen.' })];
  const { status, body } = await chat({ message: 'Váy đỏ đi với giày gì?' }, emptyOwner);
  assert.equal(status, 200);
  assert.equal(body.data.message.text, 'Váy đỏ hợp giày đen.');
  assert.deepEqual(body.data.message.items, []);
  assert.equal(geminiCalls.length, 1);
});

test('chat reports an empty wardrobe and an unavailable AI clearly', async () => {
  geminiReplies = [JSON.stringify({ intent: 'outfit' })];
  const empty = await chat({ message: 'Chọn đồ giúp mình' }, emptyOwner);
  assert.equal(empty.status, 400);
  assert.match(empty.body.message, /Tủ đồ/);

  const down = await chat({ message: 'Chọn đồ giúp mình' });
  assert.equal(down.status, 503);
  assert.match(down.body.message, /Xáo trộn/);

  geminiReplies = ['đây không phải json'];
  assert.equal((await chat({ message: 'Chọn đồ giúp mình' })).status, 503);
});

test('if only the final explanation fails the outfit still comes back', async () => {
  geminiReplies = [JSON.stringify({ intent: 'outfit' }), null];
  const { status, body } = await chat({ message: 'Chọn đồ giúp mình' });
  assert.equal(status, 200);
  assert.equal(body.data.message.source, 'rule');
  assert.ok(body.data.message.items.length > 0);
});

test('chat is limited per user and other users are not affected', async () => {
  let last;
  for (let i = 0; i < 21; i++) {
    geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Ok' })];
    last = await chat({ message: 'Xin chào' }, limited);
  }
  assert.equal(last.status, 429);
  assert.match(last.body.message, /stylist/);

  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Ok' })];
  assert.equal((await chat({ message: 'Xin chào' }, emptyOwner)).status, 200);
});

const autoTag = (bytes, actor = owner, type = 'image/png') => {
  const form = new FormData();
  if (bytes) form.append('image', new Blob([bytes], { type }), 'item.png');
  return realFetch(`${base}/items/auto-tag`, {
    method: 'POST', body: form, headers: { Authorization: `Bearer ${token(actor)}` },
  });
};

test('auto-tag sends the image to the AI and returns only valid tags', async () => {
  const before = await ClothingItem.countDocuments();
  geminiReplies = [JSON.stringify({ styles: ['casual', 'pirate'], seasons: ['summer', 'summer'], occasions: ['daily'] })];
  const response = await autoTag(pngBytes);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { styles: ['casual'], seasons: ['summer'], occasions: ['daily'] });

  const [part] = geminiCalls[0].body.contents[0].parts;
  assert.equal(part.inlineData.mimeType, 'image/png');
  assert.equal(part.inlineData.data, pngBytes.toString('base64'));
  assert.equal(geminiCalls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(await ClothingItem.countDocuments(), before);
});

test('auto-tag rejects bad input before calling the AI', async () => {
  assert.equal((await realFetch(`${base}/items/auto-tag`, { method: 'POST' })).status, 401);
  assert.equal((await autoTag(null)).status, 400);
  assert.equal((await autoTag(Buffer.from('not an image'))).status, 400);
  assert.equal((await autoTag(Buffer.from('not an image'), owner, 'text/plain')).status, 400);
  assert.equal(geminiCalls.length, 0);
});

test('auto-tag reports when the AI has nothing usable', async () => {
  for (const reply of [null, 'không phải json', '{"styles":["pirate"],"seasons":[],"occasions":[]}']) {
    geminiReplies = [reply];
    const response = await autoTag(pngBytes);
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /thủ công/);
  }
});

test('auto-tag is limited per user', async () => {
  let status;
  for (let i = 0; i < 31; i++) {
    geminiReplies = [JSON.stringify({ styles: ['casual'], seasons: [], occasions: [] })];
    status = (await autoTag(pngBytes, limited)).status;
  }
  assert.equal(status, 429);
  geminiReplies = [JSON.stringify({ styles: ['casual'], seasons: [], occasions: [] })];
  assert.equal((await autoTag(pngBytes, emptyOwner)).status, 200);
});

test('other suggestion routes are unchanged', async () => {
  const ranked = await request('/suggestions/ranked?category=top');
  assert.equal(ranked.status, 200);
  assert.ok(ranked.body.data.items.length >= 3);
  const weather = await request('/suggestions/weather');
  assert.equal(weather.status, 200);
  assert.equal(weather.body.data.temp, 27);
  assert.ok(whiteTop && shoes && bag);
});
