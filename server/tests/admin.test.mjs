import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createTestMongo, stopTestMongo } from './testMongo.mjs';

Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'admin-test-only', MONGO_URI: 'mongodb://127.0.0.1:1/unused' });
const { default: app } = await import('../src/app.ts');
const { User } = await import('../src/models/User.ts');
const { Outfit } = await import('../src/models/Outfit.ts');
const { ClothingItem } = await import('../src/models/ClothingItem.ts');
const { AdminLog } = await import('../src/models/AdminLog.ts');
const { seedDefaultCategories } = await import('../src/models/Category.ts');
const admin = 'aaaaaaaaaaaaaaaaaaaaaaaa', member = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const token = (sub) => jwt.sign({ sub }, process.env.JWT_SECRET);
let mongo, server, base, item, outfit;
const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function request(path, options = {}, actor = admin) {
  const result = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token(actor)}`, ...options.headers } });
  return { status: result.status, body: await result.json() };
}
before(async () => {
  mongo = await createTestMongo();
  await mongoose.connect(mongo.getUri());
  await User.create([
    { _id: admin, email: 'admin@example.test', password: 'password123', displayName: 'Quản trị', role: 'admin', isVerified: true },
    { _id: member, email: 'member@example.test', password: 'password123', displayName: 'Thành viên', isVerified: true },
  ]);
  await seedDefaultCategories();
  item = await ClothingItem.create({ owner: member, name: 'Áo', category: 'top', imageUrl: 'https://example.test/a.png', originalImageUrl: 'https://example.test/a.png' });
  outfit = await Outfit.create({ owner: member, name: 'Bản phối mẫu', isPublic: true, items: [{ item: item._id, left: 0, top: 0 }], mannequin: { gender: 'female', shape: 'rectangle', measurements: { heightCm: 160 } } });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 180000 });
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect(); await stopTestMongo(mongo);
});

test('admin endpoints reject missing sessions, ordinary users and forged role claims', async () => {
  assert.equal((await fetch(base + '/admin/dashboard')).status, 401);
  for (const path of ['/admin/dashboard', '/admin/users', '/admin/categories', '/admin/outfits', '/admin/logs']) assert.equal((await request(path, {}, member)).status, 403);
  const forged = jwt.sign({ sub: member, role: 'admin' }, process.env.JWT_SECRET);
  assert.equal((await request('/admin/dashboard', { headers: { Authorization: `Bearer ${forged}` } })).status, 403);
  await User.updateOne({ _id: admin }, { $set: { role: 'user' } });
  assert.equal((await request('/admin/dashboard')).status, 403);
  await User.updateOne({ _id: admin }, { $set: { role: 'admin' } });
});
test('dashboard, user search and details use real counts without exposing secrets or body profiles', async () => {
  await User.updateOne({ _id: member }, { $set: { bodyProfile: { gender: 'female', shape: 'rectangle', weightKg: 55 } } });
  const dashboard = await request('/admin/dashboard');
  assert.equal(dashboard.body.data.users, 2); assert.equal(dashboard.body.data.items, 1);
  const users = await request('/admin/users?q=member%40example.test');
  assert.equal(users.body.pagination.total, 1);
  assert.equal((await request('/admin/users?q=%5B')).body.pagination.total, 0);
  const result = await request(`/admin/users/${member}`);
  assert.equal(result.body.data.itemCount, 1); assert.equal(result.body.data.outfitCount, 1);
  for (const field of ['bodyProfile', 'password', 'registrationOtp', 'resetPasswordToken']) assert.equal(field in result.body.data, false);
  assert.equal((await request('/admin/users/invalid')).status, 400);
});
test('lock immediately rejects old tokens and new logins; unlock and audit work', async () => {
  const path = `/admin/users/${member}/status`;
  assert.equal((await request(path, { method: 'PATCH', ...json({ isActive: false, reason: 'Vi phạm nội quy' }) })).status, 200);
  assert.equal((await request('/items', {}, member)).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', ...json({ email: 'member@example.test', password: 'password123' }) }, member)).status, 403);
  assert.equal((await request('/admin/users?status=locked')).body.pagination.total, 1);
  assert.equal((await request(path, { method: 'PATCH', ...json({ isActive: true, reason: 'Đã xử lý xong' }) })).status, 200);
  assert.equal((await request('/items', {}, member)).status, 200);
  assert.equal(await AdminLog.countDocuments({ targetId: member, status: 'completed' }), 2);
});
test('admin accounts cannot be locked and unknown status fields cannot change roles', async () => {
  assert.equal((await request(`/admin/users/${admin}/status`, { method: 'PATCH', ...json({ isActive: false, reason: 'Tự khóa tài khoản' }) })).status, 403);
  assert.equal((await request(`/admin/users/${member}/status`, { method: 'PATCH', ...json({ isActive: false, reason: 'abc', role: 'admin' }) })).status, 400);
  assert.equal((await User.findById(member)).role, 'user');
  assert.equal((await request(`/admin/users/${member}/status`, { method: 'PATCH', ...json({ isActive: false, reason: '' }) })).status, 400);
});
test('category changes are validated, available to the app and retained across seeding', async () => {
  const categories = await request('/admin/categories');
  assert.equal(categories.body.data.length, 7);
  assert.equal(categories.body.data.find((c) => c.code === 'top').itemCount, 1);
  const values = { name: 'Áo mới', layerOrder: 42, defaultTempMin: 19, defaultTempMax: 31 };
  assert.equal((await request('/admin/categories/top', { method: 'PATCH', ...json({ ...values, defaultTempMin: 40 }) })).status, 400);
  assert.equal((await request('/admin/categories/top', { method: 'PATCH', ...json(values) })).status, 200);
  await seedDefaultCategories();
  const config = (await request('/categories', {}, member)).body.data.find((c) => c.code === 'top');
  assert.equal(config.name, 'Áo mới'); assert.equal(config.layerOrder, 42);
  // Defaults are checked through the metadata endpoint using the existing signed upload receipt.
  const url = `https://res.cloudinary.com/test/image/upload/outfitcraft/${member}/items/one.png`;
  const publicId = `outfitcraft/${member}/items/one`;
  const receipt = jwt.sign({ url, publicId, owner: member, purpose: 'item-upload' }, process.env.JWT_SECRET);
  const created = await request('/items', { method: 'POST', ...json({ name: 'Áo mặc định', category: 'top', originalImageUrl: url, imageUrl: url, imagePublicId: publicId, originalImagePublicId: publicId, imageReceipt: receipt, originalImageReceipt: receipt }) }, member);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.data.tempRange, { min: 19, max: 31 });
});
test('hidden public outfits disappear from feed and direct reads; owner cannot bypass moderation', async () => {
  const path = `/admin/outfits/${outfit.id}/visibility`;
  assert.equal((await request(path, { method: 'PATCH', ...json({ isHidden: true, reason: 'Ảnh không phù hợp' }) })).status, 200);
  assert.equal((await request('/outfits/feed')).body.pagination.total, 0);
  assert.equal((await request(`/outfits/${outfit.id}`)).status, 403);
  assert.equal((await request(`/outfits/${outfit.id}`, {}, member)).status, 200);
  await request(`/outfits/${outfit.id}`, { method: 'PATCH', ...json({ isHidden: false, isPublic: true }) }, member);
  assert.equal((await Outfit.findById(outfit.id)).isHidden, true);
  const list = await request('/admin/outfits?status=hidden&q=member');
  assert.equal(list.body.pagination.total, 1);
  assert.equal('mannequin' in list.body.data[0], false);
  assert.equal('canvasJSON' in list.body.data[0], false);
  assert.equal((await request(path, { method: 'PATCH', ...json({ isHidden: false, reason: 'Đã kiểm tra lại' }) })).status, 200);
  assert.equal((await request('/outfits/feed')).body.pagination.total, 1);
});
test('log pagination includes actor, reasons and before/after changes', async () => {
  const result = await request('/admin/logs');
  assert.equal(result.status, 200); assert.equal(result.body.pagination.total, 5);
  assert.ok(result.body.data.every((entry) => entry.actorName === 'Quản trị' && entry.status === 'completed'));
  assert.ok(result.body.data.find((entry) => entry.action === 'edit_category').changes.after.name === 'Áo mới');
  const beyond = await request('/admin/logs?page=2'); assert.equal(beyond.body.data.length, 0);
});

