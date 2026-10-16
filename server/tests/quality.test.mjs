import test from 'node:test';
import assert from 'node:assert/strict';
import { saveWithImages } from '../src/services/upload.service.ts';
import { validateImageBuffer, decodeImageDataUrl, ownsImage, ownedImageIdFromUrl } from '../src/utils/imageValidation.ts';
import { errorHandler } from '../src/middlewares/errorHandler.ts';
import { ApiError } from '../src/utils/ApiError.ts';
import { createRequire } from 'node:module';
const { z } = createRequire(import.meta.url)('zod');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=', 'base64');

test('image validation rejects spoofed, empty, oversized and malformed images', () => {
  assert.equal(validateImageBuffer(png), 'image/png');
  for (const bytes of [Buffer.alloc(0), Buffer.from('<script>image</script>'), Buffer.alloc(10 * 1024 * 1024 + 1)]) assert.throws(() => validateImageBuffer(bytes));
  assert.deepEqual(decodeImageDataUrl(`data:image/png;base64,${png.toString('base64')}`), png);
  assert.throws(() => decodeImageDataUrl(`data:image/jpeg;base64,${png.toString('base64')}`));
  assert.throws(() => decodeImageDataUrl('data:image/png;base64,%%%'));
  assert.equal(ownsImage('outfitcraft/alice/items/image', 'alice'), true);
  assert.equal(ownsImage('outfitcraft/alice2/items/image', 'alice'), false);
  assert.equal(ownsImage('outfitcraft/alice/../bob/image', 'alice'), false);
});

test('legacy image recovery requires the configured cloud, owner and folder boundary', () => {
  const prefix = 'https://res.cloudinary.com/quality-test/image/upload/';
  assert.equal(ownedImageIdFromUrl(`${prefix}c_limit,w_640/v123/outfitcraft/alice/items/original.png`, 'alice', 'quality-test'), 'outfitcraft/alice/items/original');
  for (const url of [
    `${prefix}outfitcraft/bob/items/image.png`,
    `${prefix}fakeoutfitcraft/alice/items/image.png`,
    `${prefix}outfitcraft/alice/%2E%2E/bob/image.png`,
    'https://res.cloudinary.com/other/image/upload/outfitcraft/alice/items/image.png',
    'https://example.com/quality-test/image/upload/outfitcraft/alice/items/image.png',
  ]) assert.equal(ownedImageIdFromUrl(url, 'alice', 'quality-test'), undefined);
});

test('parallel upload failure waits for late success and removes only newly uploaded assets', async () => {
  const deleted = [];
  let saved = false;
  await assert.rejects(saveWithImages([
    () => Promise.reject(new Error('provider failure')),
    () => new Promise((resolve) => setTimeout(() => resolve({ url: 'new', publicId: 'new-image' }), 10)),
  ], async () => { saved = true; }, async (id) => { deleted.push(id); }));
  assert.equal(saved, false);
  assert.deepEqual(deleted, ['new-image']);
});

test('database failure compensates both uploads without replacing the original error', async () => {
  const deleted = [];
  const error = new Error('database unavailable');
  await assert.rejects(saveWithImages(['a', 'b'].map((id) => async () => ({ url: id, publicId: id })), async () => { throw error; }, async (id) => { deleted.push(id); throw new Error('cleanup unavailable'); }), (actual) => actual === error);
  assert.deepEqual(deleted.sort(), ['a', 'b']);
});

test('successful save keeps uploaded assets', async () => {
  const deleted = [];
  const value = await saveWithImages([async () => ({ url: 'https://image', publicId: 'asset' })], async ([image]) => ({ image: image.url }), async (id) => { deleted.push(id); });
  assert.deepEqual(value, { image: 'https://image' });
  assert.deepEqual(deleted, []);
});

function responseFor(error) {
  let status; let body;
  const res = { headersSent: false, status(value) { status = value; return this; }, json(value) { body = value; } };
  errorHandler(error, {}, res, () => {});
  return { status, body };
}

test('unexpected server error hides private details and session errors have a stable code', () => {
  const saved = console.error; console.error = () => {};
  try {
    const result = responseFor(new Error('secret mongodb://private:password@host'));
    assert.equal(result.status, 500);
    assert.equal(JSON.stringify(result.body).includes('password'), false);
    assert.equal(result.body.stack, undefined);
    assert.equal(responseFor(ApiError.sessionExpired()).body.code, 'SESSION_EXPIRED');
    assert.equal(responseFor(ApiError.unauthorized('Sai mật khẩu')).body.code, undefined);
  } finally { console.error = saved; }
});

test('validation, malformed JSON, payload limits and concurrency use recoverable statuses', () => {
  const validation = z.object({ name: z.string().min(1) }).safeParse({ name: '' });
  const result = responseFor(validation.error);
  assert.equal(result.status, 400);
  assert.equal(result.body.details[0].field, 'name');
  assert.match(result.body.details[0].message, /Tên/);
  for (const [type, expected] of [['entity.parse.failed', 400], ['entity.too.large', 413]]) assert.equal(responseFor(Object.assign(new Error('internal'), { type })).status, expected);
  assert.equal(responseFor(Object.assign(new Error(), { name: 'VersionError' })).status, 409);
});
