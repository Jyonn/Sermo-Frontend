import type { ChatMessage, ChatMessageDTO, MessageKind } from "../types";

const MESSAGE_KIND_BY_TYPE: Record<number, MessageKind> = {
  0: "text",
  1: "image",
  2: "file",
  3: "system",
  4: "video",
  5: "audio",
  6: "location",
  7: "map_access",
  8: "statement",
  9: "sticker",
  10: "forward_bundle",
  11: "activity",
  12: "official_notice",
  13: "submission_invite",
};

export function messageKindFromType(type: number): MessageKind {
  return MESSAGE_KIND_BY_TYPE[type] || "text";
}

function mapChatMessageSender(message: ChatMessageDTO, currentUserId: number) {
  return {
    userId: message.user.user_id,
    from: message.user.user_id === currentUserId ? "self" as const : "other" as const,
    name: message.user.name,
    anonymous: message.user.anonymous,
    avatarUri: message.user.avatar_uri,
    avatarCacheKey: message.user.avatar_cache_key,
    isPermanentVip: message.user.is_permanent_vip,
    chatBubbleStyle: message.user.chat_bubble_style,
    avatarFrameStyle: message.user.avatar_frame_style,
  };
}

export function mapChatMessageDTO(
  message: ChatMessageDTO,
  currentUserId: number,
  formatTimestamp: (value: number) => string = () => "",
): ChatMessage {
  const kind = message.payload?.kind ?? messageKindFromType(message.type);
  const text = message.payload?.text || message.content;
  return {
    id: message.message_id,
    clientId: message.client_message_id || `server:${message.message_id}`,
    ...mapChatMessageSender(message, currentUserId),
    type: message.type,
    kind,
    time: formatTimestamp(message.created_at),
    createdAt: message.created_at,
    text,
    payload: message.payload ?? (kind === "text" ? { kind: "text", text: message.content } : null),
    replyTo: message.reply_to ?? null,
    mentions: message.mentions ?? [],
    status: "sent",
    submissionRound: message.submission_round,
    submissionVisible: message.submission_visible,
  };
}
