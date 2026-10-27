import { env } from '../config/env.js';
import { IClothingItem } from '../models/ClothingItem.js';
import { WeatherInfo } from './weather.service.js';
import { OutfitSuggestion } from './suggestion.service.js';
// ===== NEW: Body Profile =====
import { BodyProfile, BodyShape, BodyGender } from '../types/index.js';
// ===== END NEW =====

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function describe(item?: IClothingItem): string | null {
  if (!item) return null;
  return item.name;
}

// ===== NEW: Body Profile =====
/** Chi nhung gi duoc phep gui cho LLM: dang, gioi tinh, chieu cao. KHONG gui so do chi tiet. */
export interface StylistBodyContext {
  shape: BodyShape;
  gender: BodyGender;
  heightCm?: number;
}

export function toStylistBodyContext(profile?: BodyProfile | null): StylistBodyContext | undefined {
  if (!profile) return undefined;
  return {
    shape: profile.shape,
    gender: profile.gender,
    ...(profile.measurements?.heightCm ? { heightCm: profile.measurements.heightCm } : {}),
  };
}

const SHAPE_LABELS: Record<BodyShape, string> = {
  rectangle: 'chữ nhật (rectangle)',
  pear: 'quả lê (pear)',
  apple: 'quả táo (apple)',
  hourglass: 'đồng hồ cát (hourglass)',
  inverted_triangle: 'tam giác ngược (inverted triangle)',
};

const GENDER_LABELS: Record<BodyGender, string> = {
  female: 'nữ',
  male: 'nam',
  neutral: 'trung tính',
};

/**
 * Prompt gui Gemini. Khong co body -> giu nguyen prompt cu tung chu.
 * Co body -> them dang nguoi + huong dan tu van theo can doi ti le, ngon ngu trung tinh.
 */
export function buildStylistPrompt(
  pieces: string[],
  weather: WeatherInfo,
  occasion?: string,
  body?: StylistBodyContext
): string {
  const base = `Bạn là chuyên gia stylist cá nhân. Hãy tư vấn ngắn gọn (tối đa 4 câu, tiếng Việt tự nhiên, phong cách ấm áp, tinh tế).
Thời tiết: ${weather.city}, ${weather.temp}°C, ${weather.description}.
Dịp: ${occasion ?? 'hằng ngày'}.
Bộ đồ được gợi ý: ${pieces.join(', ')}.
Hãy nhận xét vì sao bộ này phù hợp, và thêm 1 mẹo phối đồ hoặc phụ kiện hữu ích.`;

  if (!body) return base;

  const height = body.heightCm ? `, chiều cao khoảng ${body.heightCm} cm` : '';
  return `${base}
Dáng người của bạn: ${SHAPE_LABELS[body.shape]}, giới tính ${GENDER_LABELS[body.gender]}${height}.
Hãy gợi ý cách mặc bộ này để tôn dáng và tạo cảm giác cân đối tỉ lệ cơ thể, kèm 1 lời giải thích ngắn gọn.
Dùng ngôn ngữ tích cực, tôn vinh vóc dáng tự nhiên.`;
}
// ===== END NEW =====

/**
 * Sinh loi tu van phoi do bang LLM.
 * Neu chua co API key hoac goi that bai -> tra ve text tu rule-based,
 * de tinh nang goi y khong bao gio "chet" vi het quota.
 */
export async function getStylistAdvice(
  suggestion: OutfitSuggestion,
  weather: WeatherInfo,
  occasion?: string,
  body?: StylistBodyContext // NEW: Body Profile
): Promise<{ advice: string; source: 'ai' | 'rule' }> {
  const pieces = [
    describe(suggestion.dress),
    describe(suggestion.top),
    describe(suggestion.bottom),
    describe(suggestion.outerwear),
    describe(suggestion.shoes),
    describe(suggestion.accessory),
  ].filter(Boolean) as string[];

  const fallback = () => ({
    advice: buildRuleAdvice(pieces, weather, suggestion),
    source: 'rule' as const,
  });

  if (!env.geminiKey || pieces.length === 0) return fallback();

  const prompt = buildStylistPrompt(pieces, weather, occasion, body);

  try {
    const res = await fetch(`${GEMINI_URL}?key=${env.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return fallback();

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return text ? { advice: text, source: 'ai' } : fallback();
  } catch (err) {
    console.warn('[stylist] Gemini loi, dung rule-based:', err);
    return fallback();
  }
}

function buildRuleAdvice(
  pieces: (string | null)[],
  weather: WeatherInfo,
  suggestion: OutfitSuggestion
): string {
  const weatherDesc = weather.description ? weather.description.toLowerCase() : 'dễ chịu';
  const cleanPieces = pieces.filter(Boolean);
  const outfitText = cleanPieces.length > 0 ? cleanPieces.join(' + ') : 'trang phục thoải mái';
  const lines = [
    `Với thời tiết ${weather.temp}°C (${weatherDesc}) tại ${weather.city}, bạn có thể phối: ${outfitText}.`,
    ...suggestion.reasons,
  ];
  return lines.join(' ');
}
