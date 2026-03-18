import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildChatCacheScope, chatCache } from "../lib/chatCache";
import { CHAT_SYNC_EVENT, type ChatSyncEventDetail } from "../lib/chatSync";
import { formatRelativeTime } from "../lib/presentation";
import type { AppViewState, Chat, ChatDTO, ChatMessage, ChatMessageDTO, UserDTO } from "../types";

const DEBUG_CHAT_SEND = import.meta.env.DEV;

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThreadDivider(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) return formatTime(value);

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatChatListTime(value: number) {
  const date = new Date(value * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return formatRelativeTime(value);

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
  return {
    id: message.message_id,
    clientId: `server:${message.message_id}`,
    from: message.user.user_id === currentUserId ? "self" : "other",
    name: message.user.name,
    avatarUri: message.user.avatar_uri,
    time: formatTime(message.created_at),
    createdAt: message.created_at,
    text: message.content,
    status: "sent",
  };
}

function sortMessages(items: ChatMessage[]) {
  return [...items].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;

    const leftId = typeof left.id === "number" ? left.id : Number.MAX_SAFE_INTEGER;
    const rightId = typeof right.id === "number" ? right.id : Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  });
}

function isOptimisticSelfMatch(source: ChatMessage, target: ChatMessage) {
  return (
    source.from === "self" &&
    target.from === "self" &&
    source.status !== "sent" &&
    target.status === "sent" &&
    source.text === target.text &&
    Math.abs(source.createdAt - target.createdAt) <= 30
  );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const bucket = new Map<number | string, ChatMessage>();

  current.forEach((message) => bucket.set(message.id, message));
  incoming.forEach((message) => {
    const existingByClientId = [...bucket.values()].find((existing) => existing.clientId === message.clientId);
    if (existingByClientId && existingByClientId.id !== message.id) {
      bucket.delete(existingByClientId.id);
    }

    if (message.status === "sent") {
      const optimisticMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(existing, message));
      if (optimisticMatch) {
        bucket.delete(optimisticMatch.id);
      }
    }

    if (message.status !== "sent") {
      const deliveredMatch = [...bucket.values()].find((existing) => isOptimisticSelfMatch(message, existing));
      if (deliveredMatch) return;
    }

    bucket.set(message.id, message);
  });

  return sortMessages([...bucket.values()]);
}

function createPendingMessage(text: string, name: string): ChatMessage {
  const clientId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Math.floor(Date.now() / 1000);
  return {
    id: clientId,
    clientId,
    from: "self",
    name,
    time: formatTime(createdAt),
    createdAt,
    text,
    status: "pending",
  };
}

function updateMessageStatus(messages: ChatMessage[], clientId: string, status: ChatMessage["status"]) {
  return messages.map((message) => (message.clientId === clientId ? { ...message, status } : message));
}

function confirmPendingMessage(messages: ChatMessage[], clientId: string, delivered: ChatMessage) {
  let confirmed = false;
  const nextMessages = messages.map((message) => {
    if (message.clientId !== clientId) return message;
    confirmed = true;
    return {
      ...message,
      id: delivered.id,
      name: delivered.name,
      text: delivered.text,
      status: "sent" as const,
    };
  });

  return confirmed ? sortMessages(nextMessages) : mergeMessages(messages, [{ ...delivered, clientId }]);
}

function updateChatSummary(chat: Chat, preview: string, lastActivity: number) {
  return {
    ...chat,
    preview,
    time: "刚刚",
    lastActivity,
    unread: 0,
  };
}

function clearChatUnread(chat: Chat) {
  if (chat.unread === 0) return chat;
  return {
    ...chat,
    unread: 0,
  };
}

function shouldGroupMessages(current: ChatMessage, neighbor?: ChatMessage) {
  if (!neighbor) return false;
  return current.from === neighbor.from && Math.abs(current.createdAt - neighbor.createdAt) < 5 * 60;
}

function shouldShowThreadDivider(current: ChatMessage, previous?: ChatMessage) {
  if (!previous) return true;

  const currentDate = new Date(current.createdAt * 1000);
  const previousDate = new Date(previous.createdAt * 1000);
  if (currentDate.toDateString() !== previousDate.toDateString()) return true;

  return Math.abs(current.createdAt - previous.createdAt) >= 10 * 60;
}

function groupRenderSignature(group: MessageGroup, enteringMessageIds: string[]) {
  const entering = group.messages.filter((message) => enteringMessageIds.includes(message.clientId)).map((message) => message.clientId);
  return JSON.stringify({
    key: group.key,
    dividerLabel: group.dividerLabel,
    messages: group.messages.map((message) => ({
      clientId: message.clientId,
      status: message.status,
      text: message.text,
    })),
    entering,
  });
}

