import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache } from "../lib/chatCache";
import { normalizeStableResourceUri } from "../lib/stableResource";
import { emitChatSync, type SyncedChatMessageItem } from "../lib/chatSync";
import { recordChatHealth } from "../lib/chatHealth";
import { getGestureLockScope, isGestureAccessSuppressed } from "../lib/gestureLock";
import { installWebReminderAudioUnlock, playWebReminderSound } from "../lib/webReminderPreferences";
import { loadMessagesAfterThrough } from "../lib/messageHistory";
import { purgeCachedMedia } from "../lib/mediaCache";
import { getActiveLocale, i18n } from "../lib/language";
import { UserAvatar } from "./UserAvatar";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import type { Chat, ChatDTO, ChatMessage, ChatMessageDTO, ChatSyncStateDTO, UserDTO } from "../types";

const SYNC_LIMIT = 50;
const CURSOR_KEY_PREFIX = "sermo-sync-v2-cursor:";
const DEBUG_SYNC = false;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_SYSTEM = 3;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;
const MESSAGE_TYPE_LOCATION = 6;

interface PopupState {
  chatId: number | null;
  title: string;
  preview: string;
  count: number;
  avatarUri?: string;
}

interface NestedMessageEventPayload {
  chat_id: number;
  message: ChatMessageDTO;
}

function formatChatListTime(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return i18n.t("time.justNow");

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return i18n.t("time.hoursAgo", { count: Math.floor(minutes / 60) });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return i18n.t("time.yesterday");

  return new Intl.DateTimeFormat(getActiveLocale(), { month: "numeric", day: "numeric" }).format(date);
}

function formatPresence(user: UserDTO | null) {
  if (!user) return i18n.t("presence.unavailable");
  if (user.is_alive) return i18n.t("presence.online");

  const minutes = Math.floor(Date.now() / 1000 - user.last_heartbeat) / 60;
  if (minutes < 30) return i18n.t("presence.recentlyActive");
  return i18n.t("presence.offline");
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
          : message.type === MESSAGE_TYPE_LOCATION
            ? "location"
          : message.type === MESSAGE_TYPE_SYSTEM
            ? "system"
            : "text");
  return {
    id: message.message_id,
    clientId: message.client_message_id || `server:${message.message_id}`,
    from: message.user.user_id === currentUserId ? "self" : "other",
    type: message.type,
    kind,
    name: message.user.name,
    avatarUri: message.user.avatar_uri,
    time: "",
    createdAt: message.created_at,
    text: message.content,
    payload: message.payload ?? (kind === "text" ? { kind: "text", text: message.content } : null),
    replyTo: message.reply_to ?? null,
    mentions: message.mentions ?? [],
    status: "sent",
  };
}

function sortMessages(items: ChatMessage[]) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function preserveStableMediaUri(existing: ChatMessage | undefined, incoming: ChatMessage) {
  if (!existing) return incoming;
  const reconciled = {
    ...incoming,
    clientId: existing.clientId,
    localPreviewUri: existing.localPreviewUri,
    isPermanentVip: incoming.isPermanentVip ?? existing.isPermanentVip,
    chatBubbleStyle: incoming.chatBubbleStyle ?? existing.chatBubbleStyle,
    avatarFrameStyle: incoming.avatarFrameStyle ?? existing.avatarFrameStyle,
  };
  if (!existing.payload?.uri || !incoming.payload?.uri) return reconciled;
  if (existing.kind !== incoming.kind) return reconciled;
  if (!(existing.kind === "image" || existing.kind === "video" || existing.kind === "audio" || existing.kind === "file")) return reconciled;

  const existingResource = normalizeStableResourceUri(existing.payload.uri);
  const incomingResource = normalizeStableResourceUri(incoming.payload.uri);
  if (!existingResource || existingResource !== incomingResource) return reconciled;
  if (existing.payload.uri === incoming.payload.uri) return reconciled;

  return {
    ...reconciled,
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
    const existingByClientId = [...bucket.values()].find((existing) => existing.clientId === message.clientId);
    if (existingByClientId && existingByClientId.id !== message.id) bucket.delete(existingByClientId.id);
    let optimisticMatch: ChatMessage | undefined;
    if (message.from === "self" && message.status === "sent" && !existingByClientId) {
      optimisticMatch = [...bucket.values()].find((existing) => {
        if (existing.from !== "self" || existing.status !== "pending" || existing.kind !== message.kind) return false;
        if (existing.kind === "text") return existing.text === message.text && Math.abs(existing.createdAt - message.createdAt) <= 30;
        return ["image", "video", "audio", "file"].includes(existing.kind) && Math.abs(existing.createdAt - message.createdAt) <= 600;
      });
      if (optimisticMatch) bucket.delete(optimisticMatch.id);
    }
    const existing = existingByClientId ?? optimisticMatch ?? bucket.get(message.id);
    bucket.set(message.id, preserveStableMediaUri(existing, message));
  });
  return sortMessages([...bucket.values()]);
}

