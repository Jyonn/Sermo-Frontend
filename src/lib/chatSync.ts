import type { ChatMessage, ChatSyncStateDTO } from "../types";

export const CHAT_SYNC_EVENT = "sermo:messages-sync";

export interface SyncedChatMessageItem {
  chatId: number;
  message: ChatMessage;
  updated?: boolean;
}

export function newestChatActivity(items: SyncedChatMessageItem[], lastActivity: number) {
  return items.filter(item=>!item.updated&&item.message.kind!=='system'&&item.message.createdAt>=lastActivity)
    .reduce<ChatMessage|undefined>((latest,item)=>!latest||item.message.createdAt>=latest.createdAt?item.message:latest,undefined);
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