test('demo admin is development-only, can log in and never resets an existing account', async () => {
  const { seedDemoAdmin, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } = await import('../src/services/demoAdmin.service.ts');
  assert.equal((await seedDemoAdmin({ nodeEnv: 'production', enabled: true })).status, 'disabled');
  assert.equal((await seedDemoAdmin({ nodeEnv: 'development', enabled: false })).status, 'disabled');
  assert.equal(await User.countDocuments({ email: DEMO_ADMIN_EMAIL }), 0);
  assert.equal((await seedDemoAdmin({ nodeEnv: 'development', enabled: true })).status, 'created');
  const login = await request('/auth/login', { method: 'POST', ...json({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200); assert.equal(login.body.data.user.role, 'admin');
  const account = await User.findOne({ email: DEMO_ADMIN_EMAIL });
  account.password = 'ChangedPassword@123'; account.role = 'user'; account.isActive = false; await account.save();
  const again = await seedDemoAdmin({ nodeEnv: 'development', enabled: true });
  assert.equal(again.status, 'exists'); assert.equal(again.usable, false);
  const preserved = await User.findById(account.id).select('+password');
  assert.equal(preserved.role, 'user'); assert.equal(preserved.isActive, false);
  assert.equal(await preserved.comparePassword('ChangedPassword@123'), true);
  assert.equal(await User.countDocuments({ email: DEMO_ADMIN_EMAIL }), 1);
});
