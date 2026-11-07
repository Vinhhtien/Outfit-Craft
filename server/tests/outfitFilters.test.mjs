import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfitOptions, colorGroupOf, itemMatchesColor } from '../src/services/suggestion.service.ts';
import { colorsFromXanh, parseStylistIntent } from '../src/services/stylist.service.ts';

const weather = { city: 'Hanoi', temp: 27, feelsLike: 29, humidity: 70, condition: 'Clear', description: 'trời quang', icon: '01d', isRaining: false };
let seq = 0;
const item = (category, color, extra = {}) => ({
  _id: `mix-${++seq}`, name: `${category}-${color}`, category, colors: color ? [color] : [],
  styles: [], seasons: [], occasions: [], tempRange: { min: 15, max: 35 }, wearCount: 1, ...extra,
});
const ids = (option) => Object.values(option).filter((v) => v && typeof v === 'object' && v._id).map((v) => v._id);
const seededRng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test('hex colors fall into the expected groups', () => {
  const expected = {
    '#000000': 'neutral', '#ff0000': 'red', '#ff8c00': 'orange', '#ffd700': 'yellow', '#2e8b57': 'green',
    '#1e90ff': 'blue', '#8a2be2': 'purple', '#ffc0cb': 'pink', '#8b4513': 'brown',
  };
  for (const [hex, group] of Object.entries(expected)) assert.equal(colorGroupOf(hex), group, hex);
  assert.equal(colorGroupOf(undefined), null);
  assert.equal(colorGroupOf('xanh'), null);
});

test('denim bottoms match both blue and neutral filters', () => {
  const jeans = item('bottom', '#5b7db1');
  assert.equal(itemMatchesColor(jeans, ['blue']), true);
  assert.equal(itemMatchesColor(jeans, ['neutral']), true);
  assert.equal(itemMatchesColor(item('top', '#5b7db1'), ['neutral']), false);
});

test('without an anchor it builds a full outfit including a bag', () => {
  const wardrobe = [item('top', '#ffffff'), item('bottom', '#000000'), item('shoes', '#000000'), item('bag', '#000000')];
  const { options, missing } = buildOutfitOptions(wardrobe, weather);
  assert.deepEqual(missing, []);
  assert.equal(ids(options[0]).length, 4);
  assert.ok(options[0].bag);
  assert.match(options[0].key, /^[0-9a-f]{10}$/);
  assert.ok(options[0].totalScore > 0);
});

test('an empty wardrobe slot is reported and never throws', () => {
  const { options, missing } = buildOutfitOptions([], weather);
  assert.equal(options.length, 1);
  assert.equal(ids(options[0]).length, 0);
  assert.ok(missing.some((m) => m.includes('giày')));
});

test('season filter drops other seasons, keeps untagged items and the anchor', () => {
  const winterTop = item('top', '#000000', { seasons: ['winter'] });
  const summerTop = item('top', '#ffffff', { seasons: ['summer'] });
  const untaggedBottom = item('bottom', '#000000');
  const anchor = item('shoes', '#000000', { seasons: ['winter'] });
  const { options } = buildOutfitOptions([winterTop, summerTop, untaggedBottom, anchor], weather, undefined, {
    anchor, filters: { seasons: ['summer'] },
  });
  for (const option of options) {
    assert.ok(!ids(option).includes(winterTop._id));
    assert.ok(ids(option).includes(untaggedBottom._id));
    assert.ok(ids(option).includes(anchor._id));
  }
});

test('season filter explains which slot has nothing left', () => {
  const wardrobe = [item('top', '#000000', { seasons: ['winter'] }), item('bottom', '#000000', { seasons: ['summer'] })];
  const { missing } = buildOutfitOptions(wardrobe, weather, undefined, { filters: { seasons: ['summer'] } });
  assert.ok(missing.some((m) => m.includes('hợp mùa đã chọn')));
});

test('choosing a season that does not fit today warns but still suggests', () => {
  const wardrobe = [item('top', '#000000', { seasons: ['winter'] }), item('bottom', '#000000', { seasons: ['winter'] })];
  const { options, seasonWarning } = buildOutfitOptions(wardrobe, weather, undefined, { filters: { seasons: ['winter'] } });
  assert.equal(ids(options[0]).length, 2);
  assert.match(seasonWarning, /27°C/);
  const fitting = buildOutfitOptions(wardrobe, weather, undefined, { filters: { seasons: ['summer', 'winter'] } });
  assert.equal(fitting.seasonWarning, undefined);
});

test('color filter needs one main piece, even when it scores lower than the rest', () => {
  const goodTops = Array.from({ length: 5 }, () => item('top', '#ffffff', { occasions: ['work'], seasons: ['spring', 'summer', 'autumn', 'winter'] }));
  const redTop = item('top', '#ff0000', { tempRange: { min: 0, max: 20 } });
  const bottom = item('bottom', '#000000');
  const shoes = item('shoes', '#000000');
  const { options, missing } = buildOutfitOptions([...goodTops, redTop, bottom, shoes], weather, 'work', {
    filters: { colorGroups: ['red'] },
  });
  assert.deepEqual(missing, []);
  for (const option of options) assert.equal(option.top._id, redTop._id);
});

