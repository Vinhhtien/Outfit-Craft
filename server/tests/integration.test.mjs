import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createTestMongo, stopTestMongo } from './testMongo.mjs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Override before importing env.ts. No real database, email or media service is used.
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'quality-test-secret-only', MONGO_URI: 'mongodb://127.0.0.1:1/unused', CLOUDINARY_CLOUD_NAME: 'quality-test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' });
const { default: app } = await import('../src/app.ts');
const { cloudinary } = await import('../src/config/cloudinary.ts');
const { ClothingItem } = await import('../src/models/ClothingItem.ts');
const { Outfit } = await import('../src/models/Outfit.ts');
const { ImageCleanup } = await import('../src/models/ImageCleanup.ts');
const { User } = await import('../src/models/User.ts');
const { retryImageCleanup, destroyImage, queueImageCleanup } = await import('../src/services/upload.service.ts');
const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const stranger = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const token = jwt.sign({ sub: owner }, process.env.JWT_SECRET);
const otherToken = jwt.sign({ sub: stranger }, process.env.JWT_SECRET);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=', 'base64');
let mongo, server, base, uploads = 0, failUploadAt = 0, failDelete = false;
const deleted = [];

before(async () => {
  mongo = await createTestMongo();
  await mongoose.connect(mongo.getUri(), { dbName: 'outfitcraft_quality_test' });
  await Promise.all([ClothingItem.init(), Outfit.init(), ImageCleanup.init(), User.init()]);
  await User.create([
    { _id: owner, email: 'avatar@example.test', password: 'test-password-only', displayName: 'Avatar test', isVerified: true },
    { _id: stranger, email: 'stranger@example.test', password: 'test-password-only', displayName: 'Stranger', isVerified: true },
  ]);
  mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      uploads++;
      if (uploads === failUploadAt) callback({ message: 'provider credentials private', http_code: 503 });
      else callback(undefined, { secure_url: `https://res.cloudinary.com/quality-test/image/upload/${options.folder}/${options.public_id}.png`, public_id: `${options.folder}/${options.public_id}` });
      done();
    },
  }));
  mock.method(cloudinary.uploader, 'destroy', async (id) => {
    if (failDelete) throw new Error('offline');
    deleted.push(id); return { result: 'ok' };
  });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 180000 });

after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await stopTestMongo(mongo);
});
beforeEach(() => { failUploadAt = 0; failDelete = false; deleted.length = 0; });