const MessageBubbleRow = memo(function MessageBubbleRow({
  from,
  isEntering,
  isFirst,
  isLast,
  message,
  onOpenActions,
  onRetry,
}: MessageBubbleRowProps) {
  const showRetry = from === "self" && message.status === "failed";
  const canOpenActions = message.status === "sent";
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const openActions = () => {
    clearLongPress();
    if (!canOpenActions || !bubbleRef.current) return;
    onOpenActions(message, bubbleRef.current);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canOpenActions) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(openActions, 380);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (deltaX > 8 || deltaY > 8) clearLongPress();
  };

  return (
    <div className={`message-bubble-wrap ${from} ${message.status !== "sent" ? `is-${message.status}` : "is-sent"} ${isEntering ? "is-entering" : ""}`}>
      <div className={`message-bubble-shell ${from}`}>
        {showRetry ? (
          <button aria-label="重试发送" className="message-retry-icon" onClick={() => void onRetry(message)} type="button">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        ) : null}
        <div
          ref={bubbleRef}
          className={[
            "message-bubble",
            from === "self" ? "self" : "other",
            message.status !== "sent" ? `is-${message.status}` : "",
            isFirst ? "group-start" : "",
            isLast ? "group-end" : "",
            canOpenActions ? "message-bubble-actionable" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onContextMenu={
            canOpenActions
              ? (event) => {
                  event.preventDefault();
                  openActions();
                }
              : undefined
          }
          onPointerCancel={clearLongPress}
          onPointerDown={canOpenActions ? handlePointerDown : undefined}
          onPointerLeave={clearLongPress}
          onPointerMove={canOpenActions ? handlePointerMove : undefined}
          onPointerUp={clearLongPress}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
});

const MessageGroupBlock = memo(function MessageGroupBlock({ enteringMessageIds, group, onOpenActions, onRetry }: MessageGroupBlockProps) {
  return (
    <div>
      {group.dividerLabel ? <div className="day-divider">{group.dividerLabel}</div> : null}
      <div className={`message-group ${group.from}`}>
        {group.from === "other" ? <UserAvatar className="avatar message-avatar" name={group.name} uri={group.avatarUri} /> : null}
        <div className="message-bubbles">
          {group.messages.map((message, index) => (
            <MessageBubbleRow
              key={message.clientId}
              from={group.from}
              isEntering={enteringMessageIds.includes(message.clientId)}
              isFirst={index === 0}
              isLast={index === group.messages.length - 1}
              message={message}
              onOpenActions={onOpenActions}
              onRetry={onRetry}
            />
          ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => groupRenderSignature(prev.group, prev.enteringMessageIds) === groupRenderSignature(next.group, next.enteringMessageIds));

interface MessageGroup {
  key: string;
  from: "self" | "other";
  name: string;
  avatarUri?: string;
  dividerLabel?: string;
  messages: ChatMessage[];
}

interface MessageBubbleRowProps {
  from: "self" | "other";
  isEntering: boolean;
  isFirst: boolean;
  isLast: boolean;
  message: ChatMessage;
  onOpenActions: (message: ChatMessage, element: HTMLDivElement) => void;
  onRetry: (message: ChatMessage) => void;
}

interface MessageGroupBlockProps {
  enteringMessageIds: string[];
  group: MessageGroup;
  onOpenActions: (message: ChatMessage, element: HTMLDivElement) => void;
  onRetry: (message: ChatMessage) => void;
}

interface MessageMenuState {
  message: ChatMessage;
  anchorX: number;
  anchorY: number;
  placement: "top" | "bottom";
  confirmDelete: boolean;
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || "未命名会话";
  const presence = formatPresence(peer);
  const isOwner = Boolean(chat.group && chat.owner?.user_id === currentUserId);

  return {
    id: chat.chat_id,
    title,
    avatarUri: peer?.avatar_uri,
    subtitle: chat.group ? `${chat.members.length} 人` : presence,
    preview: chat.last_message?.content || "暂无消息",
    time: formatChatListTime(chat.last_chat_at),
    lastActivity: chat.last_chat_at,
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
      members: chat.members.map((member) => ({
        userId: member.user_id,
        name: member.name,
        avatarUri: member.avatar_uri,
        isSelf: member.user_id === currentUserId,
      })),
    },
    messages: [],
  };
}

function sortChats(items: Chat[]) {
  return [...items].sort((left, right) => right.lastActivity - left.lastActivity);
}

function scrollThreadToBottom(element: HTMLDivElement | null) {
  if (!element) return;

  requestAnimationFrame(() => {
    const target = element;
    target.scrollTop = target.scrollHeight;
  });
}

function animateThreadScroll(element: HTMLDivElement, targetTop: number, duration = 220) {
  const startTop = element.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    element.scrollTop = targetTop;
    return () => {};
  }

  let frameId = 0;
  const startAt = performance.now();
  const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startAt) / duration);
    element.scrollTop = startTop + distance * easeOutCubic(progress);
    if (progress < 1) {
      frameId = requestAnimationFrame(tick);
    }
  };

  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}

function isNearThreadBottom(element: HTMLDivElement | null, threshold = 72) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function filterUsersByName(rows: UserDTO[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((user) => user.name.toLowerCase().includes(normalized));
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [pageError, setPageError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending">("idle");
  const [groupCreateState, setGroupCreateState] = useState<"idle" | "loading-users" | "creating">("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderState, setOlderState] = useState<"idle" | "loading">("idle");
  const [enteringMessageIds, setEnteringMessageIds] = useState<string[]>([]);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [messageDeleteState, setMessageDeleteState] = useState<"idle" | "deleting">("idle");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupCandidates, setGroupCandidates] = useState<UserDTO[]>([]);
  const [groupFriendPool, setGroupFriendPool] = useState<UserDTO[]>([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupInviteOpen, setGroupInviteOpen] = useState(false);
  const [groupRenameValue, setGroupRenameValue] = useState("");
  const [groupManageState, setGroupManageState] = useState<"idle" | "saving" | "loading-candidates">("idle");
  const [currentUserVerified, setCurrentUserVerified] = useState<boolean | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDoneRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingRevealRef = useRef<{ chatId: number; previousHeight: number; previousScrollTop: number } | null>(null);
  const cancelScrollAnimationRef = useRef<(() => void) | null>(null);
  const revealAnimatingRef = useRef(false);
  const [composerHeight, setComposerHeight] = useState(80);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const currentUserId = session?.user.user_id ?? 0;
  const currentUserName = session?.user.name ?? "我";
  const cacheScope = session ? buildChatCacheScope(session.user.space_id, session.user.user_id) : null;

  const triggerMessageEntrance = (messageId: number | string) => {
    const key = String(messageId);
    setEnteringMessageIds((current) => (current.includes(key) ? current : [...current, key]));
    window.setTimeout(() => {
      setEnteringMessageIds((current) => current.filter((item) => item !== key));
    }, 260);
  };

  const queueThreadReveal = (chatId: number) => {
    const element = messageScrollRef.current;
    if (!element) return;
    revealAnimatingRef.current = true;
    pendingRevealRef.current = {
      chatId,
      previousHeight: element.scrollHeight,
      previousScrollTop: element.scrollTop,
    };
  };

  const closeMessageMenu = () => {
    if (messageDeleteState === "deleting") return;
    setMessageMenu(null);
  };

  const openMessageMenu = (message: ChatMessage, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const placement: "top" | "bottom" = rect.top > 96 ? "top" : "bottom";
    setMessageMenu({
      message,
      anchorX: rect.left + rect.width / 2,
      anchorY: placement === "top" ? rect.top - 10 : rect.bottom + 10,
      placement,
      confirmDelete: false,
    });
  };

  useEffect(() => {
    if (!cacheScope) return;
    const controller = new AbortController();
    let didLoadNetwork = false;
    setViewState("loading");
    setPageError(null);

    const memoryRecord = chatCache.getChatList(cacheScope);
    if (memoryRecord?.chats.length) {
      setChats(memoryRecord.chats);
      setViewState("ready");
    } else {
      void chatCache.hydrateChatList(cacheScope).then((cached) => {
        if (controller.signal.aborted || didLoadNetwork || !cached?.chats.length) return;
        setChats(cached.chats);
        setViewState("ready");
      });
    }

    api
      .getChats(controller.signal)
      .then((rows) => {
        didLoadNetwork = true;
        const nextChats = sortChats(rows.map((item) => mapChat(item, currentUserId)));
        setChats(nextChats);
        setViewState("ready");
        void chatCache.persistChatList(cacheScope, nextChats);
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载会话失败";
        setPageError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [cacheScope, currentUserId]);

  const selectedChat = useMemo(() => {
    const numericChatId = Number(chatId);
    if (!numericChatId) return null;
    return chats.find((chat) => chat.id === numericChatId) ?? null;
  }, [chatId, chats]);

  const selectedMessages = useMemo(
    () => (selectedChat ? sortMessages(messages[selectedChat.id] ?? []) : []),
    [messages, selectedChat]
  );

  useEffect(() => {
    if (!DEBUG_CHAT_SEND || !selectedChat) return;
    console.log("[chat] selectedMessages", {
      chatId: selectedChat.id,
      count: selectedMessages.length,
      items: selectedMessages.map((message) => ({
        id: message.id,
        clientId: message.clientId,
        status: message.status,
        text: message.text,
      })),
    });
  }, [selectedChat, selectedMessages]);

  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: MessageGroup[] = [];

    selectedMessages.forEach((message, index) => {
      const previous = selectedMessages[index - 1];
      const dividerLabel = shouldShowThreadDivider(message, previous) ? formatThreadDivider(message.createdAt) : undefined;
      const lastGroup = groups[groups.length - 1];
      const canJoinLastGroup =
        lastGroup &&
        !dividerLabel &&
        shouldGroupMessages(message, lastGroup.messages[lastGroup.messages.length - 1]);

      if (canJoinLastGroup) {
        lastGroup.messages.push(message);
        lastGroup.key = `${lastGroup.messages[0]?.clientId}-${message.clientId}`;
        return;
      }

      groups.push({
        key: message.clientId,
        from: message.from,
        name: message.name,
        avatarUri: message.avatarUri,
        dividerLabel,
        messages: [message],
      });
    });

    return groups;
  }, [selectedMessages]);

  useEffect(() => {
    if (!selectedChat || !cacheScope) return;
    const controller = new AbortController();
    let didLoadNetwork = false;
    setOlderState("idle");
    setHasOlderMessages(false);

    const restoreScroll = (scrollTop: number) => {
      requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        if (scrollTop > 0) {
          element.scrollTop = scrollTop;
          return;
        }
        element.scrollTop = element.scrollHeight;
      });
    };

    const memoryThread = chatCache.getThread(cacheScope, selectedChat.id);
    if (memoryThread?.messages.length) {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(current[selectedChat.id] ?? [], sortMessages(memoryThread.messages)),
      }));
      setHasOlderMessages(memoryThread.hasOlderMessages);
      restoreScroll(memoryThread.scrollTop);
    } else {
      void chatCache.hydrateThread(cacheScope, selectedChat.id).then((cached) => {
        if (controller.signal.aborted || didLoadNetwork || !cached?.messages.length) return;
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: mergeMessages(current[selectedChat.id] ?? [], sortMessages(cached.messages)),
        }));
        setHasOlderMessages(cached.hasOlderMessages);
        restoreScroll(cached.scrollTop);
      });
    }

    const loadLatestMessages = async () => {
      try {
        const rows = await api.getMessages(
          {
            chat_id: selectedChat.id,
            limit: 30,
          },
          controller.signal
        );
        const normalized = sortMessages(rows.map((row) => mapChatMessage(row, currentUserId)));
        const existingThread = chatCache.getThread(cacheScope, selectedChat.id);
        let mergedMessages = mergeMessages(existingThread?.messages ?? [], normalized);
        didLoadNetwork = true;
        if (DEBUG_CHAT_SEND) {
          console.log("[chat] loadLatestMessages response", {
            chatId: selectedChat.id,
            normalized: normalized.map((message) => ({
              id: message.id,
              clientId: message.clientId,
              status: message.status,
              text: message.text,
            })),
            cachedCount: existingThread?.messages.length ?? 0,
          });
        }
        setMessages((current) => {
          const currentThreadMessages = current[selectedChat.id] ?? [];
          mergedMessages = mergeMessages(currentThreadMessages, normalized);
          if (DEBUG_CHAT_SEND) {
            console.log("[chat] loadLatestMessages merge", {
              chatId: selectedChat.id,
              currentCount: currentThreadMessages.length,
              mergedCount: mergedMessages.length,
            });
          }
          return {
            ...current,
            [selectedChat.id]: mergedMessages,
          };
        });
        setHasOlderMessages(rows.length >= 30 || memoryThread?.hasOlderMessages || false);
        chatCache.setThread(cacheScope, selectedChat.id, {
          messages: mergedMessages,
          hasOlderMessages: rows.length >= 30 || memoryThread?.hasOlderMessages || false,
          scrollTop: memoryThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        void chatCache.persistThread(cacheScope, selectedChat.id, {
          messages: mergedMessages,
          hasOlderMessages: rows.length >= 30 || memoryThread?.hasOlderMessages || false,
          scrollTop: memoryThread?.scrollTop ?? 0,
          updatedAt: Date.now(),
        });
        if (!memoryThread?.messages.length) restoreScroll(0);
        void api.markChatRead(selectedChat.id).then(() => {
          setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
        });
      } catch (apiError) {
        if (!controller.signal.aborted) {
          const hasLocalMessages = Boolean((messages[selectedChat.id] ?? []).length || memoryThread?.messages.length);
          if (!hasLocalMessages) {
            const message = apiError instanceof ApiError ? apiError.message : "加载消息失败";
            setPageError(message);
          }
        }
      }
    };

    void loadLatestMessages();
    return () => {
      const element = messageScrollRef.current;
      chatCache.updateThreadScroll(cacheScope, selectedChat.id, element?.scrollTop ?? 0);
      controller.abort();
    };
  }, [cacheScope, currentUserId, selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      initialScrollDoneRef.current = null;
      stickToBottomRef.current = true;
      return;
    }

    if (!selectedMessages.length) return;
    if (initialScrollDoneRef.current === selectedChat.id) return;

    scrollThreadToBottom(messageScrollRef.current);
    initialScrollDoneRef.current = selectedChat.id;
    stickToBottomRef.current = true;
  }, [selectedChat, selectedMessages.length]);

  useEffect(() => {
    if (!selectedChat) return;
    setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
  }, [selectedChat]);

  useEffect(() => {
    setMessageMenu(null);
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!messageMenu) return;

    const close = () => setMessageMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageMenu]);

  useLayoutEffect(() => {
    if (!selectedChat) {
      pendingRevealRef.current = null;
      return;
    }

    const pendingReveal = pendingRevealRef.current;
    if (!pendingReveal || pendingReveal.chatId !== selectedChat.id) return;

    const element = messageScrollRef.current;
    pendingRevealRef.current = null;
    if (!element) {
      revealAnimatingRef.current = false;
      return;
    }

    const delta = element.scrollHeight - pendingReveal.previousHeight;
    const targetTop = Math.max(0, pendingReveal.previousScrollTop + delta);
    cancelScrollAnimationRef.current?.();
    if (DEBUG_CHAT_SEND) {
      console.log("[chat] reveal start", {
        chatId: selectedChat.id,
        previousHeight: pendingReveal.previousHeight,
        nextHeight: element.scrollHeight,
        previousScrollTop: pendingReveal.previousScrollTop,
        targetTop,
        delta,
      });
    }
    cancelScrollAnimationRef.current = animateThreadScroll(element, targetTop);
    window.setTimeout(() => {
      revealAnimatingRef.current = false;
    }, 240);
  }, [selectedChat, selectedMessages.length]);

  useEffect(() => {
    if (!selectedChat) return;
    if (!stickToBottomRef.current) return;
    if (revealAnimatingRef.current) return;

    scrollThreadToBottom(messageScrollRef.current);
  }, [composerHeight, keyboardOffset, selectedChat]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLockViewport = Boolean(selectedChat) && typeof window !== "undefined" && window.innerWidth <= 900;
    if (!shouldLockViewport) {
      delete document.body.dataset.chatDetail;
      return;
    }

    document.body.dataset.chatDetail = "true";

    return () => {
      delete document.body.dataset.chatDetail;
    };
  }, [selectedChat]);

  useEffect(() => {
    return () => {
      cancelScrollAnimationRef.current?.();
      revealAnimatingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleSync = (event: Event) => {
      const detail = (event as CustomEvent<ChatSyncEventDetail>).detail;
      if (!detail?.items.length) return;

      const grouped = new Map<number, ChatSyncEventDetail["items"]>();
      detail.items.forEach((item) => {
        const bucket = grouped.get(item.chatId) ?? [];
        bucket.push(item);
        grouped.set(item.chatId, bucket);
      });

      const currentChatIncoming = selectedChat ? grouped.get(selectedChat.id) : undefined;
      const shouldRevealCurrentChat = Boolean(currentChatIncoming?.length) && isNearThreadBottom(messageScrollRef.current, 120);
      if (selectedChat && shouldRevealCurrentChat) {
        queueThreadReveal(selectedChat.id);
      }

      setMessages((current) => {
        const next = { ...current };
        for (const [chatId, items] of grouped) {
          next[chatId] = mergeMessages(current[chatId] ?? [], items.map((item) => item.message));
        }
        return next;
      });

      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) => {
            const incoming = grouped.get(chat.id);
            if (!incoming?.length) return chat;
            const newest = incoming[incoming.length - 1].message;
            const unreadIncrement = chat.id === selectedChat?.id ? 0 : incoming.filter((item) => item.message.from === "other").length;
            return {
              ...chat,
              preview: newest.text,
              time: formatChatListTime(newest.createdAt),
              lastActivity: newest.createdAt,
              unread: chat.id === selectedChat?.id ? 0 : chat.unread + unreadIncrement,
            };
          })
        )
      );

      if (!selectedChat) return;
      const selectedIncoming = grouped.get(selectedChat.id);
      if (!selectedIncoming?.length) return;

      if (selectedIncoming.some((item) => item.message.from === "other")) {
        void api.markChatRead(selectedChat.id).then(() => {
          setChats((currentChats) => currentChats.map((chat) => (chat.id === selectedChat.id ? clearChatUnread(chat) : chat)));
        });
      }
    };

    window.addEventListener(CHAT_SYNC_EVENT, handleSync as EventListener);
    return () => {
      window.removeEventListener(CHAT_SYNC_EVENT, handleSync as EventListener);
    };
  }, [selectedChat]);

  useEffect(() => {
    if (!cacheScope || !chats.length) return;
    chatCache.setChatList(cacheScope, chats);
    const timer = window.setTimeout(() => {
      void chatCache.persistChatList(cacheScope, chats);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [cacheScope, chats]);

  useEffect(() => {
    if (!cacheScope || !selectedChat) return;

    const timer = window.setTimeout(() => {
      chatCache.setThread(cacheScope, selectedChat.id, {
        messages: selectedMessages,
        hasOlderMessages,
        scrollTop: messageScrollRef.current?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
      void chatCache.persistThread(cacheScope, selectedChat.id, {
        messages: selectedMessages,
        hasOlderMessages,
        scrollTop: messageScrollRef.current?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [cacheScope, hasOlderMessages, selectedChat, selectedMessages]);

  const filteredChats = chats.filter((chat) => chat.title.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!groupCreateOpen && !groupInviteOpen) return;

    const controller = new AbortController();
    if (groupCreateOpen) {
      setGroupCreateState((current) => (current === "creating" ? current : "loading-users"));
    }
    if (groupInviteOpen) {
      setGroupManageState("loading-candidates");
    }

    Promise.all([
      api.getFriends(controller.signal),
      currentUserVerified === null ? api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal) : Promise.resolve([] as UserDTO[]),
    ])
      .then(([friendRows, spaceUsers]) => {
        const verified = currentUserVerified ?? spaceUsers.find((user) => user.user_id === currentUserId)?.verified ?? false;
        setCurrentUserVerified(verified);
        setGroupFriendPool(friendRows.filter((user) => user.user_id !== currentUserId));
        setGroupCreateState((current) => (current === "creating" ? current : "idle"));
        setGroupManageState((current) => (current === "saving" ? current : "idle"));
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载群聊候选成员失败";
        setPageError(message);
        setGroupCreateState((current) => (current === "creating" ? current : "idle"));
        setGroupManageState((current) => (current === "saving" ? current : "idle"));
      });

    return () => controller.abort();
  }, [currentUserId, currentUserVerified, groupCreateOpen, groupInviteOpen]);

  useEffect(() => {
    if (!groupCreateOpen && !groupInviteOpen) {
      setGroupCandidates([]);
      return;
    }

    const baseCandidates =
      groupInviteOpen && selectedChat && selectedChat.type === "group"
        ? groupFriendPool.filter((user) => !new Set(selectedChat.detail.members.map((member) => member.userId)).has(user.user_id))
        : groupFriendPool;

    setGroupCandidates(filterUsersByName(baseCandidates, groupQuery));
  }, [groupCreateOpen, groupFriendPool, groupInviteOpen, groupQuery, selectedChat]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    const computedStyle = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth) || 0;
    const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 4 + paddingTop + paddingBottom + borderTop + borderBottom;

    element.style.height = "auto";
    element.style.height = `${Math.max(minHeight, Math.min(element.scrollHeight, maxHeight))}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setComposerHeight(Math.ceil(entry.contentRect.height));
    });

    observer.observe(element);
    setComposerHeight(Math.ceil(element.getBoundingClientRect().height));

    return () => observer.disconnect();
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;

    const updateViewport = () => {
      const nextOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(nextOffset);
    };

    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, [selectedChat]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat) return;

    const message = draft.trim();
    if (!message) return;

    const optimisticMessage = createPendingMessage(message, currentUserName);
    queueThreadReveal(selectedChat.id);

    try {
      setSendState("sending");
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] submit start", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          optimisticClientId: optimisticMessage.clientId,
          text: optimisticMessage.text,
        });
      }
      flushSync(() => {
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: sortMessages([...(current[selectedChat.id] ?? []), optimisticMessage]),
        }));
        setChats((currentChats) =>
          sortChats(
            currentChats.map((chat) =>
              chat.id === selectedChat.id ? updateChatSummary(chat, message, optimisticMessage.createdAt) : chat
            )
          )
        );
        setDraft("");
      });
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] optimistic inserted", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
        });
      }
      triggerMessageEntrance(optimisticMessage.clientId);
      stickToBottomRef.current = true;
      const created = await api.sendMessage(selectedChat.id, message);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] send success", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          serverId: deliveredMessage.id,
          serverClientId: deliveredMessage.clientId,
          text: deliveredMessage.text,
        });
      }
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], optimisticMessage.clientId, deliveredMessage),
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id ? updateChatSummary(chat, deliveredMessage.text, deliveredMessage.createdAt) : chat
          )
        )
      );
    } catch (apiError) {
      if (DEBUG_CHAT_SEND) {
        console.log("[chat] send failed", {
          chatId: selectedChat.id,
          optimisticId: optimisticMessage.id,
          error: apiError instanceof Error ? apiError.message : String(apiError),
        });
      }
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], optimisticMessage.clientId, "failed"),
      }));
    } finally {
      setSendState("idle");
    }
  };

  const retryFailedMessage = async (message: ChatMessage) => {
    if (!selectedChat || message.status !== "failed") return;

    const retryMessage: ChatMessage = {
      ...message,
      status: "pending",
      createdAt: Math.floor(Date.now() / 1000),
      time: formatTime(Math.floor(Date.now() / 1000)),
    };

    setMessages((current) => ({
      ...current,
      [selectedChat.id]: (current[selectedChat.id] ?? []).map((item) => (item.id === message.id ? retryMessage : item)),
    }));
    stickToBottomRef.current = true;
    triggerMessageEntrance(retryMessage.clientId);

    try {
      const created = await api.sendMessage(selectedChat.id, retryMessage.text);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: confirmPendingMessage(current[selectedChat.id] ?? [], retryMessage.clientId, deliveredMessage),
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id
              ? {
                  ...chat,
                  preview: deliveredMessage.text,
                  time: "刚刚",
                  lastActivity: deliveredMessage.createdAt,
                  unread: 0,
                }
              : chat
          )
        )
      );
    } catch {
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: updateMessageStatus(current[selectedChat.id] ?? [], retryMessage.clientId, "failed"),
      }));
    }
  };

  const refreshChats = async () => {
    const rows = await api.getChats();
    setChats(sortChats(rows.map((item) => mapChat(item, currentUserId))));
  };

  const copyMessageText = async () => {
    if (!messageMenu) return;
    try {
      await navigator.clipboard.writeText(messageMenu.message.text);
      setMessageMenu(null);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "复制失败";
      setPageError(message);
    }
  };

  const deleteMessage = async () => {
    if (!selectedChat || !messageMenu || typeof messageMenu.message.id !== "number") return;

    try {
      setMessageDeleteState("deleting");
      await api.deleteMessage(messageMenu.message.id);
      const nextThreadMessages = (selectedMessages ?? []).filter((message) => message.clientId !== messageMenu.message.clientId);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: nextThreadMessages,
      }));
      if (cacheScope) {
        const nextSnapshot = {
          messages: nextThreadMessages,
          hasOlderMessages,
          scrollTop: messageScrollRef.current?.scrollTop ?? 0,
          updatedAt: Date.now(),
        };
        chatCache.setThread(cacheScope, selectedChat.id, nextSnapshot);
        void chatCache.persistThread(cacheScope, selectedChat.id, nextSnapshot);
      }
      setMessageMenu(null);
      await refreshChats();
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "删除消息失败";
      setPageError(message);
    } finally {
      setMessageDeleteState("idle");
    }
  };

  const toggleGroupCandidate = (userId: number) => {
    setGroupSelectedIds((current) => (current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]));
  };

  const createGroup = async () => {
    if (!currentUserVerified) {
      setPageError("完成认证后才可以创建群聊。");
      return;
    }
    if (!groupSelectedIds.length) {
      setPageError("请至少选择一位成员。");
      return;
    }

    try {
      setGroupCreateState("creating");
      const created = await api.createGroupChat(groupSelectedIds, groupTitle.trim() || undefined);
      const nextChat = mapChat(created, currentUserId);
      setChats((currentChats) => sortChats([nextChat, ...currentChats.filter((chat) => chat.id !== nextChat.id)]));
      setGroupCreateOpen(false);
      setGroupTitle("");
      setGroupQuery("");
      setGroupSelectedIds([]);
      navigate(`/app/chats/${created.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "创建群聊失败";
      setPageError(message);
      setGroupCreateState("idle");
    }
  };

  const applyUpdatedGroupChat = (chatRow: ChatDTO) => {
    const nextChat = mapChat(chatRow, currentUserId);
    setChats((currentChats) => sortChats(currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat))));
  };

  const renameGroup = async () => {
    if (!selectedChat) return;
    try {
      setGroupManageState("saving");
      const updated = await api.renameGroupChat(selectedChat.id, groupRenameValue.trim());
      applyUpdatedGroupChat(updated);
      setGroupRenameOpen(false);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "重命名群聊失败";
      setPageError(message);
    } finally {
      setGroupManageState("idle");
    }
  };

  const inviteMembersToGroup = async () => {
    if (!currentUserVerified) {
      setPageError("完成认证后才可以邀请成员。");
      return;
    }
    if (!selectedChat || !groupSelectedIds.length) return;
    try {
      setGroupManageState("saving");
      const updated = await api.addGroupMembers(selectedChat.id, groupSelectedIds);
      applyUpdatedGroupChat(updated);
      setGroupSelectedIds([]);
      setGroupQuery("");
      setGroupInviteOpen(false);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "邀请成员失败";
      setPageError(message);
    } finally {
      setGroupManageState("idle");
    }
  };

  const removeGroupMember = async (userId: number) => {
    if (!selectedChat) return;
    try {
      setGroupManageState("saving");
      const updated = await api.removeGroupMembers(selectedChat.id, [userId]);
      applyUpdatedGroupChat(updated);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "移除成员失败";
      setPageError(message);
    } finally {
      setGroupManageState("idle");
    }
  };

  const leaveOrDeleteGroup = async () => {
    if (!selectedChat || selectedChat.type !== "group") return;
    try {
      setGroupManageState("saving");
      if (selectedChat.isOwner) {
        await api.deleteGroupChat(selectedChat.id);
      } else {
        await api.leaveGroupChat(selectedChat.id);
      }
      setChats((currentChats) => currentChats.filter((chat) => chat.id !== selectedChat.id));
      setDetailsSheetOpen(false);
      navigate("/app/chats");
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : selectedChat.isOwner ? "解散群聊失败" : "退出群聊失败";
      setPageError(message);
    } finally {
      setGroupManageState("idle");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedChat || !selectedMessages.length || olderState === "loading" || !cacheScope) return;

    const oldestMessage = selectedMessages[0];
    const scroller = messageScrollRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;

    try {
      setOlderState("loading");
      const rows = await api.getMessages({
        chat_id: selectedChat.id,
        limit: 30,
        before: Number(oldestMessage.id),
      });
      const normalized = sortMessages(rows.map((row) => mapChatMessage(row, currentUserId)));

      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(normalized, current[selectedChat.id] ?? []),
      }));
      const mergedMessages = mergeMessages(normalized, selectedMessages);
      setHasOlderMessages(rows.length >= 30);
      chatCache.setThread(cacheScope, selectedChat.id, {
        messages: mergedMessages,
        hasOlderMessages: rows.length >= 30,
        scrollTop: scroller?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });
      void chatCache.persistThread(cacheScope, selectedChat.id, {
        messages: mergedMessages,
        hasOlderMessages: rows.length >= 30,
        scrollTop: scroller?.scrollTop ?? 0,
        updatedAt: Date.now(),
      });

      requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        const nextHeight = element.scrollHeight;
        element.scrollTop = nextHeight - previousHeight + element.scrollTop;
      });
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "加载历史消息失败";
      setPageError(message);
    } finally {
      setOlderState("idle");
    }
  };

  const renderChatItem = (chat: Chat, active: boolean) => (
    <button
      key={chat.id}
      className={`chat-item ${active ? "active" : ""}`}
      onClick={() => navigate(`/app/chats/${chat.id}`)}
      type="button"
    >
      <div className="avatar-wrap">
        <UserAvatar className={`avatar ${chat.online ? "status-online" : ""}`} name={chat.title} uri={chat.avatarUri} />
      </div>
      <div style={{ textAlign: "left" }}>
        <p className="chat-name">{chat.title}</p>
        <div className="chat-preview">{chat.preview}</div>
      </div>
      <div>
        <div className="chat-time">{chat.time}</div>
        {chat.unread ? <span className="small-badge">{chat.unread > 99 ? "99+" : chat.unread}</span> : null}
      </div>
    </button>
  );

  const renderChatList = (variant: "desktop" | "mobile") => (
    <>
      <div className={variant === "desktop" ? "sidebar-header minimal-page-header" : "chat-list-screen-header minimal-page-header"}>
        <div className="page-toolbar">
          <h2 className="panel-title">聊天</h2>
          <button className="icon-button" onClick={() => setGroupCreateOpen(true)} type="button">
            <span className="material-symbols-outlined">group_add</span>
          </button>
        </div>
        <label className="search-box">
          <span className="material-symbols-outlined">search</span>
          <input
            className="input"
            style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
            placeholder="搜索会话名 / 用户名"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className={variant === "desktop" ? "sidebar-scroll" : "chat-list-screen-body"}>
        {viewState === "loading" ? <FeedbackState title="会话加载中" description="正在同步你最近的聊天。" tone="loading" /> : null}
        <div className="chat-list">
          {filteredChats.map((chat) => renderChatItem(chat, chat.id === selectedChat?.id))}
        </div>
        {!filteredChats.length && viewState === "ready" ? (
          <FeedbackState
            title={query.trim() ? "没有匹配的会话" : "还没有会话"}
            description={query.trim() ? "换个关键词试试，或者从广场发起新的聊天。" : "先从广场里找到一个人，再开始第一段对话。"}
            action={
              <Link className="button" to="/app/square">
                去广场
              </Link>
            }
          />
        ) : null}
      </div>
    </>
  );

  const chatLayoutStyle = selectedChat
    ? ({
        "--chat-keyboard-offset": `${keyboardOffset}px`,
        "--chat-composer-height": `${composerHeight}px`,
      } as CSSProperties)
    : undefined;

  return (
    <AppChrome
      title="聊天"
      hideTopbar={!selectedChat}
      hideMobileNav={Boolean(selectedChat)}
      hidePageTitle={Boolean(selectedChat)}
      topbarClassName={selectedChat ? "conversation-topbar" : undefined}
      topbarLeading={
        selectedChat ? (
          <div className="chat-conversation-topbar">
            <button className="chat-back-button" onClick={() => navigate("/app/chats")} type="button">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="avatar-wrap">
              <UserAvatar
                className={`avatar ${selectedChat.online ? "status-online" : ""}`}
                name={selectedChat.title}
                uri={selectedChat.avatarUri}
              />
            </div>
            <div className="chat-topbar-meta">
              <strong className="chat-topbar-name">{selectedChat.title}</strong>
              <div className="chat-topbar-status">{selectedChat.type === "group" ? `${selectedChat.members} 人` : selectedChat.subtitle}</div>
            </div>
          </div>
        ) : undefined
      }
      topbarAction={
        selectedChat ? (
          <div className="button-row message-actions">
            <button className="icon-button desktop-only-action" type="button">
              <span className="material-symbols-outlined">{selectedChat.type === "group" ? "group_add" : "videocam"}</span>
            </button>
            <button className="icon-button" onClick={() => setDetailsSheetOpen(true)} type="button">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <section className={`app-layout chat-mobile-layout ${selectedChat ? "chat-detail-active" : "chat-list-active"}`} style={chatLayoutStyle}>
        <aside className="desktop-pane list-screen desktop-chat-list">{renderChatList("desktop")}</aside>

        <section className={`list-screen mobile-chat-list-screen ${selectedChat ? "is-background" : "is-active"}`}>{renderChatList("mobile")}</section>

        <section className={`message-pane chat-main-pane ${selectedChat ? "is-open" : "desktop-pane is-closed"}`}>
          {selectedChat ? (
            <>
              <div
                ref={messageScrollRef}
                className="message-scroll"
                onScroll={() => {
                  const element = messageScrollRef.current;
                  stickToBottomRef.current = isNearThreadBottom(element);
                  if (!cacheScope || !selectedChat) return;
                  chatCache.updateThreadScroll(cacheScope, selectedChat.id, element?.scrollTop ?? 0);
                }}
              >
                {hasOlderMessages ? (
                  <div className="message-history-actions">
                    <button className="ghost-button" disabled={olderState === "loading"} onClick={() => void loadOlderMessages()} type="button">
                      {olderState === "loading" ? "加载中..." : "查看更多消息"}
                    </button>
                  </div>
                ) : null}
                {messageGroups.map((group) => (
                  <MessageGroupBlock
                    enteringMessageIds={enteringMessageIds}
                    group={group}
                    key={group.key}
                    onOpenActions={openMessageMenu}
                    onRetry={retryFailedMessage}
                  />
                ))}
              </div>

              <form ref={composerRef} className="composer" onSubmit={submit}>
                <div className="composer-row">
                  <button className="composer-plus" type="button">
                    <span className="material-symbols-outlined">add_circle</span>
                  </button>
                  <div className="composer-input-wrap">
                    <textarea
                      ref={textareaRef}
                      className="textarea composer-input"
                      placeholder="输入消息..."
                      value={draft}
                      rows={1}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                  </div>
                  <button className="composer-send" disabled={!draft.trim() || sendState === "sending"} type="submit">
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <FeedbackState
              title="先选一个会话"
              description="左侧按最后聊天时间排列。点进一段对话后，这里才会展开具体消息。"
              action={
                <Link className="button" to="/app/square">
                  去广场
                </Link>
              }
            />
          )}
        </section>

        <aside className="panel desktop-pane">
          {selectedChat ? (
            <>
              <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <p className="eyebrow">Details</p>
                <h3 className="panel-title">{selectedChat.type === "direct" ? "会话资料" : "群聊资料"}</h3>
                <p className="card-subtitle">{selectedChat.detail.summary}</p>
              </div>

              <div className="panel-scroll" style={{ paddingTop: 18 }}>
                <div className="detail-list">
                  <div className="detail-card">
                    {selectedChat.type === "direct" ? (
                      <div className="request-profile" style={{ marginBottom: 14 }}>
                        <UserAvatar
                          className={`mini-avatar ${selectedChat.online ? "status-online" : ""}`}
                          name={selectedChat.title}
                          uri={selectedChat.avatarUri}
                        />
                        <div>
                          <strong>{selectedChat.title}</strong>
                          <div className="meta-row">
                            {selectedChat.verified ? <span className="verified-badge">Verified</span> : null}
                            <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="detail-row">
                      <div>
                        <strong>{selectedChat.type === "direct" ? "当前状态" : "你的身份"}</strong>
                        <div className="detail-text">{selectedChat.detail.relation}</div>
                      </div>
                      {selectedChat.type === "direct" ? (
                        <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                      ) : (
                        <span className="count-badge">{selectedChat.members} 人</span>
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>{selectedChat.type === "direct" ? "会话成员" : "群成员"}</strong>
                    <div className="member-list">
                      {selectedChat.detail.members.map((member) => (
                        <div key={member.userId} className="member-line">
                          <div className="member-line-main">
                            <UserAvatar className="mini-avatar" name={member.name} uri={member.avatarUri} />
                            <span>{member.name}</span>
                          </div>
                          {member.isSelf ? <span className="count-badge">你</span> : null}
                          {selectedChat.type === "group" && selectedChat.isOwner && !member.isSelf ? (
                            <button className="ghost-button member-line-action" onClick={() => void removeGroupMember(member.userId)} type="button">
                              移除
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>快捷操作</strong>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      {selectedChat.type === "group" ? (
                        <>
                          {selectedChat.isOwner ? (
                            <>
                              <button
                                className="ghost-button"
                                onClick={() => {
                                  setGroupRenameValue(selectedChat.title);
                                  setGroupRenameOpen(true);
                                }}
                                type="button"
                              >
                                重命名群聊
                              </button>
                              <button className="ghost-button" onClick={() => setGroupInviteOpen(true)} type="button">
                                邀请成员
                              </button>
                            </>
                          ) : null}
                          <button className="danger-button" onClick={() => void leaveOrDeleteGroup()} type="button">
                            {selectedChat.isOwner ? "解散群聊" : "退出群聊"}
                          </button>
                        </>
                      ) : (
                        selectedChat.detail.actions.map((action) => (
                          <button key={action} className="ghost-button" type="button">
                            {action}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <FeedbackState title="选择一个会话" description="左侧选中一段聊天后，这里会显示资料和常用动作。" />
          )}
        </aside>
      </section>

      <BottomSheet
        open={groupCreateOpen}
        title="新建群聊"
        description="先选成员，再决定要不要写群名。"
        onClose={() => {
          if (groupCreateState === "creating") return;
          setGroupCreateOpen(false);
        }}
      >
        <div className="simple-form">
          <label className="field-label">群聊名称</label>
          <input className="input" placeholder="例如：产品讨论组" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
          <label className="field-label">选择成员</label>
          <div className="row-subtle">仅认证用户可创建群聊，且只能邀请自己的好友。</div>
          {currentUserVerified === false ? (
            <FeedbackState title="完成认证后再创建群聊" description="群聊发起人需要先完成认证。" />
          ) : (
            <>
              <input className="input" placeholder="搜索好友" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
              <div className="row-subtle">已选择 {groupSelectedIds.length} 人</div>
              <div className="simple-list">
                {groupCandidates.map((user) => {
                  const selected = groupSelectedIds.includes(user.user_id);
                  return (
                    <button key={`group-user-${user.user_id}`} className="simple-row person-row" onClick={() => toggleGroupCandidate(user.user_id)} type="button">
                      <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                      <div className="row-main">
                        <strong>{user.name}</strong>
                        <div className="row-subtle">{user.is_alive ? "在线" : "离线"}</div>
                      </div>
                      {selected ? <span className="small-badge">已选</span> : <span className="count-badge">选择</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="button-row">
            <button className="ghost-button" onClick={() => setGroupCreateOpen(false)} type="button">
              取消
            </button>
            <button className="button" disabled={groupCreateState === "creating" || currentUserVerified === false} onClick={() => void createGroup()} type="button">
              {groupCreateState === "creating" ? "创建中..." : "创建群聊"}
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={detailsSheetOpen}
        title={selectedChat?.type === "direct" ? "会话资料" : "群聊资料"}
        description="把资料和动作放进独立抽屉，避免挤占聊天主屏。"
        onClose={() => setDetailsSheetOpen(false)}
      >
        {selectedChat ? (
          <div className="detail-list">
            <div className="detail-card">
              {selectedChat.type === "direct" ? (
                <div className="request-profile" style={{ marginBottom: 14 }}>
                  <UserAvatar
                    className={`mini-avatar ${selectedChat.online ? "status-online" : ""}`}
                    name={selectedChat.title}
                    uri={selectedChat.avatarUri}
                  />
                  <div>
                    <strong>{selectedChat.title}</strong>
                    <div className="meta-row">
                      {selectedChat.verified ? <span className="verified-badge">Verified</span> : null}
                      <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="detail-row">
                <div>
                  <strong>{selectedChat.type === "direct" ? "当前状态" : "你的身份"}</strong>
                  <div className="detail-text">{selectedChat.detail.relation}</div>
                </div>
                {selectedChat.type === "direct" ? (
                  <span className={selectedChat.online ? "presence-badge" : "count-badge"}>{selectedChat.subtitle}</span>
                ) : (
                  <span className="count-badge">{selectedChat.members} 人</span>
                )}
              </div>
            </div>

            <div className="detail-card">
              <strong>{selectedChat.type === "direct" ? "会话成员" : "群成员"}</strong>
              <div className="member-list">
                {selectedChat.detail.members.map((member) => (
                  <div key={`sheet-member-${member.userId}`} className="member-line">
                    <div className="member-line-main">
                      <UserAvatar className="mini-avatar" name={member.name} uri={member.avatarUri} />
                      <span>{member.name}</span>
                    </div>
                    {member.isSelf ? <span className="count-badge">你</span> : null}
                    {selectedChat.type === "group" && selectedChat.isOwner && !member.isSelf ? (
                      <button className="ghost-button member-line-action" onClick={() => void removeGroupMember(member.userId)} type="button">
                        移除
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-card">
              <strong>快捷操作</strong>
              <div className="settings-actions" style={{ marginTop: 12 }}>
                {selectedChat.type === "group" ? (
                  <>
                    {selectedChat.isOwner ? (
                      <>
                        <button
                          className="ghost-button"
                          onClick={() => {
                            setDetailsSheetOpen(false);
                            setGroupRenameValue(selectedChat.title);
                            setGroupRenameOpen(true);
                          }}
                          type="button"
                        >
                          重命名群聊
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => {
                            setDetailsSheetOpen(false);
                            setGroupInviteOpen(true);
                          }}
                          type="button"
                        >
                          邀请成员
                        </button>
                      </>
                    ) : null}
                    <button className="danger-button" onClick={() => void leaveOrDeleteGroup()} type="button">
                      {selectedChat.isOwner ? "解散群聊" : "退出群聊"}
                    </button>
                  </>
                ) : (
                  selectedChat.detail.actions.map((action) => (
                    <button key={`sheet-action-${action}`} className="ghost-button" type="button">
                      {action}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <BottomSheet
        open={groupRenameOpen}
        title="重命名群聊"
        description="只会更新当前群聊名称。"
        onClose={() => setGroupRenameOpen(false)}
      >
        <div className="simple-form">
          <label className="field-label">群聊名称</label>
          <input className="input" value={groupRenameValue} onChange={(event) => setGroupRenameValue(event.target.value)} />
          <div className="button-row">
            <button className="ghost-button" onClick={() => setGroupRenameOpen(false)} type="button">
              取消
            </button>
            <button className="button" disabled={groupManageState === "saving"} onClick={() => void renameGroup()} type="button">
              {groupManageState === "saving" ? "保存中..." : "保存名称"}
            </button>
          </div>
        </div>
      </BottomSheet>
      <BottomSheet
        open={groupInviteOpen}
        title="邀请成员"
        description="选择还没加入这个群的人。"
        onClose={() => setGroupInviteOpen(false)}
      >
        <div className="simple-form">
          <div className="row-subtle">只能邀请自己的好友加入群聊。</div>
          {currentUserVerified === false ? (
            <FeedbackState title="完成认证后再邀请成员" description="群聊邀请人需要先完成认证。" />
          ) : (
            <>
              <label className="field-label">搜索好友</label>
              <input className="input" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
              <div className="row-subtle">已选择 {groupSelectedIds.length} 人</div>
              <div className="simple-list">
                {groupCandidates.map((user) => {
                  const selected = groupSelectedIds.includes(user.user_id);
                  return (
                    <button key={`invite-user-${user.user_id}`} className="simple-row person-row" onClick={() => toggleGroupCandidate(user.user_id)} type="button">
                      <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                      <div className="row-main">
                        <strong>{user.name}</strong>
                        <div className="row-subtle">{user.is_alive ? "在线" : "离线"}</div>
                      </div>
                      {selected ? <span className="small-badge">已选</span> : <span className="count-badge">选择</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="button-row">
            <button className="ghost-button" onClick={() => setGroupInviteOpen(false)} type="button">
              取消
            </button>
            <button className="button" disabled={groupManageState === "saving" || currentUserVerified === false} onClick={() => void inviteMembersToGroup()} type="button">
              {groupManageState === "saving" ? "邀请中..." : "发出邀请"}
            </button>
          </div>
        </div>
      </BottomSheet>
      {messageMenu ? (
        <div className="message-context-layer" onClick={closeMessageMenu} role="presentation">
          <div
            className={`message-context-menu ${messageMenu.placement === "bottom" ? "below" : "above"} ${messageMenu.confirmDelete ? "confirming" : ""}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              left: messageMenu.anchorX,
              top: messageMenu.anchorY,
            }}
          >
            {messageMenu.confirmDelete ? (
              <>
                <div className="message-context-title">删除这条消息？</div>
                <div className="message-context-actions is-confirm">
                  <button
                    className="message-context-button"
                    disabled={messageDeleteState === "deleting"}
                    onClick={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: false } : current))}
                    type="button"
                  >
                    取消
                  </button>
                  <button className="message-context-button danger" disabled={messageDeleteState === "deleting"} onClick={() => void deleteMessage()} type="button">
                    {messageDeleteState === "deleting" ? "删除中..." : "确认删除"}
                  </button>
                </div>
              </>
            ) : (
              <div className={`message-context-actions ${messageMenu.message.from === "self" && typeof messageMenu.message.id === "number" ? "" : "is-single"}`}>
                <button className="message-context-button" onClick={() => void copyMessageText()} type="button">
                  复制
                </button>
                {messageMenu.message.from === "self" && typeof messageMenu.message.id === "number" ? (
                  <button
                    className="message-context-button danger"
                    onClick={() => setMessageMenu((current) => (current ? { ...current, confirmDelete: true } : current))}
                    type="button"
                  >
                    删除
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <AsyncErrorDialog message={pageError ?? ""} onClose={() => setPageError(null)} open={Boolean(pageError)} />
    </AppChrome>
  );
}
