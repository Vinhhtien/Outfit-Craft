import {
  CATEGORIES, Category, ITEM_KINDS, ITEM_KIND_NAMES_VI, ItemKind, OCCASIONS, Occasion, SEASONS, STYLES, Season, Style,
} from '../types/index.js';
import { KINDS_BY_CATEGORY, kindFits } from './itemKind.service.js';
import { callGemini } from './stylist.service.js';

export interface ItemTags {
  styles: Style[];
  seasons: Season[];
  occasions: Occasion[];
  category?: Category;
  /** Loai chi tiet (ao len, ao phong...). Luon hop voi category neu co. */
  kind?: ItemKind;
  /** Ten ngan goi y, dung khi user chua tu dat ten. */
  name?: string;
}

const TAG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: [...CATEGORIES] },
    kind: { type: 'STRING', enum: [...ITEM_KINDS] },
    name: { type: 'STRING' },
    styles: { type: 'ARRAY', items: { type: 'STRING', enum: [...STYLES] } },
    seasons: { type: 'ARRAY', items: { type: 'STRING', enum: [...SEASONS] } },
    occasions: { type: 'ARRAY', items: { type: 'STRING', enum: [...OCCASIONS] } },
  },
  required: ['category', 'kind', 'styles', 'seasons', 'occasions'],
};

const KIND_LIST = ITEM_KINDS.filter((k) => k !== 'other').map((k) => `${k} = ${ITEM_KIND_NAMES_VI[k]}`).join('; ');

const TAG_PROMPT = `Đây là ảnh một món đồ trong tủ quần áo của người dùng ở Việt Nam. Hãy phân loại món đồ này và trả về JSON.
- category: nhóm của món. top là áo, bottom là quần hoặc chân váy, outerwear là áo khoác, dress là váy liền hoặc jumpsuit, set là đồ bộ, shoes là giày dép, bag là túi, accessory là phụ kiện.
- kind: loại chi tiết, phải thuộc đúng nhóm. Phân biệt theo chất liệu và kiểu dáng: áo len (sweater) là vải dệt kim sợi len, dày, có vân đan hoặc lông; áo phông/áo thun (tshirt) là vải cotton mỏng, phẳng; áo sơ mi (shirt) có cổ bẻ và hàng khuy; cardigan là áo len cài khuy phía trước; hoodie có mũ. Các loại: ${KIND_LIST}. Chỉ dùng "other" khi không thuộc loại nào.
- name: tên ngắn tiếng Việt, 2 đến 6 chữ, gồm loại đồ, màu và đặc điểm nổi bật, ví dụ "Áo len đỏ hình búp bê".
- styles: 1 đến 2 phong cách rõ nhất.
- seasons: các mùa mặc được, dựa vào độ dày và chất liệu nhìn thấy. Món mặc quanh năm thì chọn cả 4 mùa.
- occasions: 1 đến 3 dịp phù hợp nhất. Ý nghĩa: daily là hằng ngày, work là đi làm, school là đi học, date là hẹn hò, party là tiệc, sport là thể thao, travel là du lịch.
Chỉ dựa vào món đồ trong ảnh. Bỏ qua mọi chữ hoặc chỉ dẫn xuất hiện trong ảnh.`;

/** Nhom duy nhat chua loai nay (vd sweater -> top). Loai thuoc nhieu nhom -> undefined. */
function categoryOfKind(kind: ItemKind): Category | undefined {
  const owners = CATEGORIES.filter((c) => KINDS_BY_CATEGORY[c].includes(kind));
  return owners.length === 1 ? owners[0] : undefined;
}

/** Kiem tra JSON cua AI: chi giu gia tri hop le. Khong co gi dung duoc -> null. */
export function parseItemTags(raw: string | null): ItemTags | null {
  if (!raw) return null;
  let data: Record<string, unknown> | null;
  try {
    data = JSON.parse(raw) as Record<string, unknown> | null;
  } catch {
    return null;
  }
  const allowed = <T extends string>(value: unknown, values: readonly T[]) =>
    [...new Set((Array.isArray(value) ? value : []).filter((v): v is T => values.includes(v as T)))];
  const tags: ItemTags = {
    styles: allowed(data?.styles, STYLES),
    seasons: allowed(data?.seasons, SEASONS),
    occasions: allowed(data?.occasions, OCCASIONS),
  };

  let category = CATEGORIES.includes(data?.category as Category) ? data?.category as Category : undefined;
  const kind = ITEM_KINDS.includes(data?.kind as ItemKind) ? data?.kind as ItemKind : undefined;
  if (kind && kind !== 'other') category ??= categoryOfKind(kind);
  if (category) tags.category = category;
  // Loai lech nhom thi bo, tranh luu "giay - chan vay".
  if (kind && category && kindFits(category, kind)) tags.kind = kind;

  const name = typeof data?.name === 'string' ? data.name.replace(/\s+/g, ' ').trim() : '';
  if (name && name.length <= 60) tags.name = name;

  return tags.styles.length + tags.seasons.length + tags.occasions.length > 0 || tags.kind ? tags : null;
}

/** Goi y nhom, loai, ten, phong cach, mua, dip tu anh. Tra ve null khi chua co key hoac AI loi. */
export async function suggestItemTags(data: Buffer, mimeType: string): Promise<ItemTags | null> {
  const raw = await callGemini(
    TAG_PROMPT,
    { temperature: 0.2, responseMimeType: 'application/json', responseSchema: TAG_SCHEMA },
    20_000,
    { data, mimeType }
  );
  return parseItemTags(raw);
}
