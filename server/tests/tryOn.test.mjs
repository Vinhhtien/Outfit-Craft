import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createTestMongo, stopTestMongo } from './testMongo.mjs';

Object.assign(process.env, {
  NODE_ENV: 'test', JWT_SECRET: 'tryon-test-only', MONGO_URI: 'mongodb://127.0.0.1:1/unused',
  GEMINI_API_KEY: 'test-gemini-key', DECART_API_KEY: 'dct_test_key', CLIENT_ORIGIN: 'http://localhost:3000',
  TRYON_MAX_SESSION_SECONDS: '60', TRYON_DAILY_SECONDS: '100',
});
const { default: app } = await import('../src/app.ts');
const { User } = await import('../src/models/User.ts');
const { ClothingItem } = await import('../src/models/ClothingItem.ts');
const { TryOnSession } = await import('../src/models/TryOnSession.ts');
const { TryOnSnapshot } = await import('../src/models/TryOnSnapshot.ts');
const { ImageCleanup } = await import('../src/models/ImageCleanup.ts');
const { retryImageCleanup } = await import('../src/services/upload.service.ts');
const { cloudinary } = await import('../src/config/cloudinary.ts');
const { composeTryOnPrompt, parseGarmentDescription, ruleGarmentDescription } = await import('../src/services/tryOnPrompt.service.ts');
const { recordTryOnHeartbeat, getTryOnQuota, tryOnDayKey } = await import('../src/services/tryOnSession.service.ts');

const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=', 'base64');
const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa', stranger = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const authHeader = (sub) => `Bearer ${jwt.sign({ sub }, process.env.JWT_SECRET)}`;
const realFetch = globalThis.fetch;
const CLOUD_URL = 'https://res.cloudinary.com/demo/image/upload/v1/outfitcraft/a/items/top.png';
const GOOD = 'a navy blue cable-knit wool sweater with a ribbed crew neck, long sleeves and a relaxed fit';

