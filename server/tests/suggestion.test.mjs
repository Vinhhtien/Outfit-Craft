import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNeutralColor, isNeutralItem, colorRelation, itemColorRelation, isFormulaPair, styleCompat, scoreCombo, buildOutfitOptions,
  scoreItem, occasionFitOf, isMisfiled, effectiveKind, recommendedKinds, formalityOf, formalityGap, genderOf, mixesGenders, patternedCount, styleOutfit,
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

/* ---------- Hop dip theo loai do + mon xep nham nhom ---------- */
const piece = (category, kind, extra = {}) => item(category, '#000000', { kind, name: `${category}-${kind}`, ...extra });

test('shorts filed as a top and tagged party are never used as a top', () => {
  const shortsAsTop = piece('top', 'other', { detectedKind: 'shorts', occasions: ['party'], wearCount: 0, name: 'Quần đùi' });
  const blouse = piece('top', 'blouse');
  const trousers = piece('bottom', 'trousers');
  const heels = piece('shoes', 'heels');
  const { options, misfiled } = buildOutfitOptions([shortsAsTop, blouse, trousers, heels], weather, 'party');
  assert.ok(options.length > 0);
  for (const option of options) assert.ok(!ids(option).includes(shortsAsTop._id));
  assert.equal(options[0].top._id, blouse._id);
  assert.equal(misfiled.length, 1);
  assert.ok(misfiled[0].includes('Quần đùi') && misfiled[0].includes('quần short'));
});

test('kind decides the occasion: party-tagged shorts lose to trousers and get no tag bonus', () => {
  const shorts = piece('bottom', 'shorts', { occasions: ['party'], wearCount: 0 });
  const trousers = piece('bottom', 'trousers');
  const scored = scoreItem(shorts, weather, 'party');
  assert.equal(scored.unsuitable, true);
  assert.ok(!scored.reasons.some((r) => r.startsWith('Phù hợp dịp')));
  assert.ok(scored.reasons.some((r) => r.includes('không hợp dịp tiệc tùng')));
  assert.ok(scoreItem(trousers, weather, 'party').score > scored.score);

  const { options, occasionFit } = buildOutfitOptions([piece('top', 'blouse'), shorts, trousers, piece('shoes', 'heels')], weather, 'party');
  for (const option of options) assert.equal(option.bottom._id, trousers._id);
  assert.deepEqual(occasionFit, []);
  assert.ok(options.every((o) => !o.occasionMismatch));
});

test('a wardrobe with nothing fit for the occasion says so and names what to add', () => {
  const shorts = piece('bottom', 'shorts', { name: 'Quần short kaki' });
  const joggers = piece('bottom', 'joggers');
  const { options, missing } = buildOutfitOptions([piece('top', 'shirt'), shorts, joggers, piece('shoes', 'loafers')], weather, 'work');
  // Khong ghep quan short di lam: de trong cho quan va noi ro nen bo sung gi.
  assert.ok(options.length > 0);
  for (const option of options) assert.equal(option.bottom, undefined);
  assert.deepEqual(missing, ['Tủ chưa có quần hợp dịp đi làm. Nên bổ sung: quần âu/quần tây, quần dài vải/kaki, chân váy']);
});

test('without an occasion nothing is penalised, and a kind the user chose is trusted', () => {
  const shorts = piece('bottom', 'shorts');
  const { options, occasionFit, misfiled } = buildOutfitOptions([piece('top', 'tshirt'), shorts], weather);
  assert.equal(options[0].bottom._id, shorts._id);
  assert.deepEqual(occasionFit, []);
  assert.deepEqual(misfiled, []);
  assert.equal(occasionFitOf(shorts), 0);

  // User tu chon loai hop nhom -> khong coi la xep nham du AI thay khac.
  const chosen = piece('top', 'tshirt', { detectedKind: 'shorts' });
  assert.equal(isMisfiled(chosen), false);
  assert.equal(effectiveKind(chosen), 'tshirt');
  // Chua co loai: lay loai AI thay neu hop nhom.
  assert.equal(effectiveKind(piece('top', undefined, { detectedKind: 'sweater' })), 'sweater');
});