test('a matching accessory alone does not satisfy the color filter', () => {
  const wardrobe = [item('top', '#ffffff'), item('bottom', '#000000'), item('shoes', '#000000'), item('accessory', '#ff0000')];
  const { options, missing } = buildOutfitOptions(wardrobe, weather, undefined, { filters: { colorGroups: ['red'] } });
  assert.ok(ids(options[0]).length > 0);
  assert.ok(missing.some((m) => m.includes('đỏ')));
});

test('preferred styles lift matching items without removing the others', () => {
  const sporty = item('top', '#ffffff', { styles: ['sporty'] });
  const plain = item('top', '#ffffff', { wearCount: 0 });
  const bottom = item('bottom', '#000000');
  const { options } = buildOutfitOptions([plain, sporty, bottom], weather, undefined, { filters: { styles: ['sporty'] } });
  assert.equal(options[0].top._id, sporty._id);
  assert.equal(buildOutfitOptions([plain, bottom], weather, undefined, { filters: { styles: ['sporty'] } }).options[0].top._id, plain._id);
});

test('without shuffle the result is stable', () => {
  const wardrobe = [item('top', '#ffffff'), item('top', '#000000'), item('bottom', '#000000'), item('bottom', '#808080')];
  assert.deepEqual(
    buildOutfitOptions(wardrobe, weather).options.map((o) => o.key),
    buildOutfitOptions(wardrobe, weather).options.map((o) => o.key)
  );
});

test('shuffle varies the outfit but never picks a poor item', () => {
  const tops = Array.from({ length: 6 }, () => item('top', '#ffffff'));
  const bottoms = Array.from({ length: 4 }, () => item('bottom', '#000000'));
  const badTop = item('top', '#ffffff', { tempRange: { min: 0, max: 5 } });
  const wardrobe = [...tops, ...bottoms, badTop];
  const firstKeys = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { options } = buildOutfitOptions(wardrobe, weather, undefined, { shuffle: { rng: seededRng(seed) } });
    firstKeys.add(options[0].key);
    for (const option of options) assert.notEqual(option.top._id, badTop._id);
  }
  assert.ok(firstKeys.size > 3, `chi co ${firstKeys.size} bo khac nhau`);
});

test('shuffle skips outfits already seen, and repeats only when nothing is left', () => {
  const wardrobe = [item('top', '#ffffff'), item('top', '#000000'), item('bottom', '#000000'), item('bottom', '#808080')];
  const first = buildOutfitOptions(wardrobe, weather, undefined, { shuffle: { rng: seededRng(7) } }).options.map((o) => o.key);
  const next = buildOutfitOptions(wardrobe, weather, undefined, { shuffle: { rng: seededRng(8), seen: first } }).options.map((o) => o.key);
  assert.ok(next.length > 0);
  for (const key of next) assert.ok(!first.includes(key));

  const all = [...first, ...next];
  const rest = buildOutfitOptions(wardrobe, weather, undefined, { shuffle: { rng: seededRng(9), seen: all } }).options;
  assert.ok(rest.length > 0);
});

test('shuffle keeps the pinned item and the color filter', () => {
  const anchor = item('bottom', '#000000');
  const red = item('top', '#ff0000');
  const wardrobe = [anchor, red, item('top', '#ffffff'), item('top', '#808080')];
  for (let seed = 1; seed <= 10; seed++) {
    const { options } = buildOutfitOptions(wardrobe, weather, undefined, {
      anchor, filters: { colorGroups: ['red'] }, shuffle: { rng: seededRng(seed) },
    });
    for (const option of options) {
      assert.equal(option.bottom._id, anchor._id);
      assert.equal(option.top._id, red._id);
    }
  }
});

test('stylist intent keeps only valid values from the AI response', () => {
  assert.deepEqual(
    parseStylistIntent(JSON.stringify({
      intent: 'outfit', occasion: 'date', seasons: ['summer', 'rainy'], colorGroups: ['blue', 'gold'],
      styles: ['casual', 42], wantsDifferent: true,
    })),
    { intent: 'outfit', occasion: 'date', seasons: ['summer'], colorGroups: ['blue'], styles: ['casual'], wantsDifferent: true }
  );
  assert.deepEqual(
    parseStylistIntent('{"intent":"outfit","occasion":"beach"}'),
    { intent: 'outfit', occasion: undefined, seasons: [], colorGroups: [], styles: [], wantsDifferent: false }
  );
  assert.deepEqual(parseStylistIntent('{"intent":"question","reply":" Chào bạn "}'), { intent: 'question', reply: 'Chào bạn' });
});

test('the ambiguous word "xanh" is understood even when the AI skips it', () => {
  assert.deepEqual(colorsFromXanh('Muốn đơn giản mà có điểm nhấn màu xanh'), ['blue', 'green']);
  assert.deepEqual(colorsFromXanh('Chọn bộ XANH DƯƠNG giúp mình'), ['blue']);
  assert.deepEqual(colorsFromXanh('Áo xanh rêu phối sao'), ['green']);
  assert.deepEqual(colorsFromXanh('Mình không muốn mặc màu xanh'), []);
  assert.deepEqual(colorsFromXanh('Tránh đồ xanh lá nhé'), []);
  assert.deepEqual(colorsFromXanh('Mai đi làm mặc gì'), []);
});

test('broken AI responses are rejected instead of crashing', () => {
  for (const raw of [null, '', 'not json', 'null', '[]', '{"intent":"other"}', '{"intent":"question"}', '{"intent":"question","reply":"  "}']) {
    assert.equal(parseStylistIntent(raw), null, String(raw));
  }
});