let mongo, server, base, top, tokenRequests, geminiCalls, geminiReply;
const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function call(path, options = {}, actor = owner) {
  const isForm = options.body instanceof FormData;
  const result = await realFetch(base + path, {
    ...options,
    headers: { Authorization: authHeader(actor), ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
  });
  return { status: result.status, body: await result.json() };
}
const post = (path, body, actor) => call(path, { method: 'POST', ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }, actor);

before(async () => {
  mongo = await createTestMongo();
  await mongoose.connect(mongo.getUri());
  await TryOnSession.init();
  await User.create([owner, stranger].map((_id, i) => ({
    _id, email: `tryon${i}@example.test`, password: 'password123', displayName: `User ${i}`, isVerified: true,
  })));
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes('/v1/client/tokens')) {
      tokenRequests.push({ body: JSON.parse(init.body), headers: init.headers });
      return respond(200, { apiKey: 'ek_short_lived', expiresAt: '2030-01-01T00:00:00Z' });
    }
    if (target.startsWith('https://res.cloudinary.com/')) return new Response(pngBytes, { status: 200 });
    if (target.includes('generativelanguage.googleapis.com')) {
      geminiCalls.push(JSON.parse(init.body));
      return geminiReply === null ? respond(503, {}) : respond(200, { candidates: [{ content: { parts: [{ text: geminiReply }] } }] });
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
  tokenRequests = []; geminiCalls = []; geminiReply = JSON.stringify({ description: GOOD });
  await Promise.all([TryOnSession.deleteMany({}), TryOnSnapshot.deleteMany({}), ClothingItem.deleteMany({})]);
  top = await ClothingItem.create({
    owner, name: 'Áo len', category: 'top', kind: 'sweater', colors: ['#1d3a8a'], imageUrl: CLOUD_URL, originalImageUrl: CLOUD_URL,
  });
});

describe('prompt', () => {
  test('uses the substitute pattern for worn garments and add for accessories', () => {
    assert.equal(composeTryOnPrompt('bottom', 'a pair of black jeans'), 'Substitute the current bottoms with a pair of black jeans.');
    assert.equal(composeTryOnPrompt('dress', 'a red midi dress'), 'Substitute the current outfit with a red midi dress.');
    assert.equal(composeTryOnPrompt('bag', 'a tan leather bag'), 'Add a tan leather bag to the outfit.');
  });

  test('rejects output that is not a usable English description', () => {
    assert.equal(parseGarmentDescription('not json'), null);
    assert.equal(parseGarmentDescription(JSON.stringify({ description: 'Áo len màu xanh rất đẹp và ấm áp cho mùa đông lạnh giá' })), null);
    assert.equal(parseGarmentDescription(JSON.stringify({ description: 'a shirt' })), null);
    assert.deepEqual(parseGarmentDescription(JSON.stringify({ description: `A${GOOD.slice(1)}.`, currentGarment: 'Black T-Shirt with a logo' })), { description: GOOD });
  });

  test('rule fallback names the piece in English', () => {
    assert.equal(ruleGarmentDescription({ category: 'top', kind: 'hoodie', colors: ['#ff8c00'] }), 'an orange hoodie');
    assert.equal(ruleGarmentDescription({ category: 'bottom', kind: 'jeans', colors: ['#1d3a8a'] }), 'a pair of blue jeans');
    assert.equal(ruleGarmentDescription({ category: 'shoes', colors: [] }), 'a pair of shoes');
  });

  test('calls Gemini once per image, then serves the cached description', async () => {
    const first = await post(`/try-on/items/${top._id}/prompt`);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.data, { prompt: `Substitute the current top with ${GOOD}.`, source: 'ai' });
    const second = await post(`/try-on/items/${top._id}/prompt`);
    assert.equal(second.body.data.source, 'cache');
    assert.equal(second.body.data.prompt, first.body.data.prompt);
    assert.equal(geminiCalls.length, 1);
  });

  test('a replaced image is described again', async () => {
    await post(`/try-on/items/${top._id}/prompt`);
    await ClothingItem.updateOne({ _id: top._id }, { $set: { imageUrl: `${CLOUD_URL}?v=2` } });
    assert.equal((await post(`/try-on/items/${top._id}/prompt`)).body.data.source, 'ai');
    assert.equal(geminiCalls.length, 2);
  });

  test('a camera frame names the current garment but never reaches the cache', async () => {
    geminiReply = JSON.stringify({ description: GOOD, currentGarment: 'hoodie' });
    const form = new FormData();
    form.append('frame', new Blob([pngBytes], { type: 'image/png' }), 'frame.png');
    const withFrame = await post(`/try-on/items/${top._id}/prompt`, form);
    assert.equal(withFrame.body.data.prompt, `Substitute the current hoodie with ${GOOD}.`);
    assert.equal(geminiCalls[0].contents[0].parts.filter((part) => part.inlineData).length, 2);
    const later = await post(`/try-on/items/${top._id}/prompt`);
    assert.equal(later.body.data.prompt, `Substitute the current top with ${GOOD}.`);
  });

  test('falls back without caching when Gemini fails', async () => {
    geminiReply = null;
    const result = await post(`/try-on/items/${top._id}/prompt`);
    assert.deepEqual(result.body.data, { prompt: 'Substitute the current top with a blue knit sweater.', source: 'rule' });
    assert.equal((await ClothingItem.findById(top._id).select('+tryOnPrompt')).tryOnPrompt, undefined);
  });

  test('never exposes the cache on item responses, and blocks other users', async () => {
    await post(`/try-on/items/${top._id}/prompt`);
    assert.equal((await call(`/items/${top._id}`)).body.data.tryOnPrompt, undefined);
    assert.equal((await post(`/try-on/items/${top._id}/prompt`, undefined, stranger)).status, 404);
  });

  test('only downloads garment images from Cloudinary', async () => {
    await ClothingItem.updateOne({ _id: top._id }, { $set: { imageUrl: 'http://169.254.169.254/latest/meta-data' } });
    assert.equal((await post(`/try-on/items/${top._id}/prompt`)).body.data.source, 'rule');
    assert.equal(geminiCalls.length, 0);
  });
});

