import type { ChatMessage, ChatSyncStateDTO } from "../types";

export const CHAT_SYNC_EVENT = "sermo:messages-sync";

export interface SyncedChatMessageItem {
  chatId: number;
  message: ChatMessage;
}

export interface ChatSyncEventDetail {
  afterMessageId: number;
  items: SyncedChatMessageItem[];
  removed: Array<{ chatId: number; messageId: number }>;
  chatStates: ChatSyncStateDTO[];
}

export function emitChatSync(detail: ChatSyncEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatSyncEventDetail>(CHAT_SYNC_EVENT, { detail }));
}
