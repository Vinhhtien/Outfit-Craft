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
  const color = item.colors[0] ? ` mau ${item.colors[0]}` : '';
  return `${item.name} (${item.category}${color})`;
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
  rectangle: 'chu nhat (rectangle)',
  pear: 'qua le (pear)',
  apple: 'qua tao (apple)',
  hourglass: 'dong ho cat (hourglass)',
  inverted_triangle: 'tam giac nguoc (inverted triangle)',
};

const GENDER_LABELS: Record<BodyGender, string> = {
  female: 'nu',
  male: 'nam',
  neutral: 'trung tinh',
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
  const base = `Ban la stylist ca nhan. Hay tu van ngan gon (toi da 4 cau, tieng Viet, giong than thien).
Thoi tiet: ${weather.city}, ${weather.temp}°C, ${weather.description}.
Dip: ${occasion ?? 'hang ngay'}.
Bo do duoc goi y: ${pieces.join(', ')}.
Hay nhan xet vi sao bo nay hop, va them 1 meo phoi do.`;

  if (!body) return base;

  const height = body.heightCm ? `, chieu cao khoang ${body.heightCm} cm` : '';
  return `${base}
Dang nguoi cua ban: ${SHAPE_LABELS[body.shape]}, gioi tinh ${GENDER_LABELS[body.gender]}${height}.
Hay goi y cach mac bo nay de ton dang va tao cam giac can doi ti le vai - eo - hong cho dang nguoi tren, kem 1 cau giai thich ngan ly do.
Dung ngon ngu tich cuc, trung tinh ve co the: noi ve viec ton dang, can doi, lam noi bat; khong noi ve viec che hay giau mot bo phan co the, khong danh gia co the.`;
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
  const lines = [
    `Voi thoi tiet ${weather.temp}\u00b0C (${weather.description}) tai ${weather.city}, ban co the mac: ${pieces.join(' + ')}.`,
    ...suggestion.reasons,
  ];
  return lines.join(' ');
}
