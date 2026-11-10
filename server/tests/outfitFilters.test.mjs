import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfitOptions, colorGroupOf, itemMatchesColor, kindLabel } from '../src/services/suggestion.service.ts';
import {
  colorsFromXanh, describeWardrobeItem, mergeStylistRequest, parseStylistIntent, weatherForRequest,
} from '../src/services/stylist.service.ts';
import { parseItemKinds } from '../src/services/itemKind.service.ts';
import { parseItemTags } from '../src/services/autoTag.service.ts';

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

test('an excluded item is never picked and the note says why the slot is empty', () => {
  const top = item('top', '#ffffff');
  const skirt = item('bottom', '#808080');
  const jeans = item('bottom', '#000000');
  for (let seed = 1; seed <= 10; seed++) {
    const { options } = buildOutfitOptions([top, skirt, jeans], weather, undefined, {
      exclude: [skirt._id], shuffle: { rng: seededRng(seed) },
    });
    for (const option of options) assert.ok(!ids(option).includes(skirt._id));
  }
  const { missing } = buildOutfitOptions([top, skirt], weather, undefined, { exclude: [skirt._id] });
  assert.ok(missing.some((m) => m.includes('Ngoài món bạn đã bỏ')), missing.join(' | '));
});

test('requested items are always in the outfit, even when they score low', () => {
  const tees = Array.from({ length: 5 }, () => item('top', '#ffffff', { occasions: ['work'] }));
  const sweaters = [
    item('top', '#ffc0cb', { name: 'Áo len hồng', tempRange: { min: 5, max: 20 } }),
    item('top', '#808080', { name: 'Áo len xám', tempRange: { min: 5, max: 20 } }),
  ];
  const dress = item('dress', '#000000', { occasions: ['work'] });
  const bottom = item('bottom', '#000000');
  const wardrobe = [...tees, ...sweaters, dress, bottom];
  const include = sweaters.map((s) => s._id);

  const plain = buildOutfitOptions(wardrobe, weather, 'work', { include });
  assert.ok(include.includes(plain.pinned._id));
  assert.match(plain.weatherWarning, /27°C/);
  for (const option of plain.options) assert.ok(include.includes(option.top?._id));

  for (let seed = 1; seed <= 10; seed++) {
    const { options } = buildOutfitOptions(wardrobe, weather, 'work', { include, shuffle: { rng: seededRng(seed) } });
    for (const option of options) assert.ok(include.includes(option.top?._id));
  }
});

test('asking for a different outfit changes the main pieces, not just one of them', () => {
  const tops = [item('top', '#ffffff'), item('top', '#808080'), item('top', '#000000')];
  const bottoms = [item('bottom', '#000000'), item('bottom', '#c0c0c0', { tempRange: { min: 15, max: 30 } })];
  const wardrobe = [...tops, ...bottoms];
  const shown = buildOutfitOptions(wardrobe, weather).options[0];
  const avoid = ids(shown);
  for (let seed = 1; seed <= 20; seed++) {
    const next = buildOutfitOptions(wardrobe, weather, undefined, {
      shuffle: { rng: seededRng(seed), seen: [shown.key], avoid },
    }).options[0];
    assert.ok(!ids(next).some((id) => avoid.includes(id)), `seed ${seed} van lap mon cu`);
  }
});

