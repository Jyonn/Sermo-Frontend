import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AppViewState, Chat, ChatDTO, ChatMessage, ChatMessageDTO } from "../types";

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
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return formatTime(value);
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function mapChatMessage(message: ChatMessageDTO, currentUserId: number): ChatMessage {
  return {
    id: message.message_id,
    from: message.user.user_id === currentUserId ? "self" : "other",
    name: message.user.name,
    time: formatTime(message.created_at),
    text: message.content,
  };
}

function getDirectPeer(chat: ChatDTO, currentUserId: number) {
  return chat.members.find((member) => member.user_id !== currentUserId) ?? chat.members[0] ?? null;
}

function mapChat(chat: ChatDTO, currentUserId: number): Chat {
  const peer = chat.group ? null : getDirectPeer(chat, currentUserId);
  const title = chat.title || peer?.name || "未命名会话";

  return {
    id: chat.chat_id,
    title,
    subtitle: chat.group
      ? `群聊 · ${chat.members.length} 人`
      : `${peer?.verified ? "私聊 · 已验证" : "私聊 · Basic"}`,
    preview: chat.last_message?.content || "暂无消息",
    time: formatChatListTime(chat.last_chat_at),
    unread: chat.unread_count ?? 0,
    online: chat.group ? false : Boolean(peer?.is_alive),
    members: chat.members.length,
    type: chat.group ? "group" : "direct",
    detail: {
      summary: chat.group
        ? `${chat.owner?.name ?? "Owner"} 创建了这个群聊。`
        : `${peer?.name ?? "对方"} 当前 ${peer?.is_alive ? "在线" : "离线"}，状态来自 heartbeat。`,
      relation: chat.group ? (chat.owner?.user_id === currentUserId ? "群主" : "成员") : "私聊中",
      actions: chat.group ? ["邀请成员", "查看成员", "退出群聊"] : ["发起语音评审", "查看资料", "删除好友关系"],
    },
    messages: [],
  };
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const currentUserId = session?.user.user_id ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    api
      .getChats(controller.signal)
      .then((rows) => {
        const nextChats = rows.map((item) => mapChat(item, currentUserId));
        setChats(nextChats);
        setViewState("ready");

        const numericChatId = Number(chatId);
        if (!numericChatId && nextChats[0]) {
          navigate(`/app/chats/${nextChats[0].id}`, { replace: true });
        }
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载会话失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [currentUserId, navigate]);

  const selectedChat = useMemo(() => {
    const numericChatId = Number(chatId);
    return chats.find((chat) => chat.id === numericChatId) ?? chats[0] ?? null;
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat) return;

    const message = draft.trim();
    if (!message) return;

    try {
      const created = await api.sendMessage(selectedChat.id, message);
      setMessages((current) => ({
        ...current,
        [selectedChat.id]: [...(current[selectedChat.id] ?? []), mapChatMessage(created, currentUserId)],
      }));
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === selectedChat.id
            ? {
                ...chat,
                preview: message,
                time: "刚刚",
                unread: 0,
              }
            : chat
        )
      );
      setDraft("");
    } catch (apiError) {
      const messageText = apiError instanceof ApiError ? apiError.message : "发送消息失败";
      setError(messageText);
    }
  };

  return (
    <AppChrome mobileNav="chats">
      <section className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <p className="eyebrow">Chats</p>
            <h2 className="panel-title">会话列表</h2>
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
            <div className="button-row">
              <button className="ghost-button" type="button">
                <span className="material-symbols-outlined">add</span>
                发起私聊
              </button>
              <button className="ghost-button" type="button">
                <span className="material-symbols-outlined">groups</span>
                创建群
              </button>
            </div>
          </div>

          <div className="sidebar-scroll">
            {viewState === "loading" ? <div className="empty-state">会话加载中...</div> : null}
            {viewState === "error" ? <div className="empty-state">{error}</div> : null}
            <div className="chat-list">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-item ${chat.id === selectedChat?.id ? "active" : ""}`}
                  onClick={() => navigate(`/app/chats/${chat.id}`)}
                  type="button"
                >
                  <div className="avatar-wrap">
                    <div className={`avatar ${chat.online ? "status-online" : ""}`}>{avatarLabel(chat.title)}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p className="chat-name">{chat.title}</p>
                    <div className="detail-text">{chat.preview}</div>
                  </div>
                  <div>
                    <div className="chat-time">{chat.time}</div>
                    {chat.unread ? <span className="small-badge">{chat.unread > 99 ? "99+" : chat.unread}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="message-pane">
          {selectedChat ? (
            <>
              <div className="message-header">
                <div className="message-header-meta">
                  <div className="avatar-wrap">
                    <div className={`avatar-large ${selectedChat.online ? "status-online" : ""}`}>{avatarLabel(selectedChat.title)}</div>
                  </div>
                  <div>
                    <h2 className="message-title">{selectedChat.title}</h2>
                    <div className="detail-text">
                      {selectedChat.subtitle} · {selectedChat.members} 位成员
                    </div>
                  </div>
                </div>
                <div className="button-row">
                  <button className="icon-button" type="button">
                    <span className="material-symbols-outlined">group_add</span>
                  </button>
                  <button className="icon-button" type="button">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                </div>
              </div>

              <div className="message-scroll">
                <div className="day-divider">今天</div>
                {(messages[selectedChat.id] ?? []).map((message) => (
                  <div key={String(message.id)} className={`message-group ${message.from === "self" ? "self" : ""}`}>
                    <div className="avatar" style={{ width: 36, height: 36, borderRadius: 12, fontSize: ".78rem" }}>
                      {avatarLabel(message.name)}
                    </div>
                    <div className="message-bubbles">
                      <div className={`message-bubble ${message.from === "self" ? "self" : "other"}`}>{message.text}</div>
                      <div className="message-meta">
                        <span>{message.time}</span>
                        {message.from === "self" ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--brand-primary)" }}>
                            done_all
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form className="composer" onSubmit={submit}>
                <div className="composer-row">
                  <button className="icon-button" type="button">
                    <span className="material-symbols-outlined">add_circle</span>
                  </button>
                  <textarea
                    className="textarea"
                    placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                  />
                  <button className="button" type="submit">
                    <span className="material-symbols-outlined">send</span>
                    发送
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="empty-state">还没有会话。先从 Space 用户页发起私聊。</div>
          )}
        </section>

        <aside className="panel">
          {selectedChat ? (
            <>
              <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <p className="eyebrow">Context</p>
                <h3 className="panel-title">{selectedChat.type === "direct" ? "私聊资料" : "群聊详情"}</h3>
                <p className="card-subtitle">{selectedChat.detail.summary}</p>
              </div>

              <div className="panel-scroll" style={{ paddingTop: 18 }}>
                <div className="detail-list">
                  <div className="detail-card">
                    <div className="detail-row">
                      <div>
                        <strong>当前状态</strong>
                        <div className="detail-text">{selectedChat.detail.relation}</div>
                      </div>
                      <span className="status-chip">{selectedChat.online ? "在线" : "离线"}</span>
                    </div>
                    <div className="detail-row">
                      <div>
                        <strong>最后同步</strong>
                        <div className="detail-text">在线状态以 heartbeat 为准，不在前端本地猜测。</div>
                      </div>
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>快捷操作</strong>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      {selectedChat.detail.actions.map((action, index) => (
                        <button
                          key={action}
                          className={index === selectedChat.detail.actions.length - 1 ? "danger-button" : "ghost-button"}
                          type="button"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="detail-card">
                    <strong>接口状态</strong>
                    <div className="detail-text" style={{ marginTop: 10 }}>
                      左栏、消息拉取、增量轮询和消息发送现在都走真实 API；失败信息直接显示后端返回的 message。
                    </div>
                    {error ? <div className="alert" style={{ marginTop: 12 }}>{error}</div> : null}
                    <div className="button-row" style={{ marginTop: 14 }}>
                      <Link className="ghost-button" to="/app/friends/requests">
                        去好友页
                      </Link>
                      <Link className="ghost-button" to="/app/settings/notifications">
                        去通知设置
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">选择一个会话查看详情。</div>
          )}
        </aside>
      </section>
    </AppChrome>
  );
}