describe('session limits', () => {
  test('requires sign-in', async () => {
    const result = await realFetch(`${base}/try-on/quota`);
    assert.equal(result.status, 401);
  });

  test('mints a scoped token capped to what the session has left', async () => {
    const { body } = await post('/try-on/sessions');
    assert.equal(body.data.maxSeconds, 60);
    const token = await post(`/try-on/sessions/${body.data.sessionId}/token`);
    assert.deepEqual(token.body.data, { apiKey: 'ek_short_lived', expiresAt: '2030-01-01T00:00:00Z' });
    assert.deepEqual(tokenRequests[0].body, {
      expiresIn: 60,
      allowedModels: ['lucy-vton-latest', 'lucy-vton-3.6'],
      allowedOrigins: ['http://localhost:3000'],
      constraints: { realtime: { maxSessionDuration: 60 } },
    });
    assert.ok(!JSON.stringify(token.body).includes('dct_test_key'));
  });

  test('other users cannot use a session', async () => {
    const { body } = await post('/try-on/sessions');
    assert.equal((await post(`/try-on/sessions/${body.data.sessionId}/token`, undefined, stranger)).status, 404);
  });

  test('does not bill connection time, then bills from the first live heartbeat', async () => {
    const { body } = await post('/try-on/sessions');
    const t0 = new Date();
    assert.equal((await recordTryOnHeartbeat(owner, body.data.sessionId, false, t0)).usedSeconds, 0);
    await recordTryOnHeartbeat(owner, body.data.sessionId, true, t0);
    const beat = await recordTryOnHeartbeat(owner, body.data.sessionId, true, new Date(t0.getTime() + 20_000));
    assert.deepEqual(beat, { active: true, usedSeconds: 20, remainingSeconds: 40 });
    assert.equal((await getTryOnQuota(owner, new Date(t0.getTime() + 20_000))).usedSeconds, 20);
  });

  test('the session stops at its cap and later heartbeats report it as over', async () => {
    const { body } = await post('/try-on/sessions');
    const t0 = new Date();
    await recordTryOnHeartbeat(owner, body.data.sessionId, true, t0);
    const over = await recordTryOnHeartbeat(owner, body.data.sessionId, true, new Date(t0.getTime() + 61_000));
    assert.deepEqual(over, { active: false, usedSeconds: 60, remainingSeconds: 0 });
    assert.equal((await TryOnSession.findById(body.data.sessionId)).endReason, 'limit');
    assert.equal((await post(`/try-on/sessions/${body.data.sessionId}/token`)).body.code, 'TRYON_SESSION_OVER');
  });

  test('a session cannot outlast what is left of the day', async () => {
    await TryOnSession.create({ owner, dayKey: tryOnDayKey(new Date()), status: 'ended', maxSeconds: 60, usedSeconds: 75, lastSeenAt: new Date() });
    assert.equal((await post('/try-on/sessions')).body.data.maxSeconds, 25);
  });

  test('refuses a new session once the daily total is spent', async () => {
    await TryOnSession.create({ owner, dayKey: tryOnDayKey(new Date()), status: 'ended', maxSeconds: 60, usedSeconds: 95, lastSeenAt: new Date() });
    const result = await post('/try-on/sessions');
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'TRYON_QUOTA_EXCEEDED');
  });

  test('yesterday does not count', async () => {
    await TryOnSession.create({ owner, dayKey: '2020-01-01', status: 'ended', maxSeconds: 60, usedSeconds: 95, lastSeenAt: new Date() });
    assert.equal((await post('/try-on/sessions')).status, 201);
  });

  test('ending twice is safe and charges only the time used', async () => {
    const { body } = await post('/try-on/sessions');
    await TryOnSession.updateOne({ _id: body.data.sessionId }, { $set: { activatedAt: new Date(Date.now() - 12_000) } });
    const first = await post(`/try-on/sessions/${body.data.sessionId}/end`);
    assert.ok(first.body.data.usedSeconds >= 12 && first.body.data.usedSeconds <= 14);
    const second = await post(`/try-on/sessions/${body.data.sessionId}/end`);
    assert.equal(second.body.data.usedSeconds, first.body.data.usedSeconds);
  });

  test('a session that goes silent is closed and charged up to the silence window', async () => {
    const { body } = await post('/try-on/sessions');
    const t0 = new Date(Date.now() - 300_000);
    await TryOnSession.updateOne({ _id: body.data.sessionId }, { $set: { activatedAt: t0, lastSeenAt: new Date(t0.getTime() + 10_000) } });
    const quota = await getTryOnQuota(owner);
    assert.equal(quota.usedSeconds, 40);
    assert.equal((await TryOnSession.findById(body.data.sessionId)).endReason, 'abandoned');
  });

  test('opening a session in a new tab ends the old one', async () => {
    const first = await post('/try-on/sessions');
    await post('/try-on/sessions');
    const beat = await post(`/try-on/sessions/${first.body.data.sessionId}/heartbeat`, { live: true });
    assert.equal(beat.body.data.active, false);
    assert.equal(await TryOnSession.countDocuments({ owner, status: 'active' }), 1);
  });

  test('a provider failure does not leak details', async () => {
    const { body } = await post('/try-on/sessions');
    const saved = globalThis.fetch;
    globalThis.fetch = async (url, init) => String(url).includes('/v1/client/tokens')
      ? new Response('secret upstream detail', { status: 500 })
      : saved(url, init);
    try {
      const result = await post(`/try-on/sessions/${body.data.sessionId}/token`);
      assert.equal(result.status, 502);
      assert.ok(!JSON.stringify(result.body).includes('secret'));
    } finally { globalThis.fetch = saved; }
  });
});

