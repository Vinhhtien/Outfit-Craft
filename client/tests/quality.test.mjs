import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AxiosError } from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
const { api, getErrorMessage, getFieldErrors, tokenStore } = await import('../src/lib/api.ts');
const { authApi } = await import('../src/lib/services.ts');
const { useAuthStore } = await import('../src/store/authStore.ts');
const { useResource } = await import('../src/hooks/useResource.ts');
const { ErrorState, CardSkeletons } = await import('../src/components/ui/AsyncState.tsx');
const { VModal, VToast } = await import('../src/components/ui/vintage.tsx');
const { NotificationViewport, useNotices } = await import('../src/components/ui/Notifications.tsx');
const roots = [];
const adapter = api.defaults.adapter;
const me = authApi.me;
function mount(element) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); roots.push({ root, container });
  return { root, container, render: async (value = element) => act(async () => root.render(value)) };
}
async function tick(ms = 10) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); }); }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function axiosError(status, data, config = {}) { return new AxiosError('internal error', 'ERR_BAD_RESPONSE', config, undefined, { status, data, headers: {}, statusText: '', config }); }
function authenticate() { useAuthStore.setState({ user: { id: 'test-user', email: 'test@example.com' }, isLoading: false, hydrateError: '', sessionExpired: false }); }
afterEach(async () => {
  for (const { root, container } of roots.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  api.defaults.adapter = adapter; authApi.me = me; tokenStore.clear(); useNotices.setState({ notices: [] });
  useAuthStore.setState({ user: null, isLoading: false, hydrateError: '', sessionExpired: false });
});

test('network, timeout and field errors are translated to actionable Vietnamese', () => {
  assert.match(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK')), /kết nối/);
  assert.match(getErrorMessage(new AxiosError('timeout', 'ECONNABORTED')), /giữ nguyên/);
  assert.match(getErrorMessage(axiosError(429, {})), /quá nhanh/);
  const error = axiosError(400, { details: [{ field: 'name', message: 'Vui lòng nhập tên.' }] });
  assert.deepEqual(getFieldErrors(error), { name: 'Vui lòng nhập tên.' });
  assert.equal(getErrorMessage(error), 'Vui lòng nhập tên.');
  assert.equal(getErrorMessage(new Error('secret implementation')).includes('secret'), false);
});

test('wrong credentials preserve token; only matching expired session emits expiry', async () => {
  tokenStore.set('current');
  let expires = 0; const listener = () => expires++;
  window.addEventListener('outfitcraft:session-expired', listener);
  try {
    api.defaults.adapter = async (config) => { throw axiosError(401, { message: 'Sai mật khẩu' }, config); };
    await assert.rejects(api.post('/auth/login', {})); assert.equal(tokenStore.get(), 'current'); assert.equal(expires, 0);
    api.defaults.adapter = async (config) => { throw axiosError(401, { code: 'SESSION_EXPIRED' }, config); };
    await assert.rejects(api.get('/items')); assert.equal(tokenStore.get(), null); assert.equal(expires, 1);
    tokenStore.set('new');
    api.defaults.adapter = async (config) => { config.headers.Authorization = 'Bearer old'; throw axiosError(401, { code: 'SESSION_EXPIRED' }, config); };
    await assert.rejects(api.get('/items')); assert.equal(tokenStore.get(), 'new'); assert.equal(expires, 1);
  } finally { window.removeEventListener('outfitcraft:session-expired', listener); }
});

test('temporary hydration failure preserves token and permits a successful retry', async () => {
  tokenStore.set('retained');
  authApi.me = async () => { throw new AxiosError('Network Error', 'ERR_NETWORK'); };
  await useAuthStore.getState().hydrate();
  assert.equal(tokenStore.get(), 'retained'); assert.equal(useAuthStore.getState().isLoading, false);
  assert.match(useAuthStore.getState().hydrateError, /kết nối/);
  authApi.me = async () => ({ _id: 'test-user', email: 'test@example.com' });
  await useAuthStore.getState().hydrate();
  assert.equal(useAuthStore.getState().user.id, 'test-user'); assert.equal(useAuthStore.getState().hydrateError, '');
});

test('resource cancels stale requests and late results cannot overwrite the latest query', async () => {
  authenticate(); const old = deferred(), recent = deferred(); let oldSignal, state;
  const oldLoader = (signal) => { oldSignal = signal; return old.promise; };
  const newLoader = () => recent.promise;
  function Harness({ loader }) { state = useResource(loader); return React.createElement('span', null, state.data ?? 'loading'); }
  const ui = mount(React.createElement(Harness, { loader: oldLoader })); await ui.render(); await tick();
  await ui.render(React.createElement(Harness, { loader: newLoader })); await tick();
  assert.equal(oldSignal.aborted, true);
  await act(async () => recent.resolve('new result')); await act(async () => old.resolve('old result'));
  assert.equal(ui.container.textContent, 'new result'); assert.equal(state.loading, false);
});

test('refresh failure retains successful data and retry clears the error', async () => {
  authenticate(); let fail = false, state;
  const loader = async () => { if (fail) throw new AxiosError('Network Error', 'ERR_NETWORK'); return ['áo']; };
  function Harness() { state = useResource(loader); return React.createElement('span', null, state.data?.join(',')); }
  const ui = mount(React.createElement(Harness)); await ui.render(); await tick();
  fail = true; await act(async () => state.reload());
  assert.deepEqual(state.data, ['áo']); assert.match(state.error, /kết nối/); assert.equal(state.loading, false);
  fail = false; await act(async () => state.reload()); assert.equal(state.error, '');
});

test('switching accounts hides the previous owner data before the new request finishes', async () => {
  authenticate(); let state;
  const waiting = deferred(); let calls = 0;
  const loader = () => ++calls === 1 ? Promise.resolve(['private-alice']) : waiting.promise;
  function Harness() { state = useResource(loader); return React.createElement('span', null, state.data?.join(',') ?? 'loading'); }
  const ui = mount(React.createElement(Harness)); await ui.render(); await tick();
  assert.equal(ui.container.textContent, 'private-alice');
  await act(async () => useAuthStore.setState({ user: { id: 'bob' } }));
  assert.equal(ui.container.textContent, 'loading');
  assert.equal(state.data, null);
  await tick(); await act(async () => waiting.resolve(['bob-data']));
  assert.equal(ui.container.textContent, 'bob-data');
});

test('protected resources wait for authentication and abort on unmount', async () => {
  let calls = 0, signal;
  const loader = (value) => { calls++; signal = value; return new Promise(() => {}); };
  function Harness() { useResource(loader); return null; }
  const ui = mount(React.createElement(Harness)); await ui.render(); await tick(); assert.equal(calls, 0);
  await act(async () => authenticate()); await tick(); assert.equal(calls, 1);
  await act(async () => ui.root.unmount()); roots.length = 0; ui.container.remove(); assert.equal(signal.aborted, true);
});

test('retry controls, skeleton labels and busy modal dismissal remain accessible', async () => {
  let retries = 0, closes = 0;
  const ui = mount(React.createElement(React.Fragment, null,
    React.createElement(ErrorState, { message: 'Lỗi thử nghiệm', onRetry: () => retries++ }),
    React.createElement(CardSkeletons, { count: 2 }),
    React.createElement(VModal, { open: true, title: 'Lưu ảnh', busy: true, onClose: () => closes++ }, 'Đang lưu'),
  ));
  await ui.render();
  const retry = [...ui.container.querySelectorAll('button')].find((button) => button.textContent === 'Thử lại');
  await act(async () => retry.click()); assert.equal(retries, 1);
  assert.ok(ui.container.querySelector('[aria-label="Đang tải danh sách"]'));
  const dialog = ui.container.querySelector('[role="dialog"]'); assert.equal(dialog.getAttribute('aria-busy'), 'true');
  await act(async () => dialog.parentElement.click()); assert.equal(closes, 0);
  assert.equal(dialog.querySelector('button').disabled, true);
});

test('simultaneous notifications occupy separate dismissible cards', async () => {
  const ui = mount(React.createElement(React.Fragment, null,
    React.createElement(NotificationViewport),
    React.createElement(VToast, { message: 'Đã lưu', onClose: () => {}, duration: 100000 }),
    React.createElement(VToast, { message: 'Lỗi tải ảnh', variant: 'error', onClose: () => {}, duration: 100000 }),
  ));
  await ui.render();
  assert.equal(ui.container.querySelectorAll('button[aria-label="Đóng thông báo"]').length, 2);
  assert.ok(ui.container.textContent.includes('Đã lưu')); assert.ok(ui.container.textContent.includes('Lỗi tải ảnh'));
});
