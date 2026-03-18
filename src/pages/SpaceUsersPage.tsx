import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import type { AppViewState, UserDTO } from "../types";

function productizeFriendRequestError(message: string) {
  if (/verified|认证|验证|权限|forbidden/i.test(message)) {
    return "完成邮箱验证后，你会更顺畅地发起好友申请。";
  }
  return message;
}

export default function SpaceUsersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sheetUser, setSheetUser] = useState<UserDTO | null>(null);
  const onlineOnly = location.pathname === "/app/space-users/online";

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    const fetcher = onlineOnly
      ? api.getOnlineUsers({ q: query || undefined, limit: 40, offset: 0 }, controller.signal)
      : api.getSpaceUsers({ q: query || undefined, limit: 40, offset: 0 }, controller.signal);

    fetcher
      .then((rows) => {
        setUsers(rows);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载用户列表失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [onlineOnly, query, refreshTick]);

  useEffect(() => {
    if (!onlineOnly) return;
    const timer = window.setInterval(() => setRefreshTick((value) => value + 1), 12_000);
    return () => window.clearInterval(timer);
  }, [onlineOnly]);

  const createDirectChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起私聊失败";
      setError(message);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    try {
      await api.createFriendRequest(userId);
      navigate("/app/friends/requests");
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起好友申请失败";
      setError(productizeFriendRequestError(message));
    }
  };

  return (
    <AppChrome title={onlineOnly ? "在线成员" : "成员"} hideTopbar>
      <section className="page-stack">
        <div className="page-tabs">
          <Link className={`tab-chip ${!onlineOnly ? "active" : ""}`} to="/app/space-users">
            全部
          </Link>
          <Link className={`tab-chip ${onlineOnly ? "active" : ""}`} to="/app/space-users/online">
            在线
          </Link>
        </div>

        <label className="search-box page-search">
          <span className="material-symbols-outlined">search</span>
          <input
            className="input"
            style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
            placeholder="搜索成员"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {viewState === "loading" ? <FeedbackState title="成员加载中" description="正在同步成员列表。" tone="loading" /> : null}
        <section className="list-section">
          <div className="simple-list">
            {users.map((user) => (
              <div key={user.user_id} className="simple-row person-row">
                <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                <div className="row-main">
                  <strong>{user.name}</strong>
                  <div className="row-subtle">{user.is_alive ? "在线" : "离线"}</div>
                </div>
                <button className="button row-button" onClick={() => void createDirectChat(user.user_id)} type="button">
                  发消息
                </button>
                <button className="icon-button row-trailing-button" onClick={() => setSheetUser(user)} type="button">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {!users.length && viewState === "ready" ? (
          <FeedbackState
            title="没有找到成员"
            description={query.trim() ? "换个关键词试试。" : "稍后再回来看看。"}
            action={onlineOnly ? <Link className="button" to="/app/space-users">查看全部</Link> : undefined}
          />
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(sheetUser)}
        title={sheetUser?.name ?? "成员"}
        description="选择一个动作"
        onClose={() => setSheetUser(null)}
      >
        {sheetUser ? (
          <div className="sheet-action-list">
            <button className="button" onClick={() => void createDirectChat(sheetUser.user_id)} type="button">
              发消息
            </button>
            <button className="ghost-button" onClick={() => void sendFriendRequest(sheetUser.user_id)} type="button">
              加好友
            </button>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
