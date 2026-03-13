import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { ApiError, api } from "../lib/api";
import type { AppViewState, UserDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function SpaceUsersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const onlineOnly = location.pathname === "/app/space-users/online";

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    const fetcher = onlineOnly
      ? api.getOnlineUsers({ q: query || undefined, limit: 24, offset: 0 }, controller.signal)
      : api.getSpaceUsers({ q: query || undefined, limit: 24, offset: 0 }, controller.signal);

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
  }, [onlineOnly, query]);

  const filteredUsers = useMemo(() => users, [users]);

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
      setError(message);
    }
  };

  return (
    <AppChrome mobileNav="space">
      <section className="directory-shell">
        <div className="panel">
          <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
            <p className="eyebrow">Space Users</p>
            <h2 className="panel-title">{onlineOnly ? "在线用户" : "Space 用户列表"}</h2>
            <p className="card-subtitle">支持检索与在线过滤。在线状态以后端心跳结果为准。</p>
            <div className="tab-row" style={{ marginTop: 18 }}>
              <Link className={`tab-chip ${!onlineOnly ? "active" : ""}`} to="/app/space-users">
                全部用户
              </Link>
              <Link className={`tab-chip ${onlineOnly ? "active" : ""}`} to="/app/space-users/online">
                只看在线
              </Link>
            </div>
          </div>

          <div className="panel-scroll" style={{ paddingTop: 18 }}>
            <label className="search-box">
              <span className="material-symbols-outlined">search</span>
              <input
                className="input"
                style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
                placeholder="输入昵称关键字"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {viewState === "loading" ? <div className="empty-state">用户列表加载中...</div> : null}
            {error ? <div className="alert" style={{ marginBottom: 14 }}>{error}</div> : null}

            <div className="user-grid">
              {filteredUsers.map((user) => (
                <div key={user.user_id} className="user-card">
                  <div className="user-head">
                    <div className="user-profile">
                      <div className={`mini-avatar ${user.is_alive ? "status-online" : ""}`}>{avatarLabel(user.name)}</div>
                      <div>
                        <strong>{user.name}</strong>
                        <div className="detail-text">
                          {user.verified ? "Verified" : "Basic"} · {user.is_alive ? "在线" : "离线"}
                        </div>
                      </div>
                    </div>
                    <span className="status-chip">{user.is_alive ? "alive" : "offline"}</span>
                  </div>
                  <div className="detail-text" style={{ margin: "14px 0" }}>
                    最近心跳：{new Date(user.last_heartbeat * 1000).toLocaleString("zh-CN")}
                  </div>
                  <div className="user-actions">
                    <button className="button" onClick={() => void createDirectChat(user.user_id)} type="button">
                      发起私聊
                    </button>
                    <button className="ghost-button" onClick={() => void sendFriendRequest(user.user_id)} type="button">
                      发起好友申请
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!filteredUsers.length && viewState === "ready" ? <div className="empty-state">没有匹配的 Space 用户。</div> : null}
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
            <p className="eyebrow">Realtime</p>
            <h3 className="panel-title">在线状态规范</h3>
          </div>
          <div className="panel-scroll" style={{ paddingTop: 18 }}>
            <div className="detail-list">
              <div className="detail-card">
                <strong>判定来源</strong>
                <div className="detail-text" style={{ marginTop: 10 }}>
                  每 60 秒 heartbeat；前端不自行推断在线，只消费后端返回的 is_alive。
                </div>
              </div>
              <div className="detail-card">
                <strong>限制态</strong>
                <div className="detail-text" style={{ marginTop: 10 }}>
                  若 Basic 用户发起好友申请被拒绝，直接展示后端 message，并引导去账号升级。
                </div>
              </div>
              <div className="detail-card">
                <strong>下一步</strong>
                <div className="detail-text" style={{ marginTop: 10 }}>
                  当前已经支持真实发起私聊与好友申请。群聊创建和分页加载下一轮接入。
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </AppChrome>
  );
}