test('a follow-up keeps the earlier conditions and only overrides what the user changed', () => {
  const empty = { seasons: [], colorGroups: [], styles: [], includeItems: [] };
  const winter = { ...empty, seasons: ['winter'], temperature: 18, occasion: 'work' };

  // "con bo nao khac ko": khong noi gi moi -> giu het.
  const same = mergeStylistRequest(winter, empty, false);
  assert.deepEqual(same.request, { ...winter });
  assert.deepEqual(same.kept, ['dịp đi làm', 'mùa đông', 'khoảng 18°C']);

  // Chi doi mau: giu mua + nhiet do, them mau.
  const red = mergeStylistRequest(winter, { ...empty, colorGroups: ['red'] }, false);
  assert.deepEqual(red.request.seasons, ['winter']);
  assert.equal(red.request.temperature, 18);
  assert.deepEqual(red.request.colorGroups, ['red']);

  // Noi nhiet do moi thi dung nhiet do moi.
  assert.equal(mergeStylistRequest(winter, { ...empty, temperature: 10 }, false).request.temperature, 10);

  // Yeu cau moi hoan toan hoac chua co yeu cau truoc: khong giu gi.
  assert.deepEqual(mergeStylistRequest(winter, empty, true), { request: empty, kept: [] });
  assert.deepEqual(mergeStylistRequest(null, empty, false), { request: empty, kept: [] });
});

test('a requested temperature replaces today\'s weather without hiding the real one', () => {
  const asked = weatherForRequest(weather, 18);
  assert.equal(asked.temp, 18);
  assert.equal(asked.city, 'Hanoi');
  assert.match(asked.description, /thực tế hôm nay 27°C/);
  assert.equal(weatherForRequest(weather, undefined), weather);

  // Ao am thang khi chon do cho 18 do, du hom nay 27 do.
  const warmTop = item('top', '#808080', { tempRange: { min: 5, max: 20 } });
  const tee = item('top', '#ffffff', { tempRange: { min: 22, max: 40 } });
  const bottom = item('bottom', '#000000');
  assert.equal(buildOutfitOptions([warmTop, tee, bottom], weather).options[0].top._id, tee._id);
  assert.equal(buildOutfitOptions([warmTop, tee, bottom], asked).options[0].top._id, warmTop._id);
});

test('at 20°C a sweater and jeans beat a tank top and shorts, even with the same category defaults', () => {
  const cool = { ...weather, temp: 20 };
  const defaults = (category) => ({ tempRange: category === 'top' ? { min: 18, max: 35 } : { min: 15, max: 35 } });
  const tank = item('top', '#ffffff', { ...defaults('top'), kind: 'tank', wearCount: 0 });
  const tee = item('top', '#5bc0de', { ...defaults('top'), kind: 'tshirt' });
  const sweater = item('top', '#c0392b', { ...defaults('top'), kind: 'sweater' });
  const shorts = item('bottom', '#808080', { ...defaults('bottom'), kind: 'shorts', wearCount: 0 });
  const jeans = item('bottom', '#000000', { ...defaults('bottom'), kind: 'jeans' });

  const { options, weatherFit } = buildOutfitOptions([tank, tee, sweater, shorts, jeans], cool);
  assert.equal(options[0].top._id, sweater._id);
  assert.equal(options[0].bottom._id, jeans._id);
  assert.deepEqual(weatherFit, []);

  // Khong co lua chon am hon thi noi that, khong im lang.
  const onlySummer = buildOutfitOptions([tank, shorts], cool);
  assert.ok(onlySummer.weatherFit.some((m) => m.includes('Tủ chưa có áo ấm hơn cho 20°C')), onlySummer.weatherFit.join(' | '));
  assert.ok(onlySummer.weatherFit.some((m) => m.includes('quần ấm hơn')));
});

test('seasons tagged on an item are compared with the temperature, not the calendar', () => {
  const cool = { ...weather, temp: 12 };
  const summerTop = item('top', '#ffffff', { seasons: ['summer'], tempRange: { min: 0, max: 40 } });
  const winterTop = item('top', '#ffffff', { seasons: ['winter'], tempRange: { min: 0, max: 40 } });
  const bottom = item('bottom', '#000000', { tempRange: { min: 0, max: 40 } });
  assert.equal(buildOutfitOptions([summerTop, winterTop, bottom], cool).options[0].top._id, winterTop._id);
  assert.equal(buildOutfitOptions([summerTop, winterTop, bottom], { ...weather, temp: 33 }).options[0].top._id, summerTop._id);
});