test('sport avoids heels when sneakers exist, and recommends kinds per occasion', () => {
  const heels = piece('shoes', 'heels');
  const sneakers = piece('shoes', 'sneakers');
  const { options } = buildOutfitOptions([piece('top', 'tshirt'), piece('bottom', 'joggers'), heels, sneakers], weather, 'sport');
  for (const option of options) assert.equal(option.shoes._id, sneakers._id);
  assert.deepEqual(recommendedKinds('bottom', 'work'), ['trousers', 'pants', 'skirt']);
  assert.deepEqual(recommendedKinds('bottom', 'daily'), []);
});

/* ---------- Dong deu do trang trong (vay tiec khong di dep suc) ---------- */
const daNang = { ...weather, city: 'Da Nang', temp: 30 };
const partyDress = () => item('dress', '#e64fb3', {
  kind: 'dress', name: 'Váy liền hồng ánh kim', styles: ['party', 'streetwear'], occasions: ['party', 'date'],
});
const clogs = (kind) => item('shoes', '#111111', {
  kind, name: 'dép sục trơn', styles: ['streetwear', 'casual'], occasions: ['daily', 'sport', 'school'],
});
const groomShoes = () => item('shoes', '#5a3a22', {
  kind: 'loafers', name: 'giày da chú rể', styles: ['formal', 'minimal'], occasions: ['date', 'party', 'travel'],
});
const whiteSneakers = () => item('shoes', '#ffffff', { name: 'Giày Sneaker Trắng', styles: ['casual', 'sporty'], occasions: ['daily'] });

test('date night: a party dress goes with leather shoes, not clogs (even clogs saved as sandals)', () => {
  for (const kind of ['sandals', 'slippers']) {
    const dress = partyDress(), shoes = groomShoes(), clog = clogs(kind);
    const { options } = buildOutfitOptions([dress, clog, shoes, whiteSneakers()], daNang, 'date');
    assert.equal(options[0].dress._id, dress._id, kind);
    assert.equal(options[0].shoes._id, shoes._id, kind);
  }
});

test('clogs are unfit for a date, and the advice says what to buy when nothing else exists', () => {
  const clog = clogs('slippers');
  assert.equal(scoreItem(clog, daNang, 'date').unsuitable, true);
  const { options, missing } = buildOutfitOptions([partyDress(), clog], daNang, 'date');
  // Chi hien chiec vay, khong ghep dep suc; noi ro nen sam giay gi.
  assert.equal(options[0].dress.name, 'Váy liền hồng ánh kim');
  assert.equal(options[0].shoes, undefined);
  assert.ok(missing.some((m) => m.startsWith('Tủ chưa có giày hợp dịp hẹn hò. Nên bổ sung: giày cao gót')), JSON.stringify(missing));
});

test('pieces in one outfit match in formality, whatever the occasion', () => {
  const dress = partyDress();
  assert.equal(formalityOf(dress), 3);
  assert.equal(formalityOf(clogs('slippers')), 0);
  assert.equal(formalityGap([dress, clogs('slippers')]), 3);
  // Ao khoac va tui khong tinh: blazer khoac ngoai ao phong la mix binh thuong.
  assert.equal(formalityGap([item('top', '#fff', { kind: 'tshirt' }), item('outerwear', '#000', { kind: 'blazer' })]), 0);

  const clash = scoreCombo([scoreItem(dress, daNang), scoreItem(clogs('slippers'), daNang)]);
  const matched = scoreCombo([scoreItem(dress, daNang), scoreItem(groomShoes(), daNang)]);
  assert.ok(matched > clash, `${matched} > ${clash}`);

  // Khong chon dip van tranh bo lech; chi con dep suc thi noi thang trong ly do.
  const free = buildOutfitOptions([partyDress(), clogs('slippers'), groomShoes()], daNang);
  assert.equal(free.options[0].shoes.kind, 'loafers');
  // Chi con dep suc: khong ghep vao vay tiec, noi ro tu chua co giay hop chiec vay.
  const only = buildOutfitOptions([partyDress(), clogs('slippers')], daNang);
  assert.equal(only.options[0].shoes, undefined);
  assert.deepEqual(only.missing, ['Tủ chưa có giày hợp với "Váy liền hồng ánh kim". Nên bổ sung: giày cao gót, giày bệt/búp bê, sandal có quai']);
});

