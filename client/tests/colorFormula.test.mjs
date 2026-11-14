import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_FORMULA, colorGroupOf, goesWith, isFormulaPair, itemColorGroup } from '../src/lib/colorFormula.ts';
import { COLOR_FORMULA as SERVER_FORMULA, colorGroupOf as serverGroupOf } from '../../server/src/services/suggestion.service.ts';

const item = (category, hex) => ({ category, colors: [hex] });

test('the chart has 8 rows of 8 partners, matching the original image', () => {
  assert.deepEqual(COLOR_FORMULA.map((r) => r.group), ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown']);
  for (const row of COLOR_FORMULA) assert.equal(row.partners.length, 8, row.group);
  assert.equal(COLOR_FORMULA.find((r) => r.group === 'blue').name, 'Xanh dương');
});

test('client chart and server scoring use the same color pairs', () => {
  for (const row of COLOR_FORMULA) {
    const chromatic = [...new Set(row.partners.map((p) => p.group).filter((g) => g !== 'neutral' && g !== row.group))];
    assert.deepEqual(chromatic.sort(), [...SERVER_FORMULA[row.group]].sort(), row.group);
  }
});

test('client color grouping mirrors the server', () => {
  for (const hex of ['#000000', '#ffffff', '#1a2340', '#ff0000', '#ff8c00', '#f2c94c', '#2eb82e', '#4a7fc1', '#8e44ad', '#f8b4cf', '#7b4f2c']) {
    assert.equal(colorGroupOf(hex), serverGroupOf(hex), hex);
  }
});

test('formula pairs work both ways', () => {
  assert.equal(isFormulaPair('red', 'green'), true);
  assert.equal(isFormulaPair('blue', 'orange'), true); // chi liet ke o hang Cam
  assert.equal(isFormulaPair('red', 'purple'), false);
  assert.equal(isFormulaPair('red', 'red'), false);
  assert.equal(isFormulaPair('red', 'neutral'), false);
});

test('goesWith keeps neutrals, same color and formula partners only', () => {
  assert.equal(goesWith('red', item('bottom', '#000000')), true); // trung tinh
  assert.equal(goesWith('red', item('top', '#e53935')), true); // cung mau
  assert.equal(goesWith('red', item('bottom', '#2eb82e')), true); // cong thuc
  assert.equal(goesWith('red', item('bottom', '#8e44ad')), false); // do + tim khong co trong bang
  assert.equal(goesWith('orange', item('top', '#f8b4cf')), false); // cam + hong khong co trong bang
  assert.equal(goesWith('red', item('bottom', 'not-a-color')), false);
});

test('denim-blue bottoms count as neutral, denim-blue tops do not', () => {
  assert.equal(itemColorGroup(item('bottom', '#5b7db1')), 'neutral');
  assert.equal(itemColorGroup(item('top', '#5b7db1')), 'blue');
});
