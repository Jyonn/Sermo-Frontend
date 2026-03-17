import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
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

function updateChatSummary(chat: Chat, preview: string, lastActivity: number) {
  return {
    ...chat,
    preview,
    time: "刚刚",
    lastActivity,
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

interface MessageGroup {
  key: string;
  from: "self" | "other";
  name: string;
  dividerLabel?: string;
  messages: ChatMessage[];
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || "未命名会话";
  const presence = formatPresence(peer);

  return {
    id: chat.chat_id,
    title,
    subtitle: chat.group ? `${chat.members.length} 人` : presence,
    preview: chat.last_message?.content || "暂无消息",
    time: formatChatListTime(chat.last_chat_at),
    lastActivity: chat.last_chat_at,
    unread: chat.unread_count ?? 0,
    online: chat.group ? false : Boolean(peer?.is_alive),
    verified: Boolean(peer?.verified),
    members: chat.members.length,
    type: chat.group ? "group" : "direct",
    detail: {
      summary: chat.group ? "围绕同一主题的讨论会集中在这里。" : "先聊两句，再决定要不要进一步建立关系。",
      relation: chat.group ? (chat.owner?.user_id === currentUserId ? "你是群主" : "你已加入该群聊") : "一对一会话",
      actions: chat.group ? ["邀请成员", "退出群聊"] : ["发起好友申请", "静音通知"],
      members: chat.members.map((member) => member.name),
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

function isNearThreadBottom(element: HTMLDivElement | null, threshold = 72) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [pageError, setPageError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending">("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderState, setOlderState] = useState<"idle" | "loading">("idle");
  const [enteringMessageIds, setEnteringMessageIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDoneRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
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
        lastGroup.key = `${String(lastGroup.messages[0]?.id)}-${String(message.id)}`;
        return;
      }

      groups.push({
        key: `${String(message.id)}`,
        from: message.from,
        name: message.name,
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
        void api.markChatRead(selectedChat.id);
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
    if (!stickToBottomRef.current) return;

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
    const handleSync = (event: Event) => {
      const detail = (event as CustomEvent<ChatSyncEventDetail>).detail;
      if (!detail?.items.length) return;

      const grouped = new Map<number, ChatSyncEventDetail["items"]>();
      detail.items.forEach((item) => {
        const bucket = grouped.get(item.chatId) ?? [];
        bucket.push(item);
        grouped.set(item.chatId, bucket);
      });

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
        void api.markChatRead(selectedChat.id);
      }
      requestAnimationFrame(() => {
        const element = messageScrollRef.current;
        if (!element) return;
        const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        if (nearBottom) element.scrollTop = element.scrollHeight;
      });
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
      triggerMessageEntrance(optimisticMessage.id);
      stickToBottomRef.current = true;
      scrollThreadToBottom(messageScrollRef.current);
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
      triggerMessageEntrance(deliveredMessage.id);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(
          (current[selectedChat.id] ?? []).filter((item) => item.id !== optimisticMessage.id),
          [deliveredMessage]
        ),
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
        [selectedChat.id]: (current[selectedChat.id] ?? []).map((item) =>
          item.id === optimisticMessage.id
            ? {
                ...item,
                status: "failed",
              }
            : item
        ),
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
    triggerMessageEntrance(retryMessage.id);
    stickToBottomRef.current = true;
    scrollThreadToBottom(messageScrollRef.current);

    try {
      const created = await api.sendMessage(selectedChat.id, retryMessage.text);
      const deliveredMessage = mapChatMessage(created, currentUserId);
      triggerMessageEntrance(deliveredMessage.id);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: mergeMessages(
          (current[selectedChat.id] ?? []).filter((item) => item.id !== retryMessage.id),
          [deliveredMessage]
        ),
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
        [selectedChat.id]: (current[selectedChat.id] ?? []).map((item) =>
          item.id === retryMessage.id
            ? {
                ...item,
                status: "failed",
              }
            : item
        ),
      }));
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
        <div className={`avatar ${chat.online ? "status-online" : ""}`}>{avatarLabel(chat.title)}</div>
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
        <h2 className="panel-title">聊天</h2>
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
              <div className={`avatar ${selectedChat.online ? "status-online" : ""}`}>{avatarLabel(selectedChat.title)}</div>
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

        {!selectedChat ? <section className="list-screen mobile-chat-list-screen">{renderChatList("mobile")}</section> : null}

        <section className={`message-pane chat-main-pane ${selectedChat ? "" : "desktop-pane"}`}>
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
                  <div key={group.key}>
                    {group.dividerLabel ? <div className="day-divider">{group.dividerLabel}</div> : null}
                    <div className={`message-group ${group.from}`}>
                      {group.from === "other" ? <div className="avatar message-avatar">{avatarLabel(group.name)}</div> : null}
                      <div className="message-bubbles">
                        {group.messages.map((message, index) => {
                          const isFirst = index === 0;
                          const isLast = index === group.messages.length - 1;
                          const isEntering = enteringMessageIds.includes(String(message.id));
                          const showRetry = group.from === "self" && message.status === "failed";

                          return (
                            <div
                              key={String(message.id)}
                              className={`message-bubble-wrap ${group.from} ${message.status !== "sent" ? `is-${message.status}` : "is-sent"} ${isEntering ? "is-entering" : ""}`}
                            >
                              <div className={`message-bubble-shell ${group.from}`}>
                                {showRetry ? (
                                  <button
                                    aria-label="重试发送"
                                    className="message-retry-icon"
                                    onClick={() => void retryFailedMessage(message)}
                                    type="button"
                                  >
                                    <span className="material-symbols-outlined">refresh</span>
                                  </button>
                                ) : null}
                                <div
                                  className={[
                                    "message-bubble",
                                    group.from === "self" ? "self" : "other",
                                    message.status !== "sent" ? `is-${message.status}` : "",
                                    isFirst ? "group-start" : "",
                                    isLast ? "group-end" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {message.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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
                        <div className={`mini-avatar ${selectedChat.online ? "status-online" : ""}`}>{avatarLabel(selectedChat.title)}</div>
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
                        <div key={member} className="member-line">
                          <span>{member}</span>
                          {member === session?.user.name ? <span className="count-badge">你</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>快捷操作</strong>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      {selectedChat.detail.actions.map((action, index) => (
                        <button
                          key={action}
                          className={selectedChat.type === "group" && index === selectedChat.detail.actions.length - 1 ? "danger-button" : "ghost-button"}
                          type="button"
                        >
                          {action}
                        </button>
                      ))}
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
                  <div className={`mini-avatar ${selectedChat.online ? "status-online" : ""}`}>{avatarLabel(selectedChat.title)}</div>
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
                  <div key={`sheet-member-${member}`} className="member-line">
                    <span>{member}</span>
                    {member === session?.user.name ? <span className="count-badge">你</span> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-card">
              <strong>快捷操作</strong>
              <div className="settings-actions" style={{ marginTop: 12 }}>
                {selectedChat.detail.actions.map((action, index) => (
                  <button
                    key={`sheet-action-${action}`}
                    className={selectedChat.type === "group" && index === selectedChat.detail.actions.length - 1 ? "danger-button" : "ghost-button"}
                    type="button"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={pageError ?? ""} onClose={() => setPageError(null)} open={Boolean(pageError)} />
    </AppChrome>
  );
}
