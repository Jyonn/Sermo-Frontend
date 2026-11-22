import type { ChatMessageDTO, ImageMetadataDTO, TinyUserDTO, VideoMetadataDTO } from "../types";

export interface ChatPreviewImage {
  uri: string;
  messageId: number | null;
  sourceMessage?: ChatMessageDTO;
  kind?: "image" | "video";
  metadata?: ImageMetadataDTO | VideoMetadataDTO | null;
  posterUri?: string | null;
  owner?: TinyUserDTO | null;
  createdAt?: number;
}

export const chatMediaMessageTypes = [1, 4] as const;
export const isChatHistoryMedia = (row: ChatMessageDTO) =>
  (row.type === chatMediaMessageTypes[0] || row.type === chatMediaMessageTypes[1]) && Boolean(row.payload?.uri);

export async function readOlderChatMediaPage(
  before: number,
  read: (type: number) => Promise<{items: ChatMessageDTO[]; has_more: boolean}>,
) {
  const pages = await Promise.all(chatMediaMessageTypes.map(read));
  // Use the nearer boundary so one busy media type cannot skip older rows of the other type.
  const boundary = Math.max(0, ...pages.filter(page => page.has_more && page.items.length)
    .map(page => Math.min(...page.items.map(row => row.message_id))));
  const rows = pages.flatMap(page => page.items).filter(row => row.message_id >= boundary && row.message_id < before);
  return {rows, before: boundary || Math.min(before, ...rows.map(row => row.message_id)), hasMore: boundary > 0 && boundary < before};
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
  } while (hasMore && !rows.some(isChatHistoryMedia));
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
