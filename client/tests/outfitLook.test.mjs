import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlausibleFit, trimmedImageUrl } from '../src/components/suggest/OutfitLook.tsx';

test('a saved fit dragged off the body is ignored in the outfit view', () => {
  const auto = { cx: 200, cy: 492, width: 129, height: 300 };
  assert.equal(isPlausibleFit({ cx: 210, cy: 500, width: 200, height: 320 }, auto), true);
  // Quan bi keo lech sang phai 107 don vi (so lieu that cua 1 mon trong tu) -> bo qua.
  assert.equal(isPlausibleFit({ cx: 307, cy: 550, width: 303, height: 404 }, auto), false);
  assert.equal(isPlausibleFit({ cx: 200, cy: 492, width: 40, height: 60 }, auto), false, 'too small');
  assert.equal(isPlausibleFit({ cx: 200, cy: 492, width: 500, height: 600 }, auto), false, 'too big');
});

test('only the app\'s Cloudinary uploads are trimmed, once', () => {
  assert.equal(
    trimmedImageUrl('https://res.cloudinary.com/demo/image/upload/v17/outfitcraft/u1/items/a.png'),
    'https://res.cloudinary.com/demo/image/upload/e_trim/f_auto,q_auto,c_limit,w_480/v17/outfitcraft/u1/items/a.png'
  );
  assert.equal(trimmedImageUrl('https://images.unsplash.com/photo-1?w=600'), 'https://images.unsplash.com/photo-1?w=600');
  assert.equal(trimmedImageUrl('not a url'), 'not a url');
});
