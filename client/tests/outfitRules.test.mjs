import test from 'node:test';
import assert from 'node:assert/strict';
import { planAdd } from '../src/lib/outfitRules.ts';

const p = (_id, category) => ({ _id, category });

test('a new top replaces the old top in place', () => {
  assert.deepEqual(planAdd([p('t1', 'top'), p('b1', 'bottom')], 'top'), { replace: 't1', remove: [] });
});

test('extra pieces of the same slot are removed too (cleans up an overcrowded canvas)', () => {
  const canvas = [p('t1', 'top'), p('t2', 'top'), p('t3', 'top'), p('b1', 'bottom')];
  assert.deepEqual(planAdd(canvas, 'top'), { replace: 't1', remove: ['t2', 't3'] });
});

test('a dress replaces top and bottom, and a top or bottom replaces a dress', () => {
  const canvas = [p('t1', 'top'), p('b1', 'bottom'), p('s1', 'shoes')];
  assert.deepEqual(planAdd(canvas, 'dress'), { replace: null, remove: ['t1', 'b1'] });
  assert.deepEqual(planAdd([p('d1', 'dress'), p('s1', 'shoes')], 'top'), { replace: null, remove: ['d1'] });
  assert.deepEqual(planAdd([p('d1', 'dress')], 'set'), { replace: null, remove: ['d1'] });
});

test('outerwear is its own layer over the top', () => {
  assert.deepEqual(planAdd([p('t1', 'top'), p('o1', 'outerwear')], 'outerwear'), { replace: 'o1', remove: [] });
  assert.deepEqual(planAdd([p('t1', 'top')], 'outerwear'), { replace: null, remove: [] });
  assert.deepEqual(planAdd([p('o1', 'outerwear')], 'top'), { replace: null, remove: [] });
});

test('one pair of shoes and one bag, but any number of accessories', () => {
  assert.deepEqual(planAdd([p('s1', 'shoes')], 'shoes'), { replace: 's1', remove: [] });
  assert.deepEqual(planAdd([p('g1', 'bag')], 'bag'), { replace: 'g1', remove: [] });
  assert.deepEqual(planAdd([p('a1', 'accessory')], 'accessory'), { replace: null, remove: [] });
});

test('layering mode never replaces anything', () => {
  assert.deepEqual(planAdd([p('t1', 'top'), p('b1', 'bottom')], 'dress', true), { replace: null, remove: [] });
});
