import type { ChatMessage, ChatMessageDTO } from "../types";

type ChatMessageSender = Pick<
  ChatMessage,
  | "userId"
  | "from"
  | "name"
  | "avatarUri"
  | "avatarCacheKey"
  | "isPermanentVip"
  | "chatBubbleStyle"
  | "avatarFrameStyle"
>;

export function mapChatMessageSender(message: ChatMessageDTO, currentUserId: number): ChatMessageSender {
  return {
    userId: message.user.user_id,
    from: message.user.user_id === currentUserId ? "self" : "other",
    name: message.user.name,
    avatarUri: message.user.avatar_uri,
    avatarCacheKey: message.user.avatar_cache_key,
    isPermanentVip: message.user.is_permanent_vip,
    chatBubbleStyle: message.user.chat_bubble_style,
    avatarFrameStyle: message.user.avatar_frame_style,
  };
}
