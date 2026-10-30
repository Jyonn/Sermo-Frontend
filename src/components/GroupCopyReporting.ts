import { api } from "../lib/api";
import { GROUP_COPY_EVENT } from "../lib/groupCopy";
export function reportGroupCopies(chatId: number, userId: number, ids: number[]) {
  const messageIds = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 50);
  if (!messageIds.length) return;
  window.dispatchEvent(new CustomEvent(GROUP_COPY_EVENT, { detail: { chatId, userId, ids: messageIds } }));
  void api.recordMessageCopies(chatId, messageIds).catch(() => undefined);
}
