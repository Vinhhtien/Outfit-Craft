import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Dat truoc khi import env.ts. Khong goi Gemini hay Cloudinary that: fetch duoc gia lap ben duoi.
Object.assign(process.env, { NODE_ENV: 'test', GEMINI_API_KEY: 'look-test-key', CLOUDINARY_CLOUD_NAME: 'look-test' });
const { parseLookReview, rankByLook, pickOutfitsByLook } = await import('../src/services/lookStylist.service.ts');

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ0YAAAAASUVORK5CYII=', 'base64');
const weather = { city: 'Da Nang', temp: 30, feelsLike: 33, humidity: 70, condition: 'Clouds', description: 'mây', icon: '03d', isRaining: false };

let seq = 0;
const piece = (category, name, owned = true) => {
  const id = `look-${++seq}`;
  return {
    _id: id, owner, name, category, colors: [], styles: [], seasons: [], occasions: [], tempRange: { min: 15, max: 35 },
    imageUrl: owned
      ? `https://res.cloudinary.com/look-test/image/upload/v1/outfitcraft/${owner}/items/${id}.png`
      : 'https://example.test/not-ours.png',
  };
};
const outfit = (key, ...items) => {
  const option = { key, totalScore: 80, reasons: [] };
  for (const item of items) option[item.category] = item;
  return option;
};

let geminiReply = null;
let geminiCalls = [];
let thumbnailCalls = 0;
beforeEach(() => {
  geminiReply = null; geminiCalls = []; thumbnailCalls = 0;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.startsWith('https://res.cloudinary.com/look-test/')) {
      thumbnailCalls++;
      return new Response(png, { status: 200 });
    }
    if (target.includes('generativelanguage.googleapis.com')) {
      geminiCalls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: geminiReply ?? '' }] } }] }), { status: 200 });
    }
    throw new Error(`Unexpected request ${target}`);
  };
});

test('the review keeps only known labels, clamps scores and needs a comment', () => {
  const raw = JSON.stringify({ outfits: [
    { label: 'A', score: 14, comment: '  Áo   sơ mi trắng hợp quần âu  ' },
    { label: 'A', score: 2, comment: 'trùng nhãn' },
    { label: 'B', score: 0, comment: 'Quá xuề xòa' },
    { label: 'C', score: 7, comment: '' },
    { label: 'Z', score: 9, comment: 'không có bộ Z' },
  ] });
  assert.deepEqual([...parseLookReview(raw, ['A', 'B', 'C'])], [
    ['A', { score: 10, comment: 'Áo sơ mi trắng hợp quần âu' }],
    ['B', { score: 1, comment: 'Quá xuề xòa' }],
  ]);
  for (const broken of [null, '', 'not json', '{"outfits":"x"}']) assert.equal(parseLookReview(broken, ['A']).size, 0);
});

test('outfits are re-ordered by the look score; unreviewed ones keep their place after them', () => {
  const options = ['a', 'b', 'c', 'd'].map((key) => ({ key, totalScore: 80, reasons: [] }));
  const reviews = new Map([['B', { score: 9, comment: 'đẹp nhất' }], ['D', { score: 9, comment: 'cũng đẹp' }], ['A', { score: 4, comment: 'lệch' }]]);
  const ranked = rankByLook(options, reviews);
  assert.deepEqual(ranked.map((o) => o.key), ['b', 'd', 'a', 'c']);
  assert.equal(ranked[0].lookComment, 'đẹp nhất');
  assert.equal(ranked[0].lookScore, 9);
  assert.equal(ranked[3].lookScore, undefined);
});

test('the stylist looks at each piece once and picks the best looking outfits', async () => {
  const shirt = piece('top', 'Sơ mi trắng'), jersey = piece('top', 'Áo đấu đỏ');
  const trousers = piece('bottom', 'Quần âu'), jeans = piece('bottom', 'Jeans rách');
  const loafers = piece('shoes', 'Giày da');
  const options = [
    outfit('jersey', jersey, jeans, loafers),
    outfit('smart', shirt, trousers, loafers),
    outfit('mix', shirt, jeans, loafers),
    outfit('odd', jersey, trousers, loafers),
  ];
  geminiReply = JSON.stringify({ outfits: [
    { label: 'A', score: 3, comment: 'Áo đấu thể thao không hợp đi tiệc.' },
    { label: 'B', score: 9, comment: 'Sơ mi trắng và quần âu thanh lịch, giày da hoàn thiện bộ.', title: 'Thanh lịch tối biển', howToWear: ['Sơ vin áo sơ mi', '  Xắn tay áo một gấp  ', 42, ''] },
    { label: 'C', score: 6, comment: 'Ổn nhưng jeans rách hơi xuề xòa.' },
    { label: 'D', score: 4, comment: 'Áo đấu lệch với quần âu.' },
  ] });
  const result = await pickOutfitsByLook(options, { weather, occasion: 'party', wearer: 'male' });

  assert.equal(result.checked, true);
  assert.deepEqual(result.options.map((o) => o.key), ['smart', 'mix', 'odd']);
  assert.match(result.options[0].lookComment, /thanh lịch/);
  // AI viet ten phong cach + cach mac sau khi xem anh, thay ban theo quy tac.
  assert.deepEqual(result.options[0].styling, { title: 'Thanh lịch tối biển', tips: ['Sơ vin áo sơ mi', 'Xắn tay áo một gấp'], source: 'ai' });
  // 5 mon khac nhau -> dung 5 anh, du giay da nam trong ca 4 bo.
  assert.equal(thumbnailCalls, 5);
  assert.equal(geminiCalls.length, 1);
  const parts = geminiCalls[0].contents[0].parts;
  assert.equal(parts.filter((p) => p.inlineData).length, 5);
  const text = parts.map((p) => p.text ?? '').join('\n');
  assert.match(text, /Dịp: tiệc tùng\. Thời tiết: Da Nang, 30°C\. Người mặc: nam\./);
  assert.match(text, /Bộ B: m\d+, m\d+, m\d+/);
});

