import type { ChatMessageDTO, ImageMetadataDTO, TinyUserDTO } from "../types";

export interface ChatPreviewImage {
  uri: string;
  messageId: number | null;
  metadata?: ImageMetadataDTO | null;
  posterUri?: string | null;
  owner?: TinyUserDTO | null;
  createdAt?: number;
}

export async function readNewerChatImagePage(after: number, read: (cursor: number) => Promise<ChatMessageDTO[]>, signal: AbortSignal) {
  let rows: ChatMessageDTO[];
  let hasMore: boolean;
  do {
    signal.throwIfAborted();
    rows = await read(after);
    signal.throwIfAborted();
    const next = Math.max(after, ...rows.map((row) => row.message_id));
    hasMore = rows.length === 100 && next > after;
    after = next;
  } while (hasMore && !rows.some((row) => row.type === 1 && row.payload?.uri));
  return { rows, hasMore, after };
}

export function mergeChatImages(current: ChatPreviewImage[], incoming: ChatPreviewImage[], index: number, direction: "older" | "newer") {
  const identity = (image: ChatPreviewImage) => image.messageId === null ? image.uri : `message:${image.messageId}`;
  const active = current[index] && identity(current[index]);
  const seen = new Set<string>();
  const items = (direction === "older" ? [...incoming, ...current] : [...current, ...incoming]).filter((image) => {
    const key = identity(image);
    if (!image.uri || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { items, index: Math.max(0, items.findIndex((image) => identity(image) === active)) };
}