function sortChats(items: Chat[]) {
  return [...items].sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.lastActivity - left.lastActivity);
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || i18n.t("chat.unnamed");
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
      return left.name.localeCompare(right.name, getActiveLocale());
    });

  const lastActivity = chat.last_message?.created_at ?? chat.last_chat_at;

  return {
    id: chat.chat_id,
    title,
    avatarUri: peer?.avatar_uri,
    subtitle: chat.group ? i18n.t("chat.memberCount", { count: chat.members.length }) : presence,
    preview: chat.last_message?.content || i18n.t("chat.noMessages"),
    time: formatChatListTime(lastActivity),
    lastActivity,
    unread: chat.unread_count ?? 0,
    online: chat.group ? false : Boolean(peer?.is_alive),
    verified: Boolean(peer?.verified),
    members: chat.members.length,
    type: chat.group ? "group" : "direct",
    isOwner,
    pinned: Boolean(chat.pinned),
    onlineReminderEnabled: Boolean(chat.online_reminder_enabled),
    notificationsMuted: Boolean(chat.notifications_muted),
    unreadBadgeMuted: Boolean(chat.unread_badge_muted),
    hasUnreadMention: Boolean(chat.has_unread_mention),
    detail: {
      summary: chat.group ? i18n.t("chat.groupSummary") : i18n.t("chat.directSummary"),
      relation: chat.group ? (isOwner ? i18n.t("chat.ownerRelation") : i18n.t("chat.memberRelation")) : i18n.t("chat.directRelation"),
      actions: chat.group
        ? (isOwner ? [i18n.t("chat.inviteMembers"), i18n.t("chat.disband")] : [i18n.t("chat.leave")])
        : [i18n.t("chat.friendRequest"), i18n.t("chat.mute")],
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
  const value = window.localStorage.getItem(getCursorKey(scope));
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function persistCursor(scope: string, value: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getCursorKey(scope), String(value));
}

function previewFromMessage(message: ChatMessage) {
  if (message.kind === "image") return i18n.t("message.imagePlaceholder");
  if (message.kind === "video") return i18n.t("message.videoPlaceholder");
  if (message.kind === "audio") return i18n.t("message.audioPlaceholder");
  if (message.kind === "file") return i18n.t("message.filePlaceholder");
  if (message.kind === "location") return i18n.t("message.locationPlaceholder");
  return message.text || i18n.t("message.new");
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

      const candidate = raw as Partial<NestedMessageEventPayload> & Partial<ChatMessageDTO> & { message?: unknown; chat_id?: number };
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
  const features = useSpaceFeatures();
  const [afterMessageId, setAfterMessageId] = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [popupDragOffset, setPopupDragOffset] = useState(0);
  const [popupDragging, setPopupDragging] = useState(false);
  const cursorRef = useRef<number | null>(null);
  const popupPointerRef = useRef<{ pointerId: number; startY: number } | null>(null);
  const suppressPopupClickRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const presencePollCountRef = useRef(0);
  const presenceBaselineRef = useRef<Map<number, boolean> | null>(null);
  const sessionUserId = session?.user.user_id ?? null;
  const sessionAccessToken = session?.accessToken ?? null;
  const scope = session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null;
  const gestureScope = getGestureLockScope(session);
  const activeChatId = useMemo(() => {
    const matched = matchPath("/app/chats/:chatId", location.pathname);
    return matched?.params.chatId ? Number(matched.params.chatId) : null;
  }, [location.pathname]);

  useEffect(() => {
    installWebReminderAudioUnlock();
  }, []);

  useEffect(() => {
    if (!scope || !session || !features.ready || !features.chatEnabled) {
      setAfterMessageId(null);
      cursorRef.current = null;
      presenceBaselineRef.current = null;
      return;
    }

    const existing = readCursor(scope);
    if (existing !== null && existing >= 0) {
      if (DEBUG_SYNC) {
        console.log("[sync] reuse stored cursor", { scope, after: existing });
      }
      cursorRef.current = existing;
      setAfterMessageId(existing);
      return;
    }

    cursorRef.current = 0;
    setAfterMessageId(0);
    persistCursor(scope, 0);
  }, [features.chatEnabled, features.ready, scope, sessionAccessToken, sessionUserId]);

  useEffect(() => {
    if (!scope || !session || afterMessageId === null || !features.ready || !features.chatEnabled) return;

    let cancelled = false;

    const applyToCache = async (items: SyncedChatMessageItem[], chatStates: Map<number, ChatSyncStateDTO>) => {
      const grouped = new Map<number, ChatMessage[]>();

      items.forEach((item) => {
        const bucket = grouped.get(item.chatId) ?? [];
        bucket.push(item.message);
        grouped.set(item.chatId, bucket);
      });

      for (const [chatId, incoming] of grouped) {
        const existingThread = chatCache.getThread(scope, chatId) ?? (await chatCache.hydrateThread(scope, chatId));
        const existingMessages = existingThread?.messages ?? [];
        const existingIds = existingMessages.flatMap((message) => (typeof message.id === "number" ? [message.id] : []));
        const incomingIds = incoming.flatMap((message) => (typeof message.id === "number" ? [message.id] : []));
        const existingMaxId = existingIds.length ? Math.max(...existingIds) : null;
        const incomingMaxId = incomingIds.length ? Math.max(...incomingIds) : null;
        const bridgeRows =
          existingMaxId !== null && incomingMaxId !== null && existingMaxId < incomingMaxId
            ? await loadMessagesAfterThrough(chatId, existingMaxId, incomingMaxId)
            : [];
        const bridgeMessages = bridgeRows.map((message) => mapChatMessage(message, session.user.user_id));
        const mergedMessages = mergeMessages(mergeMessages(existingMessages, bridgeMessages), incoming);
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
          const readState = chatStates.get(chat.id);
          if (!incoming?.length && !readState) return chat;
          const ordinaryIncoming = incoming?.filter((message) => message.kind !== "system") ?? [];
          const newest = ordinaryIncoming[ordinaryIncoming.length - 1];
          return {
            ...chat,
            ...(newest ? {
              preview: previewFromMessage(newest),
              time: formatChatListTime(newest.createdAt),
              lastActivity: newest.createdAt,
            } : {}),
            unread: chat.id === activeChatId
              ? 0
              : readState?.unread_count ?? chat.unread,
            unreadBadgeMuted: readState?.unread_badge_muted ?? chat.unreadBadgeMuted,
            hasUnreadMention: chat.id === activeChatId ? false : readState?.has_unread_mention ?? chat.hasUnreadMention,
          };
        })
      );

      chatCache.setChatList(scope, nextChats);
      void chatCache.persistChatList(scope, nextChats);
    };

    const applyRemovalsToCache = async (removed: Array<{ chatId: number; messageId: number }>) => {
      const grouped = new Map<number, Set<number>>();
      removed.forEach(({ chatId, messageId }) => {
        const ids = grouped.get(chatId) ?? new Set<number>();
        ids.add(messageId);
        grouped.set(chatId, ids);
      });
      for (const [chatId, ids] of grouped) {
        const thread = chatCache.getThread(scope, chatId) ?? (await chatCache.hydrateThread(scope, chatId));
        if (!thread) continue;
        const removedMessages = thread.messages.filter((message) => typeof message.id === "number" && ids.has(message.id));
        removedMessages.forEach((message) => purgeCachedMedia([message.payload?.uri, message.payload?.thumbnail_uri]));
        const snapshot = {
          ...thread,
          messages: thread.messages.filter((message) => typeof message.id !== "number" || !ids.has(message.id)),
          updatedAt: Date.now(),
        };
        chatCache.setThread(scope, chatId, snapshot);
        await chatCache.persistThread(scope, chatId, snapshot);
      }
    };

    const poll = async () => {
      if (isGestureAccessSuppressed(gestureScope)) {
        setPopup(null);
        return;
      }
      if (syncInFlightRef.current) {
        if (DEBUG_SYNC) {
          console.log("[sync] skip overlapping poll");
        }
        return;
      }

      syncInFlightRef.current = true;
      try {
        presencePollCountRef.current += 1;
        if (presencePollCountRef.current % 5 === 0) {
          const freshChats = sortChats((await api.getChats()).map((chat) => mapChat(chat, session.user.user_id)));
          const previousPresence = presenceBaselineRef.current;
          const newlyOnline = freshChats.find((chat) => {
            const previous = previousPresence?.get(chat.id);
            return chat.type === "direct" && chat.online && previous === false && chat.onlineReminderEnabled;
          });
          presenceBaselineRef.current = new Map(freshChats.map((chat) => [chat.id, chat.online]));
          chatCache.setChatList(scope, freshChats);
          void chatCache.persistChatList(scope, freshChats);
          if (newlyOnline && !isGestureAccessSuppressed(gestureScope)) {
            setPopup({
              chatId: newlyOnline.id,
              title: newlyOnline.title,
              preview: i18n.t("presence.justOnline"),
              count: 1,
              avatarUri: newlyOnline.avatarUri,
            });
            playWebReminderSound();
          }
        }

        let cursor = cursorRef.current ?? afterMessageId;
        let hasMore = true;
        let loopCount = 0;
        const allItems: SyncedChatMessageItem[] = [];
        const allRemoved: Array<{ chatId: number; messageId: number }> = [];
        const allChatStates = new Map<number, ChatSyncStateDTO>();

        while (hasMore && loopCount < 5) {
          if (DEBUG_SYNC) {
            console.log("[sync] request", { after: cursor, limit: SYNC_LIMIT, loopCount });
          }
          const response = await api.getMessageEventsSync({ after: cursor, limit: SYNC_LIMIT });
          const normalizedItems = normalizeSyncItems(
            response.events.filter((event) => event.type === "message.created" && event.message).map((event) => ({ chat_id: event.chat_id, message: event.message })),
            session.user.user_id,
            activeChatId
          );
          const removed = response.events
            .filter((event) => event.type === "message.hidden" || event.type === "message.recalled")
            .map((event) => ({ chatId: event.chat_id, messageId: event.message_id }));
          const nextCursor = response.next_after;
          if (DEBUG_SYNC) {
            console.log("[sync] response", {
              rawNextAfter: response.next_after,
              items: response.events.length,
              hasMore: response.has_more,
              resolvedNextCursor: nextCursor,
            });
          }
          cursor = nextCursor;
          hasMore = response.has_more;
          loopCount += 1;

          allItems.push(...normalizedItems);
          allRemoved.push(...removed);
          (response.chat_states ?? []).forEach((state) => allChatStates.set(state.chat_id, state));

          if (!response.events.length && !response.has_more) break;
        }

        recordChatHealth(scope, true);

        if (cancelled) return;

        if (cursor !== (cursorRef.current ?? afterMessageId)) {
          cursorRef.current = cursor;
          setAfterMessageId(cursor);
          persistCursor(scope, cursor);
        }

        if (!allItems.length && !allRemoved.length && !allChatStates.size) return;

        if (allItems.length || allChatStates.size) await applyToCache(allItems, allChatStates);
        if (allRemoved.length) {
          await applyRemovalsToCache(allRemoved);
          const freshChats = sortChats((await api.getChats()).map((chat) => mapChat(chat, session.user.user_id)));
          chatCache.setChatList(scope, freshChats);
          void chatCache.persistChatList(scope, freshChats);
        }
        emitChatSync({ afterMessageId: cursor, items: allItems, removed: allRemoved, chatStates: [...allChatStates.values()] });

        const otherChatItems = allItems.filter((item) => {
          if (item.chatId === activeChatId || item.message.from !== "other" || item.message.kind === "system") return false;
          const readState = allChatStates.get(item.chatId);
          if (!readState || readState.unread_count <= 0) return false;
          return readState.last_read_at === null || item.message.createdAt > readState.last_read_at;
        });
        if (!otherChatItems.length) return;
        if (isGestureAccessSuppressed(gestureScope)) {
          setPopup(null);
          return;
        }

        const latest = otherChatItems[otherChatItems.length - 1];
        const uniqueChatIds = new Set(otherChatItems.map((item) => item.chatId));
        const chatList = chatCache.getChatList(scope)?.chats ?? [];
        const chat = chatList.find((item) => item.id === latest.chatId);

        setPopup({
          chatId: uniqueChatIds.size === 1 ? latest.chatId : null,
          title: uniqueChatIds.size === 1 ? chat?.title ?? latest.message.name : i18n.t("message.newInChats", { count: uniqueChatIds.size }),
          preview: uniqueChatIds.size === 1 ? previewFromMessage(latest.message) : `${chat?.title ?? latest.message.name}: ${previewFromMessage(latest.message)}`,
          count: otherChatItems.length,
          avatarUri: uniqueChatIds.size === 1 ? chat?.avatarUri ?? latest.message.avatarUri : undefined,
        });
        playWebReminderSound();

        if (activeChatId && allItems.some((item) => item.chatId === activeChatId && item.message.from === "other")) {
          void api.markChatRead(activeChatId);
        }
      } catch (error) {
        if (cancelled) return;
        recordChatHealth(scope, false);
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
  }, [activeChatId, afterMessageId, features.chatEnabled, features.ready, gestureScope, scope, sessionAccessToken, sessionUserId]);

  useEffect(() => {
    if (!popup) return;
    setPopupDragOffset(0);
    setPopupDragging(false);
    const timer = window.setTimeout(() => setPopup(null), 4200);
    return () => window.clearTimeout(timer);
  }, [popup]);

  useEffect(() => {
    if (!popup?.chatId || activeChatId !== popup.chatId) return;
    setPopup(null);
  }, [activeChatId, popup]);

  if (!session || !features.chatEnabled || !popup) return null;

  const handlePopupPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    popupPointerRef.current = { pointerId: event.pointerId, startY: event.clientY };
    suppressPopupClickRef.current = false;
    setPopupDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePopupPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = popupPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const offset = Math.min(0, event.clientY - pointer.startY);
    if (offset < -6) suppressPopupClickRef.current = true;
    setPopupDragOffset(offset);
  };

  const finishPopupGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = popupPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const finalOffset = Math.min(0, event.clientY - pointer.startY);
    popupPointerRef.current = null;
    setPopupDragging(false);
    if (finalOffset <= -34) {
      suppressPopupClickRef.current = true;
      setPopup(null);
      return;
    }
    setPopupDragOffset(0);
  };

  return (
    <button
      className={`chat-sync-popup${popupDragging ? " is-dragging" : ""}`}
      onClick={() => {
        if (suppressPopupClickRef.current) {
          suppressPopupClickRef.current = false;
          return;
        }
        setPopup(null);
        navigate(popup.chatId ? `/app/chats/${popup.chatId}` : "/app/chats");
      }}
      onPointerCancel={finishPopupGesture}
      onPointerDown={handlePopupPointerDown}
      onPointerMove={handlePopupPointerMove}
      onPointerUp={finishPopupGesture}
      style={{ "--popup-drag-y": `${popupDragOffset}px` } as CSSProperties}
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