/* ---------- Do nam / do nu ---------- */
const mensShoes = () => item('shoes', '#111111', {
  kind: 'loafers', gender: 'male', name: 'giày da chú rể', styles: ['formal', 'minimal'], occasions: ['date', 'party'],
});

test('gender comes from the item, then from its kind, otherwise unisex', () => {
  assert.equal(genderOf(mensShoes()), 'male');
  assert.equal(genderOf(item('dress', '#000', { kind: 'dress' })), 'female');
  assert.equal(genderOf(item('top', '#000', { kind: 'tshirt' })), 'unisex');
  assert.equal(genderOf(item('dress', '#000', { kind: 'dress', gender: 'unisex' })), 'unisex', 'an explicit answer wins');
  assert.equal(mixesGenders([partyDress(), mensShoes()]), true);
  assert.equal(mixesGenders([partyDress(), item('bag', '#000', { gender: 'male' })]), false, 'bags do not count');
});

test('a dress is not paired with men\'s shoes; a wardrobe without women\'s shoes says what to add', () => {
  const dress = partyDress(), shoes = mensShoes(), heels = item('shoes', '#000000', { kind: 'heels', name: 'Cao gót đen' });
  const withHeels = buildOutfitOptions([dress, shoes, heels], daNang, 'date');
  assert.equal(withHeels.options[0].shoes._id, heels._id);
  assert.deepEqual(withHeels.genderFit, []);
  assert.ok(withHeels.options.every((o) => !(o.dress && o.shoes?._id === shoes._id && !o.genderMismatch)));

  // Chi co giay tay nam: chiec vay di mot minh, khong ghep giay nam; noi ro nen sam giay nu nao.
  const only = buildOutfitOptions([dress, shoes], daNang, 'date');
  assert.equal(only.options[0].shoes, undefined);
  assert.ok(!only.options[0].genderMismatch);
  assert.ok(only.missing.some((m) => m.startsWith('Tủ chưa có giày hợp với "Váy liền hồng ánh kim". Nên bổ sung: giày cao gót')), JSON.stringify(only.missing));
});

test('mixed wardrobes: men\'s outfits stay men\'s without a profile, and the profile picks the wearer\'s side', () => {
  const mensShirt = item('top', '#ffffff', { kind: 'shirt', gender: 'male', name: 'Sơ mi nam' });
  const trousers = item('bottom', '#222222', { kind: 'trousers', name: 'Quần âu' });
  const blouse = item('top', '#ffc0cb', { kind: 'blouse', name: 'Áo kiểu' });
  const wardrobe = [mensShirt, blouse, trousers, mensShoes(), partyDress()];

  // Khong biet nguoi mac: bo nao cung khong tron nam nu (ao kieu nu khong di giay tay nam).
  const free = buildOutfitOptions(wardrobe, daNang, 'work');
  for (const option of free.options) assert.ok(!option.genderMismatch, JSON.stringify(ids(option)));

  // Nguoi mac nu: do nam bi loai han (khong chi tru diem); tu chua co giay nu -> noi ro, khong ghep giay nam.
  const her = buildOutfitOptions(wardrobe, daNang, 'work', { wearer: 'female' });
  assert.ok(her.options.length > 0);
  for (const option of her.options) {
    assert.notEqual(option.top?._id, mensShirt._id);
    assert.equal(option.shoes, undefined);
  }
  assert.ok(her.missing.includes('Tủ chưa có giày hợp với người mặc nữ'), JSON.stringify(her.missing));

  // Nguoi mac nam: khong bao gio chon vay hay ao kieu.
  const him = buildOutfitOptions(wardrobe, daNang, 'work', { wearer: 'male' });
  for (const option of him.options) {
    assert.equal(option.dress, undefined);
    assert.notEqual(option.top?._id, blouse._id);
  }
});