test('stylist intent keeps only valid values from the AI response', () => {
  assert.deepEqual(
    parseStylistIntent(JSON.stringify({
      intent: 'outfit', occasion: 'date', seasons: ['summer', 'rainy'], colorGroups: ['blue', 'gold'],
      styles: ['casual', 42], wantsDifferent: true,
      includeItems: ['m1', 'm1', 'x9', 7, 'm22'], excludeItems: ['m3', '507f1f77bcf86cd799439011'], unavailable: ' áo len ', temperature: 17.6, newRequest: true,
    })),
    {
      intent: 'outfit', occasion: 'date', seasons: ['summer'], colorGroups: ['blue'], styles: ['casual'], wantsDifferent: true,
      includeItems: ['m1', 'm22'], excludeItems: ['m3'], unavailable: 'áo len', temperature: 18, newRequest: true,
    }
  );
  assert.deepEqual(
    parseStylistIntent('{"intent":"outfit","occasion":"beach"}'),
    {
      intent: 'outfit', occasion: undefined, seasons: [], colorGroups: [], styles: [], wantsDifferent: false,
      includeItems: [], excludeItems: [], newRequest: false,
    }
  );
  assert.deepEqual(parseStylistIntent('{"intent":"question","reply":" Chào bạn "}'), { intent: 'question', reply: 'Chào bạn' });
});

test('item kinds from the AI are checked against the item group', () => {
  const categories = ['top', 'bottom', 'shoes'];
  const raw = JSON.stringify({ items: [
    { index: 1, kind: 'sweater' }, { index: 2, kind: 'sneakers' }, { index: 3, kind: 'boots' },
    { index: 4, kind: 'jeans' }, { index: 0, kind: 'tshirt' }, { index: 1.5, kind: 'tshirt' }, { index: 3, kind: 'pirate' },
  ] });
  assert.deepEqual([...parseItemKinds(raw, categories)], [[0, 'sweater'], [1, 'other'], [2, 'boots']]);
  for (const broken of [null, '', 'not json', 'null', '{"items":"x"}']) assert.equal(parseItemKinds(broken, categories).size, 0);
});

test('auto-tag suggests the group, kind and name, and drops a kind from the wrong group', () => {
  const base = { styles: ['casual'], seasons: ['winter'], occasions: ['daily'] };
  assert.deepEqual(
    parseItemTags(JSON.stringify({ ...base, category: 'top', kind: 'sweater', name: '  Áo len đỏ   hình búp bê ' })),
    { ...base, category: 'top', kind: 'sweater', name: 'Áo len đỏ hình búp bê' }
  );
  // Thieu nhom thi suy ra tu loai; loai lech nhom thi bo loai, giu nhom.
  assert.equal(parseItemTags(JSON.stringify({ ...base, kind: 'skirt' })).category, 'bottom');
  const wrong = parseItemTags(JSON.stringify({ ...base, category: 'shoes', kind: 'skirt', name: 'x'.repeat(61) }));
  assert.equal(wrong.category, 'shoes');
  assert.equal(wrong.kind, undefined);
  assert.equal(wrong.name, undefined);
  assert.deepEqual(parseItemTags(JSON.stringify(base)), base);
});

test('the stylist names pieces by their recognised kind', () => {
  assert.equal(kindLabel({ category: 'top', kind: 'sweater' }), 'áo len');
  assert.equal(kindLabel({ category: 'top', kind: 'other' }), 'áo');
  assert.equal(kindLabel({ category: 'bottom' }), 'quần');
  assert.equal(describeWardrobeItem(item('top', '#ffc0cb', { name: 'Áo Snoopy', kind: 'sweater' })), 'Áo Snoopy (áo len, màu hồng)');
  assert.equal(describeWardrobeItem(item('bottom', '#000000', { name: 'Váy xếp ly' })), 'Váy xếp ly (quần/chân váy, màu trung tính)');
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
