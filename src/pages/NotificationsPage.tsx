import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { emitFriendRequestsUpdated } from "../lib/friendRequestBadge";
import { formatRelativeTime } from "../lib/presentation";
import { VerificationBanner } from "../components/VerificationBanner";
import type { AppViewState, ChatDTO, FriendshipRequestDTO, UserDTO } from "../types";

const FRIEND_REQUEST_STATUS_PENDING = 0;

function normalizePendingRequests(rows: { incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }) {
  return {
    incoming: rows.incoming.filter((request) => request.status === FRIEND_REQUEST_STATUS_PENDING),
    outgoing: rows.outgoing.filter((request) => request.status === FRIEND_REQUEST_STATUS_PENDING),
  };
}

type FriendSection = {
  key: string;
  items: UserDTO[];
};

function resolveFriendSectionKey(user: UserDTO) {
  const first = user.name_pinyin?.trim().charAt(0).toUpperCase();
  if (first && /^[A-Z]$/.test(first)) return first;
  return "#";
}

function groupFriends(rows: UserDTO[]) {
  const order = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  const buckets = new Map<string, UserDTO[]>();

  rows.forEach((user) => {
    const key = resolveFriendSectionKey(user);
    const current = buckets.get(key) ?? [];
    current.push(user);
    buckets.set(key, current);
  });

  return order
    .map((key) => ({ key, items: buckets.get(key) ?? [] }))
    .filter((section) => section.items.length) satisfies FriendSection[];
}

function formatLastSeen(user: UserDTO) {
  if (user.is_alive) return "在线";

  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - user.last_heartbeat);
  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;

  return "一个月前";
}

