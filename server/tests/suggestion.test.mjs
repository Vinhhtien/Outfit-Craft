import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNeutralColor, isNeutralItem, colorRelation, itemColorRelation, isFormulaPair, styleCompat, scoreCombo, buildOutfitOptions,
} from '../src/services/suggestion.service.ts';

const weather = { city: 'Hanoi', temp: 27, feelsLike: 29, humidity: 70, condition: 'Clear', description: 'trời quang', icon: '01d', isRaining: false };
let seq = 0;
const item = (category, color, extra = {}) => ({
  _id: `item-${++seq}`, name: `${category}-${color}`, category, colors: color ? [color] : [],
  styles: [], seasons: [], occasions: [], tempRange: { min: 15, max: 35 }, wearCount: 1, ...extra,
});
const ids = (option) => Object.values(option).filter((v) => v && typeof v === 'object' && v._id).map((v) => v._id);
const buildAnchoredSuggestions = (anchor, items, w, occasion) => buildOutfitOptions(items, w, occasion, { anchor });

test('neutral colors and color-wheel relations', () => {
  for (const hex of ['#000000', '#ffffff', '#808080', '#f5f5dc', '#d2b48c', '#1a2340']) assert.equal(isNeutralColor(hex), true, hex);
  for (const hex of ['#ff0000', '#2e8b57', '#ff8c00']) assert.equal(isNeutralColor(hex), false, hex);
  assert.equal(colorRelation('#ffffff', '#ff0000'), 'neutral');
  assert.equal(colorRelation('#ff0000', '#ff4500'), 'analogous');
  assert.equal(colorRelation('#ff0000', '#00c0c0'), 'complementary');
  assert.equal(colorRelation('#ff0000', '#2eb82e'), 'clash');
  assert.equal(colorRelation(undefined, '#ff0000'), 'unknown');
});

test('denim-blue bottoms count as neutral, denim-blue tops do not', () => {
  for (const hex of ['#5b7db1', '#a6c0de']) {
    assert.equal(isNeutralItem(item('bottom', hex)), true, hex);
    assert.equal(isNeutralItem(item('top', hex)), false, hex);
  }
  const greenTop = item('top', '#3cb371');
  assert.equal(colorRelation('#5b7db1', '#3cb371'), 'clash');
  assert.equal(itemColorRelation(item('bottom', '#5b7db1'), greenTop), 'neutral');
  // Ao xanh denim khong phai trung tinh; xanh duong + xanh la nam trong cong thuc phoi mau.
  assert.equal(itemColorRelation(item('top', '#5b7db1'), greenTop), 'formula');
});

test('color formula pairs work both ways and only for listed chromatic pairs', () => {
  assert.equal(isFormulaPair('red', 'green'), true);
  assert.equal(isFormulaPair('green', 'red'), true);
  assert.equal(isFormulaPair('orange', 'blue'), true); // chi liet ke o hang Cam
  assert.equal(isFormulaPair('red', 'purple'), false);
  assert.equal(isFormulaPair('orange', 'pink'), false);
  assert.equal(isFormulaPair('red', 'red'), false);
  assert.equal(isFormulaPair('red', 'neutral'), false);
  assert.equal(isFormulaPair(null, 'red'), false);

  // Do + xanh la: tren vong mau la choi nhau, nhung hop theo cong thuc.
  assert.equal(colorRelation('#ff0000', '#2eb82e'), 'clash');
  assert.equal(itemColorRelation(item('top', '#ff0000'), item('bottom', '#2eb82e')), 'formula');
  // Do + tim: khong co trong bang -> giu quan he tren vong mau.
  assert.equal(itemColorRelation(item('top', '#ff0000'), item('bottom', '#8e44ad')), 'clash');
  // Cung tong van uu tien analogous.
  assert.equal(itemColorRelation(item('top', '#ff0000'), item('bottom', '#ff4500')), 'analogous');
});

test('formula pairs score between neutral and clashing pairs and explain why', () => {
  const s = (it) => ({ item: it, score: 80, reasons: [] });
  const red = s(item('top', '#ff0000'));
  const withBlack = scoreCombo([red, s(item('bottom', '#000000'))]);
  const withGreen = scoreCombo([red, s(item('bottom', '#2eb82e'))]);
  const withPurple = scoreCombo([red, s(item('bottom', '#8e44ad'))]);
  assert.ok(withBlack > withGreen && withGreen > withPurple, `${withBlack} > ${withGreen} > ${withPurple}`);

  const anchor = item('top', '#ff0000');
  const { options } = buildAnchoredSuggestions(anchor, [anchor, item('bottom', '#2eb82e')], weather);
  assert.ok(options[0].reasons.some((r) => r.includes('xanh lá') && r.includes('đỏ') && r.includes('công thức phối màu')),
    options[0].reasons.join(' | '));
});

