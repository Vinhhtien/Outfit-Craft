import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';

const { apiFailure, cameraFailure, sessionEndedFailure, setupRejectedFailure, unsupportedFailure } = await import('../src/lib/tryOnErrors.ts');

const named = (name) => Object.assign(new Error('raw browser text'), { name });
const apiError = (status, data) => new AxiosError('failed', 'ERR', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} });

test('explains each camera problem in Vietnamese', () => {
  assert.equal(cameraFailure(named('NotAllowedError')).kind, 'camera-denied');
  assert.equal(cameraFailure(named('NotFoundError')).kind, 'camera-missing');
  assert.equal(cameraFailure(named('NotReadableError')).kind, 'camera-busy');
  assert.doesNotMatch(cameraFailure(named('NotAllowedError')).message, /raw browser/);
});

test('reports an insecure page and a browser without WebRTC separately', () => {
  assert.match(unsupportedFailure({ secure: false, media: false, webrtc: true }).message, /HTTPS/);
  assert.match(unsupportedFailure({ secure: true, media: true, webrtc: false }).message, /Trình duyệt/);
  assert.equal(unsupportedFailure({ secure: true, media: true, webrtc: true }), null);
});

test('recognises the quota errors from the backend', () => {
  const quota = apiFailure(apiError(403, { code: 'TRYON_QUOTA_EXCEEDED', message: 'Bạn đã dùng hết thời lượng.' }));
  assert.deepEqual(quota, { kind: 'quota', message: 'Bạn đã dùng hết thời lượng.' });
  assert.equal(apiFailure(apiError(409, { code: 'TRYON_SESSION_OVER', message: 'Phiên đã kết thúc.' })).kind, 'session-over');
});

test('treats a refused garment as fatal but leaves retried errors to the SDK', () => {
  assert.equal(setupRejectedFailure('WEBRTC_SIGNALING_ERROR').kind, 'service');
  assert.equal(setupRejectedFailure('WEBRTC_TIMEOUT_ERROR').kind, 'service');
  assert.equal(setupRejectedFailure('WEBRTC_SERVER_ERROR'), null);
  assert.equal(setupRejectedFailure('WEBRTC_WEBSOCKET_ERROR'), null);
});

test('gives a readable reason when the provider ends a session', () => {
  assert.match(sessionEndedFailure('insufficient_credits').message, /hạn mức/);
  assert.match(sessionEndedFailure('something_new').message, /kết thúc/);
});
