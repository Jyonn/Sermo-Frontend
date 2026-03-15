import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatRelativeTime } from "../lib/presentation";
import type { AppViewState, Chat, ChatDTO, ChatMessage, ChatMessageDTO, UserDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    from: message.user.user_id === currentUserId ? "self" : "other",
    name: message.user.name,
    time: formatTime(message.created_at),
    createdAt: message.created_at,
    text: message.content,
  };
}

function shouldGroupMessages(current: ChatMessage, neighbor?: ChatMessage) {
  if (!neighbor) return false;
  return current.from === neighbor.from && Math.abs(current.createdAt - neighbor.createdAt) < 5 * 60;
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

export default function ChatsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending">("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(80);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const currentUserId = session?.user.user_id ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    api
      .getChats(controller.signal)
      .then((rows) => {
        const nextChats = sortChats(rows.map((item) => mapChat(item, currentUserId)));
        setChats(nextChats);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载会话失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [currentUserId]);

  const selectedChat = useMemo(() => {
    const numericChatId = Number(chatId);
    if (!numericChatId) return null;
    return chats.find((chat) => chat.id === numericChatId) ?? null;
  }, [chatId, chats]);

  useEffect(() => {
    if (!selectedChat) return;
    const controller = new AbortController();

    const loadMessages = async () => {
      try {
        const rows = await api.getMessages(
          {
            chat_id: selectedChat.id,
            limit: 30,
          },
          controller.signal
        );
        setMessages((current) => ({
          ...current,
          [selectedChat.id]: rows.map((row) => mapChatMessage(row, currentUserId)),
        }));
        void api.markChatRead(selectedChat.id);
      } catch (apiError) {
        if (!controller.signal.aborted) {
          const message = apiError instanceof ApiError ? apiError.message : "加载消息失败";
          setError(message);
        }
      }
    };

    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 3_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [currentUserId, selectedChat]);

  const filteredChats = chats.filter((chat) => chat.title.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedMessages = selectedChat ? messages[selectedChat.id] ?? [] : [];

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

    try {
      setSendState("sending");
      const created = await api.sendMessage(selectedChat.id, message);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: [...(current[selectedChat.id] ?? []), mapChatMessage(created, currentUserId)],
      }));
      setChats((currentChats) =>
        sortChats(
          currentChats.map((chat) =>
            chat.id === selectedChat.id
              ? {
                  ...chat,
                  preview: message,
                  time: "刚刚",
                  lastActivity: created.created_at,
                  unread: 0,
                }
              : chat
          )
        )
      );
      setDraft("");
    } catch (apiError) {
      const messageText = apiError instanceof ApiError ? apiError.message : "发送消息失败";
      setError(messageText);
    } finally {
      setSendState("idle");
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
        <div className="title-row">
          <p className="chat-name">{chat.title}</p>
          {chat.verified ? <span className="verified-badge">Verified</span> : null}
        </div>
        <div className="meta-row">
          {chat.type === "group" ? <span className="count-badge">{chat.members} 人</span> : null}
          {chat.online ? <span className="presence-badge">在线</span> : null}
        </div>
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
      mobileNav="chats"
      hideTopbar={!selectedChat}
      hideMobileNav={Boolean(selectedChat)}
      hideSessionAction={Boolean(selectedChat)}
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
        ) : (
          <Link className="ghost-chip" to="/app/square">
            广场
          </Link>
        )
      }
    >
      <section className={`app-layout chat-mobile-layout ${selectedChat ? "chat-detail-active" : "chat-list-active"}`} style={chatLayoutStyle}>
        <aside className="desktop-pane list-screen desktop-chat-list">{renderChatList("desktop")}</aside>

        {!selectedChat ? <section className="list-screen mobile-chat-list-screen">{renderChatList("mobile")}</section> : null}

        <section className={`message-pane chat-main-pane ${selectedChat ? "" : "desktop-pane"}`}>
          {selectedChat ? (
            <>
              <div className="message-scroll">
                <div className="day-divider">今天</div>
                {selectedMessages.map((message, index) => {
                  const previous = selectedMessages[index - 1];
                  const next = selectedMessages[index + 1];
                  const groupedWithPrevious = shouldGroupMessages(message, previous);
                  const groupedWithNext = shouldGroupMessages(message, next);

                  return (
                  <div
                    key={String(message.id)}
                    className={`message-group ${message.from === "self" ? "self" : ""} ${groupedWithPrevious ? "stacked" : ""}`}
                  >
                    {message.from === "other" && !groupedWithPrevious ? (
                      <div className="avatar" style={{ width: 36, height: 36, borderRadius: 12, fontSize: ".78rem" }}>
                        {avatarLabel(message.name)}
                      </div>
                    ) : message.from === "other" ? <div className="message-spacer" /> : null}
                    <div className="message-bubbles">
                      <div className={`message-bubble ${message.from === "self" ? "self" : "other"}`}>{message.text}</div>
                      {!groupedWithNext ? (
                        <div className="message-meta">
                          <span>{message.time}</span>
                          {message.from === "self" ? (
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--brand-primary)" }}>
                              done_all
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )})}
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
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