test('a clashing accessory hurts the score less than a clashing bottom', () => {
  const s = (it) => ({ item: it, score: 80, reasons: [] });
  const red = s(item('top', '#ff0000'));
  const blackBottom = s(item('bottom', '#000000'));
  // Do + tim: choi mau va khong co trong cong thuc phoi mau.
  const clashingAccessory = scoreCombo([red, blackBottom, s(item('accessory', '#8e44ad'))]);
  const clashingBottom = scoreCombo([red, s(item('bottom', '#8e44ad')), s(item('accessory', '#000000'))]);
  assert.ok(clashingAccessory > clashingBottom);
  // Phu kien la mon dang ghim -> cap cua no tinh du trong so.
  const accent = s(item('accessory', '#8e44ad'));
  assert.ok(scoreCombo([red, blackBottom, accent], accent) < scoreCombo([red, blackBottom, accent]));
});

test('style compatibility is symmetric and tolerates missing styles', () => {
  assert.equal(styleCompat(['formal'], ['formal', 'party']), 100);
  assert.equal(styleCompat(['formal'], ['minimal']), styleCompat(['minimal'], ['formal']));
  assert.equal(styleCompat(['formal'], ['sporty']), 25);
  assert.equal(styleCompat([], ['sporty']), 60);
});

test('combo score prefers harmonious colors over clashing ones', () => {
  const s = (it) => ({ item: it, score: 80, reasons: [] });
  const red = item('top', '#ff0000');
  assert.ok(scoreCombo([s(red), s(item('bottom', '#000000'))]) > scoreCombo([s(red), s(item('bottom', '#8e44ad'))]));
});

test('anchored top keeps the anchor and picks a matching bottom', () => {
  const red = item('top', '#ff0000');
  const black = item('bottom', '#111111');
  const green = item('bottom', '#2eb82e');
  const shoes = item('shoes', '#ffffff');
  const { options, missing } = buildAnchoredSuggestions(red, [red, black, green, shoes, item('dress', '#ffc0cb')], weather);
  assert.deepEqual(missing, []);
  assert.ok(options.length >= 2 && options.length <= 3);
  for (const o of options) {
    assert.equal(o.top._id, red._id);
    assert.equal(o.dress, undefined);
  }
  assert.equal(options[0].bottom._id, black._id);
  assert.ok(options[0].totalScore >= options[1].totalScore);
  assert.ok(options[0].reasons.some((r) => r.includes('trung tính')));
});

test('options differ from each other', () => {
  const top = item('top', '#ffffff');
  const wardrobe = [top, ...['#000000', '#808080', '#1a2340'].map((c) => item('bottom', c)), item('shoes', '#000000'), item('shoes', '#ffffff')];
  const { options } = buildAnchoredSuggestions(top, wardrobe, weather);
  const keys = options.map((o) => ids(o).sort().join(','));
  assert.equal(new Set(keys).size, keys.length);
});

test('anchored dress or set skips top and bottom; outerwear anchor is kept in hot weather', () => {
  const dress = item('dress', '#ffc0cb');
  const wardrobe = [dress, item('top', '#ffffff'), item('bottom', '#000000'), item('shoes', '#000000')];
  const [option] = buildAnchoredSuggestions(dress, wardrobe, weather).options;
  assert.equal(option.dress._id, dress._id);
  assert.equal(option.top, undefined);
  assert.equal(option.bottom, undefined);

  const coat = item('outerwear', '#000000', { tempRange: { min: -5, max: 15 } });
  const hot = buildAnchoredSuggestions(coat, [coat, ...wardrobe], { ...weather, temp: 32 });
  assert.equal(hot.options[0].outerwear._id, coat._id);
  assert.ok(hot.options[0].top && hot.options[0].bottom || hot.options[0].dress);
  assert.match(hot.weatherWarning, /-5–15°C/);
});

test('missing partners are reported instead of failing', () => {
  const top = item('top', '#ff0000');
  const { options, missing } = buildAnchoredSuggestions(top, [top], weather);
  assert.equal(options.length, 1);
  assert.equal(options[0].top._id, top._id);
  assert.ok(missing.some((m) => m.includes('quần')));
  assert.ok(missing.some((m) => m.includes('giày')));
});
