'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, FolderPlus, Send, Shirt } from 'lucide-react';
import { CloudImage } from '@/components/ui/CloudImage';
import { suggestionApi } from '@/lib/services';
import { getErrorMessage, isCancelled } from '@/lib/api';
import { useCategoryLabels } from '@/store/categoryStore';
import type { ClothingItem, Occasion, Suggestion, Weather } from '@/types';

const MAX_MESSAGE_LENGTH = 500;
const HISTORY_TURNS = 6;
const HISTORY_TEXT_LENGTH = 1000;
const MAX_SEEN_KEYS = 30;
const SLOTS = ['dress', 'set', 'top', 'bottom', 'outerwear', 'shoes', 'bag', 'accessory'] as const;
const EXAMPLES = [
  'Mai đi cà phê với bạn, muốn đơn giản mà có điểm nhấn màu xanh',
  'Gợi ý một bộ đi làm trông gọn gàng',
  'Váy đỏ nên đi với giày màu gì?',
];

export interface StylistOutfit {
  items: { label: string; item: ClothingItem }[];
  occasion: Occasion;
  weather: Weather;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'stylist';
  text: string;
  outfit?: StylistOutfit;
  notes?: string[];
  source?: 'ai' | 'rule';
  /** Tin bao loi, khong gui lai cho AI lam lich su. */
  failed?: boolean;
}

export function StylistChat({
  city,
  occasion,
  onOpenItem,
  onSaveOutfit,
}: {
  city: string;
  occasion: Occasion;
  onOpenItem: (itemId: string) => void;
  onSaveOutfit: (outfit: StylistOutfit) => void;
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const seenKeys = useRef<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  const append = (message: Omit<ChatMessage, 'id'>) =>
    setMessages((previous) => [...previous, { ...message, id: nextId.current++ }]);

  const toOutfit = (suggestion: Suggestion, usedOccasion: Occasion, weather: Weather): StylistOutfit | undefined => {
    const items = SLOTS.flatMap((slot) => {
      const item = suggestion[slot];
      return item ? [{ label: CATEGORY_LABELS[slot], item }] : [];
    });
    return items.length > 0 ? { items, occasion: usedOccasion, weather } : undefined;
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages
      .filter((m) => !m.failed)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, text: m.text.slice(0, HISTORY_TEXT_LENGTH) }));

    append({ role: 'user', text: message });
    setInput('');
    setSending(true);
    const controller = new AbortController();
    request.current = controller;

    try {
      const result = await suggestionApi.chat(
        { message, history, city: city.trim() || undefined, occasion, seen: seenKeys.current },
        controller.signal
      );
      if (result.suggestion?.key) {
        seenKeys.current = [...new Set([...seenKeys.current, result.suggestion.key])].slice(-MAX_SEEN_KEYS);
      }
      append({
        role: 'stylist',
        text: result.reply,
        source: result.source,
        notes: result.notes,
        outfit: result.suggestion && toOutfit(result.suggestion, result.occasion ?? occasion, result.weather),
      });
    } catch (err) {
      if (!isCancelled(err)) append({ role: 'stylist', text: getErrorMessage(err), failed: true });
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  };

  return (
    <div className="flex h-[min(70vh,640px)] min-h-[420px] flex-col rounded-2xl border border-[#1F453E]/15 bg-white shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#1F453E]/15 bg-[#E2ECC8] text-[#1F453E]">
              <Bot size={22} />
            </span>
            <p className="font-serif-display text-xl font-semibold text-[#1F453E]">Hỏi stylist của bạn</p>
            <p className="mt-1 max-w-md text-xs text-[#6B7B76] sm:text-sm">
              Kể bạn sắp đi đâu hoặc muốn mặc thế nào, stylist sẽ chọn từ chính tủ đồ của bạn.
            </p>
            <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  className="rounded-full border border-[#869BB2]/50 bg-[#FAF9F5] px-3.5 py-1.5 text-xs font-medium text-[#1F453E] transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/40"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
                m.role === 'user'
                  ? 'bg-[#1F453E] text-white'
                  : m.failed
                    ? 'border border-amber-200 bg-amber-50 text-amber-900'
                    : 'border border-[#1F453E]/15 bg-[#FAF9F5] text-[#2C4C45]'
              }`}
            >
              <p className="whitespace-pre-line">{m.text}</p>

              {m.notes?.map((note) => (
                <p key={note} className="mt-1.5 text-xs text-amber-800">• {note}</p>
              ))}

              {m.outfit && (
                <div className="mt-3">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {m.outfit.items.map(({ label, item }) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => onOpenItem(item._id)}
                        title={item.name}
                        className="rounded-lg border border-[#CBD5E1] bg-white p-1.5 text-center transition-colors hover:border-[#1F453E]"
                      >
                        <span className="grid aspect-square place-items-center">
                          <CloudImage src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-[#6B7B76]">{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link
                      href={`/studio?items=${m.outfit.items.map(({ item }) => item._id).join(',')}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-3 py-1 text-xs font-bold text-[#1F453E] transition-all hover:bg-[#E2ECC8]/60"
                    >
                      <Shirt size={13} /> Thử đồ
                    </Link>
                    <button
                      type="button"
                      onClick={() => onSaveOutfit(m.outfit!)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[#16352F]"
                    >
                      <FolderPlus size={13} /> Lưu
                    </button>
                  </div>
                </div>
              )}

              {m.source === 'rule' && (
                <p className="mt-2 text-[11px] italic text-[#6B7B76]">Stylist AI đang bận nên đây là gợi ý theo quy tắc.</p>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <p className="rounded-2xl border border-[#1F453E]/15 bg-[#FAF9F5] px-4 py-2.5 text-sm text-[#6B7B76]">
              Stylist đang chọn đồ…
            </p>
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-[#E2ECC8] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Hôm nay bạn muốn mặc thế nào?"
          aria-label="Tin nhắn cho stylist"
          className="min-w-0 flex-1 rounded-full border border-[#869BB2]/60 bg-[#FAF9F5] px-4 py-2 text-sm text-[#1F453E] transition-all placeholder:text-[#6B7B76] focus:border-[#1F453E] focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Gửi"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1F453E] text-white transition-all hover:bg-[#16352F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