function notificationChatAvatar(chat: ChatDTO) {
  if (chat.group) {
    return {
      name: chat.title ?? "群聊",
      uri: undefined,
      groupMembers: chat.members.map((member) => ({
        name: member.name,
        uri: member.avatar_uri,
      })),
    };
  }
  const peer = chat.members[0];
  return {
    name: peer?.name ?? chat.title ?? "会话",
    uri: peer?.avatar_uri,
    groupMembers: undefined,
  };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const friendSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<UserDTO[]>([]);
  const [groupChats, setGroupChats] = useState<ChatDTO[]>([]);
  const [requests, setRequests] = useState<{ incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }>({
    incoming: [],
    outgoing: [],
  });
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [ignoreRequest, setIgnoreRequest] = useState<FriendshipRequestDTO | null>(null);
  const [revokeRequest, setRevokeRequest] = useState<FriendshipRequestDTO | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([api.getFriends(controller.signal), api.getFriendRequests(controller.signal), api.getChats(controller.signal)])
      .then(([friendRows, requestRows, chatRows]) => {
        const normalizedRequests = normalizePendingRequests(requestRows);
        setFriends(friendRows);
        setRequests(normalizedRequests);
        emitFriendRequestsUpdated(normalizedRequests.incoming.length);
        setGroupChats(chatRows.filter((chat) => chat.group));
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "通讯加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFriends = useMemo(
    () =>
      friends.filter((friend) => {
        if (!normalizedQuery) return true;
        return (
          friend.name.toLowerCase().includes(normalizedQuery) ||
          friend.name_pinyin?.toLowerCase().includes(normalizedQuery)
        );
      }),
    [friends, normalizedQuery]
  );
  const friendSections = useMemo(() => groupFriends(filteredFriends), [filteredFriends]);
  const filteredIncoming = useMemo(
    () => requests.incoming.filter((request) => !normalizedQuery || request.from_user.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, requests.incoming]
  );
  const filteredOutgoing = useMemo(
    () => requests.outgoing.filter((request) => !normalizedQuery || request.to_user.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, requests.outgoing]
  );
  const filteredGroups = useMemo(
    () => groupChats.filter((chat) => !normalizedQuery || (chat.title ?? "群聊").toLowerCase().includes(normalizedQuery)),
    [groupChats, normalizedQuery]
  );

  const pendingRequestCount = requests.incoming.length;

  const actOnRequest = async (userId: number, accept: boolean) => {
    try {
      await api.respondFriendRequest(userId, accept);
      const refreshed = normalizePendingRequests(await api.getFriendRequests());
      setRequests(refreshed);
      emitFriendRequestsUpdated(refreshed.incoming.length);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "处理申请失败";
      setError(message);
    }
  };

  const revokeOutgoingRequest = async (userId: number) => {
    try {
      await api.removeFriendRequest(userId);
      const refreshed = normalizePendingRequests(await api.getFriendRequests());
      setRequests(refreshed);
      emitFriendRequestsUpdated(refreshed.incoming.length);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "撤回申请失败";
      setError(message);
    }
  };

  const scrollToFriendSection = (key: string) => {
    friendSectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppChrome title="通讯" hideTopbar>
      <section className="page-stack">
        <div className="chat-list-screen-header minimal-page-header">
          <div className="page-toolbar">
            <h2 className="panel-title">通讯</h2>
          </div>
          <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />
          <label className="search-box page-search">
            <span className="material-symbols-outlined">search</span>
            <input
              className="input"
              style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
              placeholder="搜索好友、申请或群聊"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {viewState === "loading" ? <FeedbackState title="通讯加载中" description="正在同步好友、申请和群聊。" tone="loading" /> : null}

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row communication-entry-row" onClick={() => setRequestSheetOpen(true)} type="button">
              <div className="row-icon notification-icon live">
                <span className="material-symbols-outlined">person_add</span>
              </div>
              <div className="row-main">
                <strong>好友申请</strong>
                <div className="row-subtle">{pendingRequestCount ? `${pendingRequestCount} 条待处理` : "现在没有新的好友申请"}</div>
              </div>
              {pendingRequestCount ? <span className="small-badge">{pendingRequestCount}</span> : <span className="count-badge">查看</span>}
            </button>

            <button className="simple-row communication-entry-row" onClick={() => setGroupSheetOpen(true)} type="button">
              <div className="row-icon notification-icon success">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div className="row-main">
                <strong>群聊</strong>
                <div className="row-subtle">{groupChats.length ? `你已加入 ${groupChats.length} 个群聊` : "还没有加入任何群聊"}</div>
              </div>
              <span className="count-badge">查看</span>
            </button>
          </div>
        </section>

        <section className="list-section">
          <div className="friend-directory">
            <div className="friend-directory-list">
              {friendSections.map((section) => (
                <section
                  key={section.key}
                  ref={(node) => {
                    friendSectionRefs.current[section.key] = node;
                  }}
                  className="friend-directory-section"
                >
                  <div className="friend-directory-heading">{section.key}</div>
                  <div className="simple-list">
                    {section.items.map((friend) => (
                      <button
                        key={friend.user_id}
                        className="simple-row person-row person-row-link"
                        onClick={() => navigate(`/app/notifications/friends/${friend.user_id}`)}
                        type="button"
                      >
                        <UserAvatar
                          className={`mini-avatar friend-avatar-neutral ${friend.is_alive ? "status-online" : ""}`}
                          name={friend.name}
                          uri={friend.avatar_uri}
                        />
                        <div className="row-main">
                          <strong>{friend.name}</strong>
                          <div className="row-subtle">{formatLastSeen(friend)}</div>
                        </div>
                        <span className="material-symbols-outlined chevron-inline">chevron_right</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {friendSections.length ? (
              <div className="friend-directory-index" aria-label="好友索引">
                {friendSections.map((section) => (
                  <button
                    key={`friend-index-${section.key}`}
                    className="friend-directory-index-button"
                    onClick={() => scrollToFriendSection(section.key)}
                    type="button"
                  >
                    {section.key}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {!filteredFriends.length && viewState === "ready" ? (
          <FeedbackState title={normalizedQuery ? "没有匹配的好友" : "还没有好友"} description={normalizedQuery ? "换个关键词试试。" : "先从广场或聊天里开始建立联系。"} />
        ) : null}
      </section>

      <SideDrawer
        open={requestSheetOpen}
        title="好友申请"
        description="处理收到的申请，或查看你发出的申请。"
        onClose={() => setRequestSheetOpen(false)}
      >
        <section className="list-section">
          <div className="section-label">收到的</div>
          {filteredIncoming.length ? (
            <div className="simple-list">
              {filteredIncoming.map((request) => (
                <div key={request.request_id} className="simple-row request-row">
                  <UserAvatar className="mini-avatar" name={request.from_user.name} uri={request.from_user.avatar_uri} />
                  <div className="row-main">
                    <strong>{request.from_user.name}</strong>
                    <div className="row-subtle">{formatRelativeTime(request.updated_at)}</div>
                  </div>
                  <div className="row-actions">
                    <button className="button row-button" onClick={() => void actOnRequest(request.from_user.user_id, true)} type="button">
                      同意
                    </button>
                    <button className="ghost-button row-button" onClick={() => setIgnoreRequest(request)} type="button">
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <FeedbackState title="没有收到新的申请" description="有人想和你建立联系时，这里会出现。" />
          )}
        </section>

        <section className="list-section">
          <div className="section-label">发出的</div>
          {filteredOutgoing.length ? (
            <div className="simple-list">
              {filteredOutgoing.map((request) => (
                <div key={request.request_id} className="simple-row request-row">
                  <UserAvatar className="mini-avatar" name={request.to_user.name} uri={request.to_user.avatar_uri} />
                  <div className="row-main">
                    <strong>{request.to_user.name}</strong>
                    <div className="row-subtle">{formatRelativeTime(request.updated_at)}</div>
                  </div>
                  <button className="ghost-button row-button" onClick={() => setRevokeRequest(request)} type="button">
                    撤回
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <FeedbackState title="没有发出的申请" description="想建立关系时，可以先从广场里发起。" />
          )}
        </section>
      </SideDrawer>
      <ConfirmDialog
        danger
        open={Boolean(ignoreRequest)}
        title="确认忽略好友申请？"
        description={ignoreRequest ? `忽略后，${ignoreRequest.from_user.name} 的这条申请将不再显示为待处理。` : ""}
        confirmLabel="确认忽略"
        onClose={() => setIgnoreRequest(null)}
        onConfirm={() => {
          const targetUserId = ignoreRequest?.from_user.user_id;
          setIgnoreRequest(null);
          if (targetUserId) {
            void actOnRequest(targetUserId, false);
          }
        }}
      />
      <ConfirmDialog
        danger
        open={Boolean(revokeRequest)}
        title="确认撤回好友申请？"
        description={revokeRequest ? `撤回后，发给 ${revokeRequest.to_user.name} 的这条申请会被取消。` : ""}
        confirmLabel="确认撤回"
        onClose={() => setRevokeRequest(null)}
        onConfirm={() => {
          const targetUserId = revokeRequest?.to_user.user_id;
          setRevokeRequest(null);
          if (targetUserId) {
            void revokeOutgoingRequest(targetUserId);
          }
        }}
      />

      <SideDrawer
        open={groupSheetOpen}
        title="群聊"
        description="查看你已加入的群聊。"
        onClose={() => setGroupSheetOpen(false)}
      >
        <section className="list-section">
          <div className="section-label">已加入的群聊</div>
          {filteredGroups.length ? (
            <div className="simple-list">
              {filteredGroups.map((chat) => {
                const avatar = notificationChatAvatar(chat);
                return (
                  <button
                    key={chat.chat_id}
                    className="simple-row notification-row"
                    onClick={() => {
                      setGroupSheetOpen(false);
                      navigate(`/app/chats/${chat.chat_id}`);
                    }}
                    type="button"
                  >
                    <UserAvatar className="mini-avatar" groupMembers={avatar.groupMembers} name={avatar.name} uri={avatar.uri} />
                    <div className="row-main">
                      <strong>{chat.title ?? "未命名群聊"}</strong>
                      <div className="row-subtle">{chat.last_message?.content || "打开群聊继续讨论"}</div>
                    </div>
                    <span className="count-badge">{chat.members.length} 人</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <FeedbackState title={normalizedQuery ? "没有匹配的群聊" : "还没有群聊"} description={normalizedQuery ? "换个关键词试试。" : "你创建或加入群聊后，这里会出现。"} />
          )}
        </section>
      </SideDrawer>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
