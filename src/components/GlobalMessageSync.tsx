import { useEffect, useMemo, useRef, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache } from "../lib/chatCache";
import { normalizeStableResourceUri } from "../lib/stableResource";
import { emitChatSync, type SyncedChatMessageItem } from "../lib/chatSync";
import { UserAvatar } from "./UserAvatar";
import type { Chat, ChatDTO, ChatMessage, ChatMessageDTO, ChatSyncItemDTO, UserDTO } from "../types";

const SYNC_LIMIT = 50;
const CURSOR_KEY_PREFIX = "sermo-sync-cursor:";
const DEBUG_SYNC = false;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_SYSTEM = 3;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;

interface PopupState {
  chatId: number | null;
  title: string;
  preview: string;
  count: number;
  avatarUri?: string;
}

function formatChatListTime(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return "刚刚";

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `${Math.floor(minutes / 60)} 小时前`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";

  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function formatPresence(user: UserDTO | null) {
  if (!user) return "暂无状态";
  if (user.is_alive) return "在线";

  const minutes = Math.floor(Date.now() / 1000 - user.last_heartbeat) / 60;
  if (minutes < 30) return "刚刚活跃";
  return "离线";
}

function mapChatMessage(message: ChatMessageDTO, currentUserId: number): ChatMessage {
  const kind =
    message.payload?.kind ??
    (message.type === MESSAGE_TYPE_IMAGE
      ? "image"
      : message.type === MESSAGE_TYPE_FILE
        ? "file"
      : message.type === MESSAGE_TYPE_VIDEO
        ? "video"
        : message.type === MESSAGE_TYPE_AUDIO
          ? "audio"
          : message.type === MESSAGE_TYPE_SYSTEM
            ? "system"
            : "text");
  return {
    id: message.message_id,
    clientId: `server:${message.message_id}`,
    from: message.user.user_id === currentUserId ? "self" : "other",
    type: message.type,
    kind,
    name: message.user.name,
    avatarUri: message.user.avatar_uri,
    time: "",
    createdAt: message.created_at,
    text: message.content,
    payload: message.payload ?? (kind === "text" ? { kind: "text", text: message.content } : null),
    status: "sent",
  };
}

function sortMessages(items: ChatMessage[]) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function preserveStableMediaUri(existing: ChatMessage | undefined, incoming: ChatMessage) {
  if (!existing || !existing.payload?.uri || !incoming.payload?.uri) return incoming;
  if (existing.kind !== incoming.kind) return incoming;
  if (!(existing.kind === "image" || existing.kind === "video" || existing.kind === "audio")) return incoming;

  const existingResource = normalizeStableResourceUri(existing.payload.uri);
  const incomingResource = normalizeStableResourceUri(incoming.payload.uri);
  if (!existingResource || existingResource !== incomingResource) return incoming;
  if (existing.payload.uri === incoming.payload.uri) return incoming;

  return {
    ...incoming,
    payload: {
      ...incoming.payload,
      uri: existing.payload.uri,
    },
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const bucket = new Map<number | string, ChatMessage>();
  current.forEach((message) => bucket.set(message.id, message));
  incoming.forEach((message) => {
    const existing = bucket.get(message.id);
    bucket.set(message.id, preserveStableMediaUri(existing, message));
  });
  return sortMessages([...bucket.values()]);
}

function sortChats(items: Chat[]) {
  return [...items].sort((left, right) => right.lastActivity - left.lastActivity);
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || "未命名会话";
  const presence = formatPresence(peer);
  const isOwner = Boolean(chat.group && chat.owner?.user_id === currentUserId);
  const members = [...chat.members]
    .map((member) => ({
      userId: member.user_id,
      name: member.name,
      avatarUri: member.avatar_uri,
      isSelf: member.user_id === currentUserId,
      isOwner: Boolean(chat.owner?.user_id === member.user_id),
    }))
    .sort((left, right) => {
      if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
      if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
      return left.name.localeCompare(right.name, "zh-CN");
    });

  const lastActivity = chat.last_message?.created_at ?? chat.last_chat_at;

  return {
    id: chat.chat_id,
    title,
    avatarUri: peer?.avatar_uri,
    subtitle: chat.group ? `${chat.members.length} 人` : presence,
    preview: chat.last_message?.content || "暂无消息",
    time: formatChatListTime(lastActivity),
    lastActivity,
    unread: chat.unread_count ?? 0,
    online: chat.group ? false : Boolean(peer?.is_alive),
    verified: Boolean(peer?.verified),
    members: chat.members.length,
    type: chat.group ? "group" : "direct",
    isOwner,
    detail: {
      summary: chat.group ? "围绕同一主题的讨论会集中在这里。" : "先聊两句，再决定要不要进一步建立关系。",
      relation: chat.group ? (isOwner ? "你是群主" : "你已加入该群聊") : "一对一会话",
      actions: chat.group ? (isOwner ? ["邀请成员", "解散群聊"] : ["退出群聊"]) : ["发起好友申请", "静音通知"],
      members,
    },
    messages: [],
  };
}

function getCursorKey(scope: string) {
  return `${CURSOR_KEY_PREFIX}${scope}`;
}

function readCursor(scope: string) {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(getCursorKey(scope));
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clearCursor(scope: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getCursorKey(scope));
}

function persistCursor(scope: string, value: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getCursorKey(scope), String(value));
}

function resolveNextCursor(
  currentCursor: number,
  response: { after_message_id?: number | string; next_after?: number | string; items: SyncedChatMessageItem[] }
) {
  const explicitCursor = response.after_message_id ?? response.next_after;
  const normalizedExplicitCursor =
    typeof explicitCursor === "string" ? Number(explicitCursor) : typeof explicitCursor === "number" ? explicitCursor : null;
  if (typeof normalizedExplicitCursor === "number" && Number.isFinite(normalizedExplicitCursor)) {
    return normalizedExplicitCursor;
  }

  const maxMessageId = response.items.reduce((max, item) => Math.max(max, Number(item.message.id)), currentCursor);
  return maxMessageId;
}

function previewFromMessage(message: ChatMessage) {
  if (message.kind === "image") return "[图片]";
  if (message.kind === "video") return "[视频]";
  if (message.kind === "audio") return "[语音]";
  if (message.kind === "file") return "[文件]";
  return message.text || "收到一条新消息";
}

function isChatMessageDTO(value: unknown): value is ChatMessageDTO {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChatMessageDTO>;
  return (
    typeof candidate.message_id === "number" &&
    typeof candidate.content === "string" &&
    typeof candidate.created_at === "number" &&
    typeof candidate.user === "object" &&
    candidate.user !== null
  );
}

function normalizeSyncItems(
  items: unknown[],
  currentUserId: number,
  fallbackChatId: number | null
): SyncedChatMessageItem[] {
  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;

      const candidate = raw as Partial<ChatSyncItemDTO> & Partial<ChatMessageDTO> & { message?: unknown; chat_id?: number };
      const messageSource = isChatMessageDTO(candidate.message) ? candidate.message : isChatMessageDTO(candidate) ? candidate : null;
      const chatId = typeof candidate.chat_id === "number" ? candidate.chat_id : fallbackChatId;

      if (!messageSource || !chatId) return null;

      return {
        chatId,
        message: mapChatMessage(messageSource, currentUserId),
      };
    })
    .filter((item): item is SyncedChatMessageItem => Boolean(item));
}

