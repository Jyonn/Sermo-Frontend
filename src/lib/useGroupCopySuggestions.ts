import { useEffect, useState } from "react";
import { ApiError, api } from "./api";
import { CHAT_SYNC_EVENT, type ChatSyncEventDetail } from "./chatSync";
import { GROUP_COPY_EVENT, GROUP_COPY_REMOVED, orderCopySuggestions, type CopySuggestion } from "./groupCopy";
export function useGroupCopySuggestions(chatId: number | undefined, userId: number) {
  const scope = `${userId}:${chatId}`;
  const [data, setData] = useState<{ scope: string; items: CopySuggestion[]; loading: boolean; error: boolean }>({ scope: "", items: [], loading: false, error: false });
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!chatId || !userId) return;
    const controller = new AbortController(); const copied = new Set<number>(); const removed = new Set<number>();
    let version = 0; let pending: number | undefined;
    setData({ scope, items: [], loading: true, error: false });
    const load = async () => {
      const request = ++version;
      try {
        const result = await api.getCopySuggestions(chatId, controller.signal);
        if (controller.signal.aborted || request !== version) return;
        setData({ scope, items: orderCopySuggestions(result.items.filter(item => !removed.has(item.message_id)).map(item => ({ ...item, copied: item.copied || copied.has(item.message_id) }))), loading: false, error: false });
      } catch (error) { if (!controller.signal.aborted && request === version) setData(current => ({ ...current, items: error instanceof ApiError && (error.status === 401 || error.status === 403) ? [] : current.items, loading: false, error: true })); }
    };
    const markCopied = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: number; userId: number; ids: number[] }>).detail;
      if (detail?.chatId !== chatId || detail.userId !== userId) return;
      detail.ids.forEach(id => copied.add(id));
      setData(current => ({ ...current, items: orderCopySuggestions(current.items.map(item => ({ ...item, copied: item.copied || copied.has(item.message_id) }))) }));
    };
    const remove = (ids: number[]) => { ids.forEach(id => removed.add(id)); setData(current => ({ ...current, items: current.items.filter(item => !removed.has(item.message_id)) })); };
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<ChatSyncEventDetail>).detail;
      if (!detail?.items?.some(item => item.chatId === chatId) && !detail?.removed?.some(item => item.chatId === chatId)) return;
      remove((detail?.removed ?? []).filter(item => item.chatId === chatId).map(item => item.messageId));
      window.clearTimeout(pending); pending = window.setTimeout(() => void load(), 500);
    };
    const onRemoved = (event: Event) => { const detail = (event as CustomEvent<{ chatId: number; ids: number[] }>).detail; if (detail?.chatId === chatId) remove(detail.ids); };
    const tick = window.setInterval(() => { setData(current => ({ ...current, items: orderCopySuggestions(current.items) })); if (!document.hidden) void load(); }, 60000);
    window.addEventListener(GROUP_COPY_EVENT, markCopied); window.addEventListener(CHAT_SYNC_EVENT, sync); window.addEventListener(GROUP_COPY_REMOVED, onRemoved);
    void load();
    return () => { controller.abort(); window.clearInterval(tick); window.clearTimeout(pending); window.removeEventListener(GROUP_COPY_EVENT, markCopied); window.removeEventListener(CHAT_SYNC_EVENT, sync); window.removeEventListener(GROUP_COPY_REMOVED, onRemoved); };
  }, [chatId, userId, scope, epoch]);
  return { items: data.scope === scope ? data.items : [], loading: Boolean(chatId) && (data.scope !== scope || data.loading), error: data.scope === scope && data.error, retry: () => setEpoch(value => value + 1) };
}