/* ---------- Dac diem AI nhin tu anh ---------- */
test('a football jersey is not a party top, and ripped jeans are not for work', () => {
  const jersey = item('top', '#d32f2f', {
    kind: 'tshirt', name: 'Áo phông đỏ ngôi sao vàng', visual: { formality: 0, sportswear: true, pattern: 'graphic' },
  });
  const shirt = item('top', '#ffffff', { kind: 'shirt', name: 'Sơ mi trắng', visual: { formality: 2, pattern: 'plain' } });
  const ripped = item('bottom', '#5b7db1', { kind: 'jeans', name: 'Quần jeans rách xanh', visual: { formality: 1, distressed: true } });
  const trousers = item('bottom', '#222222', { kind: 'trousers', name: 'Quần âu' });
  const loafers = item('shoes', '#111111', { kind: 'loafers' });

  assert.ok(occasionFitOf(jersey, 'party') <= -30);
  assert.ok(scoreItem(jersey, daNang, 'party').reasons.includes('Đồ thể thao thường không hợp dịp tiệc tùng'));
  assert.equal(occasionFitOf(jersey, 'sport') > 0, true, 'a jersey is fine for sport');

  const party = buildOutfitOptions([jersey, shirt, ripped, trousers, loafers], daNang, 'party');
  for (const option of party.options) assert.notEqual(option.top._id, jersey._id);

  const work = buildOutfitOptions([shirt, ripped, trousers, loafers], daNang, 'work');
  for (const option of work.options) assert.equal(option.bottom._id, trousers._id);

  // Chi con ao dau: khong dua ao dau vao bo di tiec, noi ro can them ao gi.
  const only = buildOutfitOptions([jersey, trousers, loafers], daNang, 'party');
  for (const option of only.options) assert.equal(option.top, undefined);
  assert.ok(only.missing.includes('Tủ chưa có áo hợp dịp tiệc tùng. Nên bổ sung: áo sơ mi, áo kiểu'), JSON.stringify(only.missing));
});

test('formality seen in the photo wins over the guess by kind; two patterns cost a little', () => {
  assert.equal(formalityOf(item('top', '#000', { kind: 'tshirt', visual: { formality: 3 } })), 3);
  assert.equal(formalityOf(item('top', '#000', { kind: 'tshirt' })), 1);

  const graphicTop = item('top', '#ffffff', { kind: 'tshirt', visual: { pattern: 'graphic' } });
  const checkedPants = item('bottom', '#000000', { kind: 'trousers', visual: { pattern: 'checked' } });
  const plainPants = item('bottom', '#000000', { kind: 'trousers', visual: { pattern: 'plain' } });
  assert.equal(patternedCount([graphicTop, checkedPants]), 2);
  assert.equal(patternedCount([graphicTop, plainPants, item('shoes', '#000', { visual: { pattern: 'graphic' } })]), 1, 'shoes do not count');
  const busy = scoreCombo([scoreItem(graphicTop, daNang), scoreItem(checkedPants, daNang)]);
  const calm = scoreCombo([scoreItem(graphicTop, daNang), scoreItem(plainPants, daNang)]);
  assert.equal(calm - busy, 8);
});

/* ---------- Cach mac ---------- */
test('every outfit comes styled: a name and concrete how-to-wear tips', () => {
  const shirt = item('top', '#ffffff', { kind: 'shirt', visual: { sleeve: 'long' } });
  const trousers = item('bottom', '#222222', { kind: 'trousers' });
  const loafers = item('shoes', '#111111', { kind: 'loafers' });
  const blazer = item('outerwear', '#333333', { kind: 'blazer' });

  const hot = styleOutfit({ top: shirt, bottom: trousers, shoes: loafers, outerwear: blazer }, { ...daNang, temp: 30 }, 'work');
  assert.equal(hot.source, 'rule');
  assert.equal(hot.title, 'Công sở lịch sự');
  assert.deepEqual(hot.tips, [
    'Sơ vin áo vào quần để gọn dáng và tôn eo',
    'Xắn tay áo sơ mi 2 gấp cho mát và trẻ trung',
    'Khoác hờ áo khoác, không cài khuy; vào phòng máy lạnh thì mặc vào',
  ]);

  // Ao ngan tay (hoac chua biet tay ao) thi khong khuyen xan tay.
  const shortSleeve = item('top', '#1a2340', { kind: 'shirt', visual: { sleeve: 'short' } });
  for (const top of [shortSleeve, item('top', '#fff', { kind: 'shirt' })]) {
    const tips = styleOutfit({ top, bottom: trousers }, { ...daNang, temp: 30 }, 'party').tips;
    assert.ok(!tips.some((t) => t.startsWith('Xắn tay áo')), JSON.stringify(tips));
  }

  const cold = styleOutfit({ dress: partyDress() }, { ...daNang, temp: 16 }, 'party');
  assert.equal(cold.title, 'Thanh lịch dự tiệc');
  assert.ok(cold.tips.includes('Trời se lạnh, khoác thêm blazer hoặc cardigan mỏng bên ngoài váy'));

  const casual = styleOutfit({ top: item('top', '#fff', { kind: 'tshirt' }), bottom: item('bottom', '#00f', { kind: 'skirt' }) }, daNang);
  assert.equal(casual.tips[0], 'Sơ vin hờ vạt trước (half-tuck) cho dáng tự nhiên, không bị nuốt chân');

  const { options } = buildOutfitOptions([shirt, trousers, loafers], daNang, 'work');
  assert.ok(options.every((o) => o.styling && o.styling.title && o.styling.tips.length > 0));
});

