import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPlace } from '../src/lib/outfitPlacement.ts';
import { buildMannequin } from '../src/lib/mannequin.ts';

const bottomEdge = (box) => box.cy + box.height / 2;

test('long items are shrunk so they never extend past the feet', () => {
  for (const profile of [{ gender: 'female', shape: 'pear', measurements: { heightCm: 152 } }, { gender: 'neutral', shape: 'rectangle' }]) {
    const { anchors } = buildMannequin(profile);
    for (const [category, aspect] of [['bottom', 4], ['dress', 5], ['top', 6]]) {
      const { box } = autoPlace(category, aspect, anchors);
      assert.ok(bottomEdge(box) <= anchors.footBottom.y + 1e-6, `${category} tran qua ban chan`);
      assert.ok(Math.abs(box.height / box.width - aspect) < 1e-6, `${category} bi meo ti le`);
    }
  }
});

test('items that already fit keep the default body-based width', () => {
  const { anchors } = buildMannequin();
  const { box } = autoPlace('bottom', 1, anchors);
  assert.ok(Math.abs(box.width - anchors.hipWidth * 1.1) < 1e-6);
  assert.equal(box.cy - box.height / 2, anchors.waist.y);
});
