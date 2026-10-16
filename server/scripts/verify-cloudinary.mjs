// Uses real Cloudinary with generated images and an isolated temporary MongoDB.
// Never connects to the configured project database or changes existing images.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
const { env, isCloudinaryConfigured } = await import('../src/config/env.ts');
const { cloudinary } = await import('../src/config/cloudinary.ts');
const { default: app } = await import('../src/app.ts');
const { User } = await import('../src/models/User.ts');
const { ClothingItem } = await import('../src/models/ClothingItem.ts');
const { Outfit } = await import('../src/models/Outfit.ts');
const { ImageCleanup } = await import('../src/models/ImageCleanup.ts');

function chunk(type, data) {
  const bytes = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const value of bytes) { crc ^= value; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, bytes, sum]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0,30,90,60,255]))), chunk('IEND', Buffer.alloc(0))]);
let mongo, server, base;
const owner = new mongoose.Types.ObjectId();
const token = jwt.sign({ sub: owner.toString() }, env.jwtSecret, { expiresIn: '10m' });
const checks = [];
const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function request(path, options = {}) {
  const res = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(150000) });
  assert.ok(res.ok, `API ${path}: ${res.status}`);
  return (await res.json()).data;
}
async function readable(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /^image\//);
  assert.ok((await res.arrayBuffer()).byteLength > 0);
}
async function removed(publicId) {
  try { await cloudinary.api.resource(publicId); assert.fail('Image still exists'); }
  catch (error) { assert.equal(error?.error?.http_code ?? error?.http_code, 404); }
}
const avatarForm = () => { const body = new FormData(); body.append('avatar', new Blob([png], { type: 'image/png' }), 'quality.png'); return body; };
try {
  assert.ok(isCloudinaryConfigured(), 'Missing Cloudinary configuration');
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'isolated_cloudinary_quality' });
  await Promise.all([User.init(), ClothingItem.init(), Outfit.init(), ImageCleanup.init()]);
  await User.create({ _id: owner, email: `${owner}@example.test`, displayName: 'Quality smoke test', password: randomUUID() });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  const creationKey = randomUUID();
  const itemForm = () => {
    const body = new FormData(); body.append('creationKey', creationKey);
    body.append('metadata', JSON.stringify({ name: 'Generated quality image', category: 'top' }));
    for (const field of ['image', 'original']) body.append(field, new Blob([png], { type: 'image/png' }), 'quality.png');
    return body;
  };
  const item = await request('/items/with-images', { method: 'POST', body: itemForm() });
  await readable(item.imageUrl); await readable(item.originalImageUrl); checks.push('item upload and image delivery');
  const repeated = await request('/items/with-images', { method: 'POST', body: itemForm() });
  assert.equal(item._id, repeated._id); checks.push('retry creates no duplicate item');
  const thumbnailDataUrl = `data:image/png;base64,${png.toString('base64')}`;
  const outfit = await request('/outfits', { method: 'POST', ...json({ name: 'Generated outfit', items: [{ item: item._id, left: 0, top: 0 }], thumbnailDataUrl }) });
  await readable(outfit.thumbnailUrl);
  const updated = await request(`/outfits/${outfit._id}`, { method: 'PATCH', ...json({ thumbnailDataUrl }) });
  await readable(updated.thumbnailUrl); await removed(outfit.thumbnailPublicId); checks.push('thumbnail replacement removes old image');
  await request('/auth/profile', { method: 'PUT', body: avatarForm() });
  const firstAvatar = (await User.findById(owner).select('+avatarPublicId')).avatarPublicId;
  const profile = await request('/auth/profile', { method: 'PUT', body: avatarForm() });
  await readable(profile.avatarUrl); await removed(firstAvatar); checks.push('avatar replacement removes old image');
  await request(`/outfits/${outfit._id}`, { method: 'DELETE' }); await removed(updated.thumbnailPublicId);
  await request(`/items/${item._id}`, { method: 'DELETE' });
  await removed(item.imagePublicId); await removed(item.originalImagePublicId); checks.push('deletion removes both item images and thumbnail');
} catch (error) {
  // Never print provider response/configuration (may include account credentials).
  console.error(JSON.stringify({ result: 'failed', kind: error?.name ?? 'Error', status: error?.http_code ?? error?.error?.http_code, checks }));
  process.exitCode = 1;
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  if (mongoose.connection.readyState === 1) {
    // Every uploaded ID is pre-recorded in this run's temporary DB before upload.
    // Include IDs still referenced by temporary records after successful cleanup.
    const ids = new Set((await ImageCleanup.find().lean()).map((job) => job.publicId));
    for (const item of await ClothingItem.find({ owner }).lean()) { ids.add(item.imagePublicId); ids.add(item.originalImagePublicId); }
    for (const outfit of await Outfit.find({ owner }).lean()) ids.add(outfit.thumbnailPublicId);
    ids.add((await User.findById(owner).select('+avatarPublicId'))?.avatarPublicId);
    for (const id of ids) if (id?.startsWith(`outfitcraft/${owner}/`)) {
      try { const result = await cloudinary.uploader.destroy(id, { invalidate: true }); assert.ok(['ok', 'not found'].includes(result.result)); }
      catch { console.error(JSON.stringify({ cleanup: 'failed', publicId: id })); process.exitCode = 1; }
    }
    await mongoose.disconnect();
  }
  await mongo?.stop();
}
if (!process.exitCode) console.log(JSON.stringify({ result: 'passed', checks, cleanup: 'completed' }));