test('without enough photos, or when the AI fails, the algorithm order is kept', async () => {
  const notOurs = [1, 2, 3].map((i) => outfit(`x${i}`, piece('top', `Áo ${i}`, false), piece('bottom', `Quần ${i}`, false)));
  const noPhotos = await pickOutfitsByLook([...notOurs, outfit('x4', piece('top', 'Áo 4', false))], { weather });
  assert.equal(noPhotos.checked, false);
  assert.deepEqual(noPhotos.options.map((o) => o.key), ['x1', 'x2', 'x3']);
  assert.equal(geminiCalls.length, 0, 'no photos -> no AI call');

  const withPhotos = [1, 2, 3, 4].map((i) => outfit(`y${i}`, piece('top', `Áo ${i}`), piece('bottom', `Quần ${i}`)));
  geminiReply = 'xin lỗi, không trả lời được';
  const failed = await pickOutfitsByLook(withPhotos, { weather });
  assert.equal(failed.checked, false);
  assert.deepEqual(failed.options.map((o) => o.key), ['y1', 'y2', 'y3']);

  const single = await pickOutfitsByLook([withPhotos[0]], { weather });
  assert.equal(single.checked, false);
  assert.equal(single.options.length, 1);
});

test('a real stylist only presents outfits that look good and are complete', async () => {
  const { judgeOutfit } = await import('../src/services/lookStylist.service.ts');
  const top = piece('top', 'Sơ mi'), bottom = piece('bottom', 'Quần âu'), dress = piece('dress', 'Váy');
  assert.deepEqual(judgeOutfit(outfit('ok', top, bottom), false), { ok: true, reasons: [] });
  assert.deepEqual(judgeOutfit(outfit('dress', dress), true), { ok: true, reasons: [] }, 'a dress alone is a complete look');
  assert.deepEqual(judgeOutfit(outfit('half', top), false), { ok: false, reasons: ['Chưa có quần hoặc chân váy hợp để đi cùng áo'] });
  assert.deepEqual(judgeOutfit(undefined, false).ok, false);
  const ugly = { ...outfit('ugly', top, bottom), lookScore: 4, lookComment: 'Màu áo và quần chọi nhau.' };
  assert.deepEqual(judgeOutfit(ugly, true), { ok: false, reasons: ['Màu áo và quần chọi nhau.'] });
  assert.equal(judgeOutfit({ ...ugly, lookScore: 6 }, true).ok, true);
});

test('when nothing looks good the stylist says so and what to add, even without the AI', async () => {
  const { writeHonestReply } = await import('../src/services/stylist.service.ts');
  const reasons = ['Chưa có quần hoặc chân váy hợp để đi cùng áo', 'Tủ chưa có quần hợp dịp đi làm. Nên bổ sung: quần âu/quần tây'];
  geminiReply = 'Thật lòng thì tủ của bạn chưa có bộ đi làm đẹp...';
  const ai = await writeHonestReply('đi làm mặc gì', weather, 'work', reasons);
  assert.deepEqual(ai, { advice: 'Thật lòng thì tủ của bạn chưa có bộ đi làm đẹp...', source: 'ai' });
  const prompt = geminiCalls[0].contents[0].parts[0].text;
  assert.match(prompt, /chưa phối được bộ nào thật sự đẹp vì: Chưa có quần hoặc chân váy/);
  assert.match(prompt, /Không khen bộ chưa đẹp/);

  geminiReply = '';
  const rule = await writeHonestReply('đi làm mặc gì', weather, 'work', reasons);
  assert.equal(rule.source, 'rule');
  assert.match(rule.advice, /chưa phối được bộ nào thật sự đẹp cho dịp đi làm: .*Nên bổ sung: quần âu\/quần tây/);
});
