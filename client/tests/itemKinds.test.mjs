import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryOfKind, isMisfiled } from '../src/types/index.ts';

test('a piece whose photo shows another group is flagged, a kind the user chose is trusted', () => {
  // Quan short de o nhom Ao, AI luu "other" -> xep nham nhom.
  assert.equal(isMisfiled({ category: 'top', kind: 'other', detectedKind: 'shorts' }), true);
  assert.equal(isMisfiled({ category: 'top', kind: undefined, detectedKind: 'shorts' }), true);
  // User tu chon loai hop nhom -> tin user.
  assert.equal(isMisfiled({ category: 'top', kind: 'tshirt', detectedKind: 'shorts' }), false);
  // Anh khop nhom, hoac AI chua nhin / khong ro.
  assert.equal(isMisfiled({ category: 'bottom', kind: 'shorts', detectedKind: 'shorts' }), false);
  assert.equal(isMisfiled({ category: 'top', kind: 'other', detectedKind: 'other' }), false);
  assert.equal(isMisfiled({ category: 'top', kind: undefined, detectedKind: undefined }), false);
});

test('the group to move a misfiled piece to', () => {
  assert.equal(categoryOfKind('shorts'), 'bottom');
  assert.equal(categoryOfKind('heels'), 'shoes');
  // Loai thuoc 2 nhom (ao, ao khoac) -> nhom dau tien.
  assert.equal(categoryOfKind('hoodie'), 'top');
  assert.equal(categoryOfKind('other'), undefined);
});
