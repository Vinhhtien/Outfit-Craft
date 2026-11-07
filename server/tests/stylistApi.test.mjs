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

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa', limited = 'bbbbbbbbbbbbbbbbbbbbbbbb', emptyOwner = 'cccccccccccccccccccccccc';
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

beforeEach(() => {
  geminiReplies = [];
  geminiCalls = [];
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
  assert.equal((await chat({ message: 'hi', seen: ['../bad'] })).status, 400);
  assert.equal(geminiCalls.length, 0);
});

test('chat picks real wardrobe items from the parsed request', async () => {
  geminiReplies = [
    JSON.stringify({ intent: 'outfit', occasion: 'date', colorGroups: ['red'], seasons: ['summer'], styles: ['casual'] }),
    'Áo đỏ sẽ là điểm nhấn của bạn.',
  ];
  const { status, body } = await chat({ message: 'Đi hẹn hò, muốn mặc màu đỏ', occasion: 'daily' });
  assert.equal(status, 200);
  assert.equal(body.data.reply, 'Áo đỏ sẽ là điểm nhấn của bạn.');
  assert.equal(body.data.source, 'ai');
  assert.equal(body.data.occasion, 'date');
  assert.equal(body.data.suggestion.top._id, String(redTop._id));
  assert.equal(body.data.suggestion.bottom._id, String(jeans._id));
  assert.equal(geminiCalls.length, 2);
  assert.equal(geminiCalls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.match(geminiCalls[1].body.contents[0].parts[0].text, /Áo đỏ \(áo, màu đỏ, phong cách/);
});

test('chat history reaches the AI and a different outfit avoids the shown one', async () => {
  const intent = JSON.stringify({ intent: 'outfit', wantsDifferent: true });
  geminiReplies = [JSON.stringify({ intent: 'outfit' }), 'Bộ đầu tiên.'];
  const first = await chat({ message: 'Chọn giúp mình một bộ' });
  const seen = first.body.data.suggestion.key;

  geminiCalls = [];
  geminiReplies = [intent, 'Đây là bộ khác.'];
  const next = await chat({
    message: 'Đổi bộ khác',
    history: [{ role: 'user', text: 'Chọn giúp mình một bộ' }, { role: 'stylist', text: 'Bộ đầu tiên.' }],
    seen: [seen],
  });
  assert.equal(next.status, 200);
  assert.notEqual(next.body.data.suggestion.key, seen);
  assert.match(geminiCalls[0].body.contents[0].parts[0].text, /Stylist: Bộ đầu tiên\./);
});

test('chat answers general questions without building an outfit', async () => {
  geminiReplies = [JSON.stringify({ intent: 'question', reply: 'Váy đỏ hợp giày đen.' })];
  const { status, body } = await chat({ message: 'Váy đỏ đi với giày gì?' }, emptyOwner);
  assert.equal(status, 200);
  assert.equal(body.data.reply, 'Váy đỏ hợp giày đen.');
  assert.equal(body.data.suggestion, undefined);
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
  assert.equal(body.data.source, 'rule');
  assert.ok(body.data.suggestion.top);
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

test('other suggestion routes are unchanged', async () => {
  const ranked = await request('/suggestions/ranked?category=top');
  assert.equal(ranked.status, 200);
  assert.ok(ranked.body.data.items.length >= 3);
  const weather = await request('/suggestions/weather');
  assert.equal(weather.status, 200);
  assert.equal(weather.body.data.temp, 27);
  assert.ok(whiteTop && shoes && bag);
});
