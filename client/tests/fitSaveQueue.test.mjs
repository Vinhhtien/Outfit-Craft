import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, localStorage: dom.window.localStorage });
const { itemApi } = await import('../src/lib/services.ts');
const { useAuthStore } = await import('../src/store/authStore.ts');
const { queueFitSave, retryFitSaves, restoreFitSaves, useFitSaves } = await import('../src/store/fitSaveQueue.ts');
const original = itemApi.saveFit;
const fit = { category: 'top', anchorRef: 'neck', offsetX: 0, offsetY: 0, width: 1, height: 1 };
function login(id = 'alice') { useAuthStore.setState({ user: { id }, sessionExpired: false }); }
afterEach(async () => {
  itemApi.saveFit = async () => ({});
  for (const owner of ['alice', 'bob']) { login(owner); await retryFitSaves(owner); }
  itemApi.saveFit = original;
  useFitSaves.setState({ jobs: {}, storageError: '' });
  window.sessionStorage.clear();
});

test('failed save survives page state loss and clears its draft only after a successful retry', async () => {
  login(); itemApi.saveFit = async () => { throw new Error('Không kết nối được máy chủ.'); };
  queueFitSave('alice', 'shirt', fit, 60000);
  await retryFitSaves('alice');
  assert.match(useFitSaves.getState().jobs['alice:shirt'].error, /kết nối/);
  useFitSaves.setState({ jobs: {} });
  restoreFitSaves('alice');
  assert.deepEqual(useFitSaves.getState().jobs['alice:shirt'].fit, fit);
  itemApi.saveFit = async () => ({});
  await retryFitSaves('alice');
  assert.equal(Object.keys(useFitSaves.getState().jobs).length, 0);
  assert.equal(window.sessionStorage.getItem('outfitcraft:pending-fits:alice'), null);
});

test('rapid edits are sent in order and an old acknowledgement cannot discard the latest edit', async () => {
  login(); let release; const sent = [];
  itemApi.saveFit = async (_id, value) => {
    sent.push(value.width);
    if (sent.length === 1) await new Promise((resolve) => { release = resolve; });
    return {};
  };
  queueFitSave('alice', 'shirt', fit, 60000);
  const pending = retryFitSaves('alice');
  queueFitSave('alice', 'shirt', { ...fit, width: 2 }, 60000);
  const latest = retryFitSaves('alice');
  assert.deepEqual(sent, [1]);
  release(); await Promise.all([pending, latest]);
  assert.deepEqual(sent, [1, 2]);
  assert.equal(Object.keys(useFitSaves.getState().jobs).length, 0);
});

test('another account or an expired session never sends the original owner draft', async () => {
  login(); let calls = 0; itemApi.saveFit = async () => { calls++; return {}; };
  queueFitSave('alice', 'shirt', fit, 60000);
  login('bob'); await retryFitSaves('alice'); assert.equal(calls, 0);
  login(); useAuthStore.setState({ sessionExpired: true });
  await retryFitSaves('alice'); assert.equal(calls, 0);
  login(); await retryFitSaves('alice'); assert.equal(calls, 1);
});

test('storage failure is reported and does not prevent the pending change from saving', async () => {
  login(); const proto = Object.getPrototypeOf(window.sessionStorage);
  const originalSet = proto.setItem;
  proto.setItem = () => { throw new Error('quota'); };
  try {
    queueFitSave('alice', 'shirt', fit, 60000);
    assert.match(useFitSaves.getState().storageError, /giữ trang mở/);
  } finally { proto.setItem = originalSet; }
  itemApi.saveFit = async () => ({}); await retryFitSaves('alice');
  assert.equal(Object.keys(useFitSaves.getState().jobs).length, 0);
});