describe('snapshots', () => {
  const publicId = `outfitcraft/${owner}/tryon/one`;

  test('are private to their owner', async () => {
    await TryOnSnapshot.create({ owner, imageUrl: CLOUD_URL, imagePublicId: publicId });
    assert.equal((await call('/try-on/snapshots')).body.data.length, 1);
    assert.equal((await call('/try-on/snapshots', {}, stranger)).body.data.length, 0);
  });

  test('survive the cleanup job that removes unreferenced uploads', async () => {
    await TryOnSnapshot.create({ owner, imageUrl: CLOUD_URL, imagePublicId: publicId });
    await ImageCleanup.create({ publicId, nextAttemptAt: new Date(0) });
    const { env } = await import('../src/config/env.ts');
    Object.assign(env.cloudinary, { cloudName: 'demo', apiKey: 'k', apiSecret: 's' });
    const destroyed = [];
    const original = cloudinary.uploader.destroy;
    cloudinary.uploader.destroy = async (id) => { destroyed.push(id); return { result: 'ok' }; };
    try {
      await retryImageCleanup();
      assert.deepEqual(destroyed, []);
      assert.equal(await ImageCleanup.exists({ publicId }), null);
    } finally {
      cloudinary.uploader.destroy = original;
      Object.assign(env.cloudinary, { cloudName: '', apiKey: '', apiSecret: '' });
    }
  });

  test('deleting removes the record, and others cannot delete it', async () => {
    const snap = await TryOnSnapshot.create({ owner, imageUrl: CLOUD_URL, imagePublicId: publicId });
    assert.equal((await call(`/try-on/snapshots/${snap._id}`, { method: 'DELETE' }, stranger)).status, 404);
    assert.equal((await call(`/try-on/snapshots/${snap._id}`, { method: 'DELETE' })).status, 200);
    assert.equal(await TryOnSnapshot.countDocuments({}), 0);
  });
});
