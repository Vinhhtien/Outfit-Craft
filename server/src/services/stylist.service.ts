import { env } from '../config/env.js';
import { IClothingItem } from '../models/ClothingItem.js';
import { WeatherInfo } from './weather.service.js';
import { OutfitSuggestion } from './suggestion.service.js';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function describe(item?: IClothingItem): string | null {
  if (!item) return null;
  const color = item.colors[0] ? ` mau ${item.colors[0]}` : '';
  return `${item.name} (${item.category}${color})`;
}

/**
 * Sinh loi tu van phoi do bang LLM.
 * Neu chua co API key hoac goi that bai -> tra ve text tu rule-based,
 * de tinh nang goi y khong bao gio "chet" vi het quota.
 */
export async function getStylistAdvice(
  suggestion: OutfitSuggestion,
  weather: WeatherInfo,
  occasion?: string
): Promise<{ advice: string; source: 'ai' | 'rule' }> {
  const pieces = [
    describe(suggestion.dress),
    describe(suggestion.top),
    describe(suggestion.bottom),
    describe(suggestion.outerwear),
    describe(suggestion.shoes),
    describe(suggestion.accessory),
  ].filter(Boolean);

  const fallback = () => ({
    advice: buildRuleAdvice(pieces, weather, suggestion),
    source: 'rule' as const,
  });

  if (!env.geminiKey || pieces.length === 0) return fallback();

  const prompt = `Ban la stylist ca nhan. Hay tu van ngan gon (toi da 4 cau, tieng Viet, giong than thien).
Thoi tiet: ${weather.city}, ${weather.temp}\u00b0C, ${weather.description}.
Dip: ${occasion ?? 'hang ngay'}.
Bo do duoc goi y: ${pieces.join(', ')}.
Hay nhan xet vi sao bo nay hop, va them 1 meo phoi do.`;

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