async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  return { status: response.status, body: await response.json() };
}
function form(key = randomUUID(), bytes = png) {
  const body = new FormData();
  body.append('creationKey', key);
  body.append('metadata', JSON.stringify({ name: 'Áo thử nghiệm', category: 'top', colors: [], styles: [], seasons: [], occasions: [] }));
  body.append('image', new Blob([bytes], { type: 'image/png' }), 'cutout.png');
  body.append('original', new Blob([bytes], { type: 'image/png' }), 'original.png');
  return body;
}
async function createItem() {
  const response = await request('/items/with-images', { method: 'POST', body: form() });
  assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data;
}
function json(body) { return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

test('atomic item upload records both image IDs and repeat requests reuse one record', async () => {
  const key = randomUUID(), before = uploads;
  const first = await request('/items/with-images', { method: 'POST', body: form(key) });
  const second = await request('/items/with-images', { method: 'POST', body: form(key) });
  assert.equal(first.status, 201); assert.equal(second.status, 200);
  assert.equal(first.body.data._id, second.body.data._id);
  assert.ok(first.body.data.originalImagePublicId);
  assert.equal(uploads - before, 2);
});

test('concurrent item retries create exactly one item and reclaim losing uploads', async () => {
  const key = randomUUID();
  const responses = await Promise.all([1, 2].map(() => request('/items/with-images', { method: 'POST', body: form(key) })));
  assert.ok(responses.every((r) => r.status === 200 || r.status === 201), JSON.stringify(responses));
  assert.equal(responses[0].body.data._id, responses[1].body.data._id);
  assert.equal(await ClothingItem.countDocuments({ owner, creationKey: key }), 1);
  assert.ok(!deleted.includes(responses[0].body.data.imagePublicId));
});

test('partial upload failure creates no item, hides provider details and cleans successful half', async () => {
  failUploadAt = uploads + 2;
  const key = randomUUID();
  const result = await request('/items/with-images', { method: 'POST', body: form(key) });
  assert.equal(result.status, 502);
  assert.equal(await ClothingItem.countDocuments({ creationKey: key }), 0);
  assert.equal(deleted.length, 1);
  assert.equal(JSON.stringify(result.body).includes('credentials'), false);
});

test('spoofed image and foreign media identifiers are rejected before upload or deletion', async () => {
  const before = uploads;
  const spoof = await request('/items/with-images', { method: 'POST', body: form(randomUUID(), Buffer.from('not a PNG')) });
  assert.equal(spoof.status, 400); assert.equal(uploads, before);
  const forged = await request('/items', { method: 'POST', ...json({ name: 'Bad', category: 'top', imageUrl: 'https://example.com/a', originalImageUrl: 'https://example.com/b', imagePublicId: `outfitcraft/${stranger}/items/a` }) });
  assert.equal(forged.status, 400); assert.equal(deleted.length, 0);
});

test('thumbnail failure preserves old thumbnail; successful replacement deletes it after save', async () => {
  const item = await createItem();
  const creationKey = randomUUID();
  const payload = { creationKey, name: 'Outfit thử', items: [{ item: item._id, left: 0, top: 0 }], thumbnailDataUrl: `data:image/png;base64,${png.toString('base64')}` };
  const created = await request('/outfits', { method: 'POST', ...json(payload) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const original = created.body.data;
  const retry = await request('/outfits', { method: 'POST', ...json(payload) });
  assert.equal(retry.body.data._id, original._id);
  failUploadAt = uploads + 1;
  const failed = await request(`/outfits/${original._id}`, { method: 'PATCH', ...json({ thumbnailDataUrl: payload.thumbnailDataUrl }) });
  assert.equal(failed.status, 502);
  assert.equal((await Outfit.findById(original._id)).thumbnailPublicId, original.thumbnailPublicId);
  assert.ok(!deleted.includes(original.thumbnailPublicId));
  failUploadAt = 0;
  const updated = await request(`/outfits/${original._id}`, { method: 'PATCH', ...json({ thumbnailDataUrl: payload.thumbnailDataUrl }) });
  assert.equal(updated.status, 200);
  assert.notEqual(updated.body.data.thumbnailPublicId, original.thumbnailPublicId);
  assert.ok(deleted.includes(original.thumbnailPublicId));
});

test('database failure after thumbnail upload preserves previous image and cleans the new one', async () => {
  const item = await createItem();
  const outfit = await Outfit.create({ owner, name: 'Existing', items: [{ item: item._id, left: 0, top: 0 }], thumbnailPublicId: `outfitcraft/${owner}/outfits/old`, thumbnailUrl: 'https://example.com/old' });
  const replacement = mock.method(Outfit.prototype, 'save', async () => { throw new Error('database failed'); });
  try {
    const result = await request(`/outfits/${outfit.id}`, { method: 'PATCH', ...json({ thumbnailDataUrl: `data:image/png;base64,${png.toString('base64')}` }) });
    assert.equal(result.status, 500);
    assert.equal(deleted.length, 1);
    assert.ok(!deleted.includes(outfit.thumbnailPublicId));
    assert.equal((await Outfit.findById(outfit.id)).thumbnailPublicId, outfit.thumbnailPublicId);
  } finally { replacement.mock.restore(); }
});

test('item deletion removes both images and other accounts cannot delete the item', async () => {
  const item = await createItem();
  const foreign = await request(`/items/${item._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${otherToken}` } });
  assert.equal(foreign.status, 404); assert.equal(deleted.length, 0);
  const removed = await request(`/items/${item._id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.deepEqual(deleted.sort(), [item.imagePublicId, item.originalImagePublicId].sort());
});

test('failed image deletion is retained and retried; referenced images remain intact', async () => {
  failDelete = true;
  const id = `outfitcraft/${owner}/items/unreferenced`;
  await destroyImage(id);
  assert.ok(await ImageCleanup.exists({ publicId: id }));
  failDelete = false;
  await retryImageCleanup();
  assert.ok(deleted.includes(id));
  assert.equal(await ImageCleanup.exists({ publicId: id }), null);
  const item = await createItem();
  await destroyImage(item.imagePublicId);
  assert.ok(!deleted.includes(item.imagePublicId));
});

test('legacy original image URL remains protected while referenced and is reclaimed after deletion', async () => {
  const publicId = `outfitcraft/${owner}/items/legacy-original`;
  const item = await ClothingItem.create({ owner, name: 'Legacy', category: 'top', imageUrl: 'https://example.com/cutout', originalImageUrl: `https://res.cloudinary.com/quality-test/image/upload/v123/${publicId}.png` });
  await destroyImage(publicId);
  assert.ok(!deleted.includes(publicId));
  const response = await request(`/items/${item.id}`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.ok(deleted.includes(publicId));
});

test('expired session, malformed JSON and invalid IDs produce readable API responses', async () => {
  const expired = await request('/items', { headers: { Authorization: 'Bearer expired' } });
  assert.equal(expired.status, 401); assert.equal(expired.body.code, 'SESSION_EXPIRED');
  const malformed = await request('/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/items/not-an-id')).status, 400);
});

test('avatar upload or database failure preserves the old image; replacement reclaims it', async () => {
  const avatar = () => { const body = new FormData(); body.append('avatar', new Blob([png], { type: 'image/png' }), 'avatar.png'); return body; };
  assert.equal((await request('/auth/profile', { method: 'PUT', body: avatar() })).status, 200);
  const original = (await User.findById(owner).select('+avatarPublicId')).avatarPublicId;
  failUploadAt = uploads + 1;
  assert.equal((await request('/auth/profile', { method: 'PUT', body: avatar() })).status, 502);
  assert.ok(!deleted.includes(original));
  failUploadAt = 0;
  const replacement = mock.method(User.prototype, 'save', async () => { throw new Error('database failed'); });
  try {
    assert.equal((await request('/auth/profile', { method: 'PUT', body: avatar() })).status, 500);
    assert.equal((await User.findById(owner).select('+avatarPublicId')).avatarPublicId, original);
    assert.ok(!deleted.includes(original));
  } finally { replacement.mock.restore(); }
  assert.equal((await request('/auth/profile', { method: 'PUT', body: avatar() })).status, 200);
  assert.ok(deleted.includes(original));
});

test('cleanup intent exists before deleting a record and survives a process interruption', async () => {
  const item = await createItem();
  const remove = ClothingItem.prototype.deleteOne;
  const replacement = mock.method(ClothingItem.prototype, 'deleteOne', async function (...args) {
    assert.ok(await ImageCleanup.exists({ publicId: this.imagePublicId }));
    const result = await remove.apply(this, args);
    throw Object.assign(new Error('simulated interruption after database deletion'), { result });
  });
  try {
    assert.equal((await request(`/items/${item._id}`, { method: 'DELETE' })).status, 500);
  } finally { replacement.mock.restore(); }
  await ImageCleanup.updateMany({ publicId: { $in: [item.imagePublicId, item.originalImagePublicId] } }, { $set: { nextAttemptAt: new Date(0) } });
  await retryImageCleanup();
  assert.ok(deleted.includes(item.imagePublicId)); assert.ok(deleted.includes(item.originalImagePublicId));
});

test('cleanup queue failure prevents deletion and leaves images and record intact', async () => {
  const item = await createItem();
  const replacement = mock.method(ImageCleanup, 'bulkWrite', async () => { throw new Error('queue unavailable'); });
  try {
    assert.equal((await request(`/items/${item._id}`, { method: 'DELETE' })).status, 500);
    assert.ok(await ClothingItem.exists({ _id: item._id }));
    assert.ok(!deleted.includes(item.imagePublicId));
  } finally { replacement.mock.restore(); }
});

test('an old image queued before a failed replacement stays protected while referenced', async () => {
  const item = await createItem();
  await queueImageCleanup([item.imagePublicId]);
  await ImageCleanup.updateOne({ publicId: item.imagePublicId }, { $set: { nextAttemptAt: new Date(0) } });
  await retryImageCleanup();
  assert.ok(!deleted.includes(item.imagePublicId));
  assert.ok(await ClothingItem.exists({ _id: item._id }));
});
