'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, FolderPlus, History, MessageSquarePlus, Send, Shirt, Trash2, X } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { CloudImage } from '@/components/ui/CloudImage';
import { useResource } from '@/hooks/useResource';
import { suggestionApi } from '@/lib/services';
import { getErrorMessage, isCancelled } from '@/lib/api';
import { useCategoryLabels } from '@/store/categoryStore';
import type { ClothingItem, Occasion, StylistChatMessage, Weather } from '@/types';

const MAX_MESSAGE_LENGTH = 500;
const SLOT_ORDER = ['dress', 'set', 'top', 'bottom', 'outerwear', 'shoes', 'bag', 'accessory'];
const EXAMPLES = [
  'Mai đi cà phê với bạn, muốn đơn giản mà có điểm nhấn màu xanh',
  'Gợi ý một bộ đi làm trông gọn gàng',
  'Váy đỏ nên đi với giày màu gì?',
];

export interface StylistOutfit {
  items: { label: string; item: ClothingItem }[];
  occasion: Occasion;
  weather?: Weather;
}

/** Tin chi co tren man hinh: dang gui hoac bao loi, khong nam trong lich su da luu. */
type ChatMessage = StylistChatMessage & { failed?: boolean };

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
  const listLoader = useCallback((signal: AbortSignal) => suggestionApi.chatList(signal), []);
  const {
    data: conversations, setData: setConversations, loading: listLoading, error: listError, reload: reloadList,
  } = useResource(listLoader);

  /** null = doan chat moi, chua luu. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const nextLocalId = useRef(1);
  const sendRequest = useRef<AbortController | null>(null);
  const openRequest = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    sendRequest.current?.abort();
    openRequest.current?.abort();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  const localMessage = (role: ChatMessage['role'], text: string, failed = false): ChatMessage => ({
    _id: `local-${nextLocalId.current++}`, role, text, items: [], notes: [], failed,
  });

  const toOutfit = (message: ChatMessage): StylistOutfit | undefined => {
    if (message.items.length === 0) return undefined;
    const items = [...message.items]
      .sort((a, b) => SLOT_ORDER.indexOf(a.category) - SLOT_ORDER.indexOf(b.category))
      .map((item) => ({ label: CATEGORY_LABELS[item.category], item }));
    return { items, occasion: message.occasion ?? occasion, weather: message.weather };
  };

  const startNewChat = () => {
    if (sending) return;
    openRequest.current?.abort();
    setActiveId(null);
    setMessages([]);
    setOpening(false);
    setOpenError('');
    setListOpen(false);
  };

  const openConversation = async (id: string) => {
    if (sending) return;
    openRequest.current?.abort();
    const controller = new AbortController();
    openRequest.current = controller;
    setActiveId(id);
    setMessages([]);
    setOpening(true);
    setOpenError('');
    setListOpen(false);
    try {
      const saved = await suggestionApi.chatMessages(id, controller.signal);
      if (!controller.signal.aborted) setMessages(saved);
    } catch (err) {
      if (!controller.signal.aborted && !isCancelled(err)) setOpenError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setOpening(false);
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending || opening) return;

    setMessages((previous) => [...previous, localMessage('user', message)]);
    setInput('');
    setSending(true);
    const controller = new AbortController();
    sendRequest.current = controller;

    try {
      const result = await suggestionApi.chat(
        { message, conversationId: activeId ?? undefined, city: city.trim() || undefined, occasion },
        controller.signal
      );
      setActiveId(result.conversation._id);
      setMessages((previous) => [...previous, result.message]);
      setConversations((previous) => [
        result.conversation,
        ...(previous ?? []).filter((c) => c._id !== result.conversation._id),
      ]);
    } catch (err) {
      if (!isCancelled(err)) {
        setMessages((previous) => [...previous, localMessage('stylist', getErrorMessage(err), true)]);
      }
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  };

  const deleteConversation = async (id: string) => {
    setDeletingId(id);
    setDeleteError('');
    try {
      await suggestionApi.deleteChat(id);
      setConversations((previous) => (previous ?? []).filter((c) => c._id !== id));
      setConfirmingId(null);
      if (id === activeId) startNewChat();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const activeTitle = conversations?.find((c) => c._id === activeId)?.title;

  return (
    <div className="relative flex h-[min(72vh,680px)] min-h-[460px] overflow-hidden rounded-2xl border border-[#1F453E]/15 bg-white shadow-[0_4px_20px_rgba(31,69,62,0.03)]">
      {/* Thanh lich su: co dinh tu md tro len, dang ngan keo tren dien thoai. */}
      <aside
        aria-label="Lịch sử chat"
        className={`absolute inset-y-0 left-0 z-20 w-72 max-w-[85%] flex-col border-r border-[#E2ECC8] bg-[#FAF9F5] shadow-lg md:static md:z-auto md:flex md:w-64 md:max-w-none md:shrink-0 md:shadow-none ${
          listOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={startNewChat}
            disabled={sending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1F453E] px-3 py-2 text-xs font-bold text-white transition-all hover:bg-[#16352F] disabled:opacity-50"
          >
            <MessageSquarePlus size={14} /> Đoạn chat mới
          </button>
          <button
            type="button"
            onClick={() => setListOpen(false)}
            aria-label="Đóng lịch sử"
            className="rounded-full p-1.5 text-[#1F453E] hover:bg-[#E2ECC8]/60 md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {listLoading && !conversations && <LoadingState compact label="Đang tải lịch sử…" />}
          {listError && !conversations && <ErrorState message={listError} onRetry={() => void reloadList()} busy={listLoading} />}
          {conversations?.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-[#6B7B76]">Chưa có đoạn chat nào.</p>
          )}
          {deleteError && <p role="alert" className="px-2 text-xs text-red-700">{deleteError}</p>}

          {conversations?.map((c) => (
            <div
              key={c._id}
              className={`group rounded-lg transition-colors ${c._id === activeId ? 'bg-[#E2ECC8]' : 'hover:bg-[#E2ECC8]/50'}`}
            >
              {confirmingId === c._id ? (
                <div className="flex items-center justify-between gap-1 px-2.5 py-2 text-xs">
                  <span className="truncate text-[#2C4C45]">Xoá đoạn chat?</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void deleteConversation(c._id)}
                      disabled={deletingId === c._id}
                      className="rounded-full bg-red-700 px-2.5 py-0.5 font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                    >
                      {deletingId === c._id ? 'Đang xoá…' : 'Xoá'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === c._id}
                      className="rounded-full border border-[#869BB2]/50 px-2.5 py-0.5 font-semibold text-[#1F453E]"
                    >
                      Huỷ
                    </button>
                  </span>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => void openConversation(c._id)}
                    disabled={sending}
                    aria-current={c._id === activeId ? 'true' : undefined}
                    title={c.title}
                    className="min-w-0 flex-1 px-2.5 py-2 text-left disabled:cursor-not-allowed"
                  >
                    <span className="block truncate text-sm font-medium text-[#1F453E]">{c.title}</span>
                    <span className="block text-[11px] text-[#6B7B76]">
                      {new Date(c.lastMessageAt).toLocaleDateString('vi-VN')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c._id)}
                    disabled={sending}
                    aria-label={`Xoá đoạn chat ${c.title}`}
                    className="mr-1 shrink-0 rounded-full p-1.5 text-[#6B7B76] transition-colors hover:text-red-700 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {listOpen && (
        <button
          type="button"
          aria-label="Đóng lịch sử"
          onClick={() => setListOpen(false)}
          className="absolute inset-0 z-10 bg-black/20 md:hidden"
        />
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[#E2ECC8] px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#869BB2]/50 px-3 py-1 text-xs font-semibold text-[#1F453E]"
          >
            <History size={13} /> Lịch sử
          </button>
          <span className="truncate text-xs text-[#6B7B76]">{activeTitle ?? 'Đoạn chat mới'}</span>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {opening && <LoadingState compact label="Đang mở đoạn chat…" />}
          {openError && activeId && (
            <ErrorState message={openError} onRetry={() => void openConversation(activeId)} busy={opening} />
          )}

          {!activeId && messages.length === 0 && (
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

          {messages.map((m) => {
            const outfit = toOutfit(m);
            return (
              <div key={m._id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%] ${
                    m.role === 'user'
                      ? 'bg-[#1F453E] text-white'
                      : m.failed
                        ? 'border border-amber-200 bg-amber-50 text-amber-900'
                        : 'border border-[#1F453E]/15 bg-[#FAF9F5] text-[#2C4C45]'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>

                  {m.notes.map((note) => (
                    <p key={note} className="mt-1.5 text-xs text-amber-800">• {note}</p>
                  ))}

                  {outfit && (
                    <div className="mt-3">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {outfit.items.map(({ label, item }) => (
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
                          href={`/studio?items=${outfit.items.map(({ item }) => item._id).join(',')}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-3 py-1 text-xs font-bold text-[#1F453E] transition-all hover:bg-[#E2ECC8]/60"
                        >
                          <Shirt size={13} /> Thử đồ
                        </Link>
                        <button
                          type="button"
                          onClick={() => onSaveOutfit(outfit)}
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
            );
          })}

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
            disabled={sending || opening || !input.trim()}
            aria-label="Gửi"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1F453E] text-white transition-all hover:bg-[#16352F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={15} />
          </button>
        </form>
      </section>
    </div>
  );
}
