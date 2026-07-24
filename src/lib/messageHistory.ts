import { api } from "./api";
import type { ChatMessageDTO } from "../types";

const PAGE_SIZE = 100;

export async function loadMessagesAfterThrough(
  chatId: number,
  afterMessageId: number,
  throughMessageId: number,
  signal?: AbortSignal,
) {
  const rows: ChatMessageDTO[] = [];
  let cursor = afterMessageId;

  while (cursor < throughMessageId) {
    const next = await api.getMessages({ chat_id: chatId, limit: PAGE_SIZE, after: cursor }, signal);
    if (!next.length) break;
    rows.push(...next);
    const nextCursor = Math.max(...next.map((message) => message.message_id));
    if (nextCursor <= cursor) break;
    cursor = nextCursor;
    if (next.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function loadMessagesBeforeThrough(
  chatId: number,
  beforeMessageId: number,
  throughMessageId: number,
  signal?: AbortSignal,
) {
  const rows: ChatMessageDTO[] = [];
  let cursor = beforeMessageId;

  while (cursor > throughMessageId) {
    const next = await api.getMessages({ chat_id: chatId, limit: PAGE_SIZE, before: cursor }, signal);
    if (!next.length) break;
    rows.push(...next);
    const nextCursor = Math.min(...next.map((message) => message.message_id));
    if (nextCursor >= cursor) break;
    cursor = nextCursor;
    if (next.some((message) => message.message_id <= throughMessageId) || next.length < PAGE_SIZE) break;
  }

  return rows;
}