export function GlobalMessageSync() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [afterMessageId, setAfterMessageId] = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const cursorRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const scope = session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null;
  const activeChatId = useMemo(() => {
    const matched = matchPath("/app/chats/:chatId", location.pathname);
    return matched?.params.chatId ? Number(matched.params.chatId) : null;
  }, [location.pathname]);

  useEffect(() => {
    if (!scope || !session) {
      setAfterMessageId(null);
      cursorRef.current = null;
      return;
    }

    const existing = readCursor(scope);
    if (existing !== null && existing > 0) {
      if (DEBUG_SYNC) {
        console.log("[sync] reuse stored cursor", { scope, after: existing });
      }
      cursorRef.current = existing;
      setAfterMessageId(existing);
      return;
    }

    if (existing === 0) {
      if (DEBUG_SYNC) {
        console.log("[sync] discard stale zero cursor", { scope });
      }
      clearCursor(scope);
    }

    const controller = new AbortController();

    api
      .getChats(controller.signal)
      .then((rows) => {
        const nextCursor = rows.reduce((max, chat) => Math.max(max, chat.last_message?.message_id ?? 0), 0);
        if (DEBUG_SYNC) {
          console.log("[sync] bootstrap cursor from chats", {
            scope,
            after: nextCursor,
            chats: rows.length,
          });
        }
        cursorRef.current = nextCursor;
        setAfterMessageId(nextCursor);
        persistCursor(scope, nextCursor);
      })
      .catch(() => {
        if (DEBUG_SYNC) {
          console.log("[sync] bootstrap cursor fallback", { scope, after: 0 });
        }
        cursorRef.current = 0;
        setAfterMessageId(0);
      });

    return () => controller.abort();
  }, [scope, session]);

  useEffect(() => {
    if (!scope || !session || afterMessageId === null) return;

    let cancelled = false;

    const applyToCache = async (items: SyncedChatMessageItem[]) => {
      const grouped = new Map<number, ChatMessage[]>();

      items.forEach((item) => {
        const bucket = grouped.get(item.chatId) ?? [];
        bucket.push(item.message);
        grouped.set(item.chatId, bucket);
      });

      for (const [chatId, incoming] of grouped) {
        const existingThread = chatCache.getThread(scope, chatId) ?? (await chatCache.hydrateThread(scope, chatId));
        const mergedMessages = mergeMessages(existingThread?.messages ?? [], incoming);
        const snapshot = {
          messages: mergedMessages,
          hasOlderMessages: existingThread?.hasOlderMessages ?? false,
          scrollTop: existingThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        };
        chatCache.setThread(scope, chatId, snapshot);
        void chatCache.persistThread(scope, chatId, snapshot);
      }

      let listRecord = chatCache.getChatList(scope) ?? (await chatCache.hydrateChatList(scope));
      const hasMissingChats = listRecord?.chats
        ? [...grouped.keys()].some((chatId) => !listRecord?.chats.some((chat) => chat.id === chatId))
        : true;

      if (!listRecord?.chats.length || hasMissingChats) {
        try {
          const freshChats = sortChats((await api.getChats()).map((chat) => mapChat(chat, session.user.user_id)));
          chatCache.setChatList(scope, freshChats);
          await chatCache.persistChatList(scope, freshChats);
          listRecord = chatCache.getChatList(scope);
        } catch {
          listRecord = chatCache.getChatList(scope) ?? listRecord;
        }
      }

      if (!listRecord?.chats.length) return;

      const nextChats = sortChats(
        listRecord.chats.map((chat) => {
          const incoming = grouped.get(chat.id);
          if (!incoming?.length) return chat;
          const newest = incoming[incoming.length - 1];
          const unreadIncrement = chat.id === activeChatId ? 0 : incoming.filter((item) => item.from === "other").length;
          return {
            ...chat,
            preview: newest.text,
            time: formatChatListTime(newest.createdAt),
            lastActivity: newest.createdAt,
            unread: chat.id === activeChatId ? 0 : chat.unread + unreadIncrement,
          };
        })
      );

      chatCache.setChatList(scope, nextChats);
      void chatCache.persistChatList(scope, nextChats);
    };

    const poll = async () => {
      if (syncInFlightRef.current) {
        if (DEBUG_SYNC) {
          console.log("[sync] skip overlapping poll");
        }
        return;
      }

      syncInFlightRef.current = true;
      try {
        let cursor = cursorRef.current ?? afterMessageId;
        let hasMore = true;
        let loopCount = 0;
        const allItems: SyncedChatMessageItem[] = [];

        while (hasMore && loopCount < 5) {
          if (DEBUG_SYNC) {
            console.log("[sync] request", { after: cursor, limit: SYNC_LIMIT, loopCount });
          }
          const response = await api.getMessagesSync({ after: cursor, limit: SYNC_LIMIT });
          const normalizedItems = normalizeSyncItems(response.items as unknown[], session.user.user_id, activeChatId);
          const nextCursor = resolveNextCursor(cursor, {
            after_message_id: response.after_message_id,
            next_after: response.next_after,
            items: normalizedItems,
          });
          if (DEBUG_SYNC) {
            console.log("[sync] response", {
              rawAfterMessageId: response.after_message_id,
              rawNextAfter: response.next_after,
              items: response.items.length,
              hasMore: response.has_more,
              resolvedNextCursor: nextCursor,
            });
          }
          cursor = nextCursor;
          hasMore = response.has_more;
          loopCount += 1;

          allItems.push(...normalizedItems);

          if (!response.items.length && !response.has_more) break;
        }

        if (cancelled) return;

        if (cursor !== (cursorRef.current ?? afterMessageId)) {
          cursorRef.current = cursor;
          setAfterMessageId(cursor);
          persistCursor(scope, cursor);
        }

        if (!allItems.length) return;

        await applyToCache(allItems);
        emitChatSync({ afterMessageId: cursor, items: allItems });

        const otherChatItems = allItems.filter((item) => item.chatId !== activeChatId && item.message.from === "other");
        if (!otherChatItems.length) return;

        const latest = otherChatItems[otherChatItems.length - 1];
        const uniqueChatIds = new Set(otherChatItems.map((item) => item.chatId));
        const chatList = chatCache.getChatList(scope)?.chats ?? [];
        const chat = chatList.find((item) => item.id === latest.chatId);

        setPopup({
          chatId: uniqueChatIds.size === 1 ? latest.chatId : null,
          title: uniqueChatIds.size === 1 ? chat?.title ?? latest.message.name : `${uniqueChatIds.size} 个会话有新消息`,
          preview: uniqueChatIds.size === 1 ? previewFromMessage(latest.message) : `${chat?.title ?? latest.message.name}: ${previewFromMessage(latest.message)}`,
          count: otherChatItems.length,
          avatarUri: uniqueChatIds.size === 1 ? chat?.avatarUri ?? latest.message.avatarUri : undefined,
        });

        if (activeChatId && allItems.some((item) => item.chatId === activeChatId && item.message.from === "other")) {
          void api.markChatRead(activeChatId);
        }
      } catch (error) {
        if (cancelled) return;
        if (DEBUG_SYNC) {
          console.error("[sync] poll failed", error);
        }
        if (error instanceof ApiError && error.status === 401) return;
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    return () => {
      cancelled = true;
      syncInFlightRef.current = false;
      window.clearInterval(timer);
    };
  }, [activeChatId, afterMessageId, scope, session]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 4200);
    return () => window.clearTimeout(timer);
  }, [popup]);

  useEffect(() => {
    if (!popup?.chatId || activeChatId !== popup.chatId) return;
    setPopup(null);
  }, [activeChatId, popup]);

  if (!session || !popup) return null;

  return (
    <button
      className="chat-sync-popup"
      onClick={() => {
        setPopup(null);
        navigate(popup.chatId ? `/app/chats/${popup.chatId}` : "/app/chats");
      }}
      type="button"
    >
      <UserAvatar className="chat-sync-popup-avatar" name={popup.title} uri={popup.avatarUri} />
      <div className="chat-sync-popup-copy">
        <strong>{popup.title}</strong>
        <span>{popup.preview}</span>
      </div>
      {popup.count > 1 ? <span className="chat-sync-popup-count">{popup.count}</span> : null}
    </button>
  );
}