test('pinning a piece made for the other gender gives a clear message instead of an outfit', () => {
  const dress = partyDress();
  const wardrobe = [dress, mensShoes(), clogs('slippers'), item('top', '#fff', { kind: 'shirt', gender: 'male', name: 'Sơ mi nam' })];
  const pinned = buildOutfitOptions(wardrobe, daNang, undefined, { anchor: dress, wearer: 'male' });
  assert.deepEqual(pinned.options, []);
  assert.match(pinned.blocked, /^"Váy liền hồng ánh kim" là đồ nữ, không hợp với người mặc nam theo hồ sơ dáng người/);

  // Chat: chi muon mac mon khac gioi tinh -> cung khong phoi.
  const asked = buildOutfitOptions(wardrobe, daNang, undefined, { include: [dress._id], wearer: 'male' });
  assert.deepEqual(asked.options, []);
  assert.ok(asked.blocked.startsWith('Món bạn muốn mặc ("Váy liền hồng ánh kim") là đồ nữ'), asked.blocked);

  // Khong khai gioi tinh: van phoi quanh chiec vay nhu cu.
  const free = buildOutfitOptions(wardrobe, daNang, undefined, { anchor: dress });
  assert.equal(free.blocked, undefined);
  assert.equal(free.options[0].dress._id, dress._id);
});

test('sporty shoes are not party shoes even before the AI has seen the photo', () => {
  const badminton = item('shoes', '#0e7c86', {
    kind: 'sneakers', name: 'Giày thể thao xanh', styles: ['sporty', 'casual'], occasions: ['sport', 'daily'],
  });
  const loafers = item('shoes', '#111111', { kind: 'loafers', name: 'Giày da' });
  const shirt = item('top', '#1a2340', { kind: 'shirt' });
  const jeans = item('bottom', '#5b7db1', { kind: 'jeans' });

  assert.equal(scoreItem(badminton, daNang, 'party').unsuitable, true);
  assert.ok(scoreItem(badminton, daNang, 'party').reasons.includes('Đồ thể thao thường không hợp dịp tiệc tùng'));
  assert.equal(scoreItem(badminton, daNang, 'sport').unsuitable, undefined, 'still fine for sport');
  assert.equal(occasionFitOf(item('shoes', '#fff', { kind: 'sneakers', styles: ['casual'] }), 'party'), -10, 'plain sneakers only lose a little');

  const party = buildOutfitOptions([shirt, jeans, badminton, loafers], daNang, 'party');
  for (const option of party.options) assert.equal(option.shoes?._id, loafers._id);

  const only = buildOutfitOptions([shirt, jeans, badminton], daNang, 'party');
  assert.equal(only.options[0].shoes, undefined);
  assert.ok(only.missing.some((m) => m.startsWith('Tủ chưa có giày hợp dịp tiệc tùng')), JSON.stringify(only.missing));

  // AI da xem anh va thay khong phai do the thao -> tin ket qua xem anh.
  const fashion = { ...badminton, visual: { formality: 1, sportswear: false } };
  assert.equal(scoreItem(fashion, daNang, 'party').unsuitable, undefined);
});
