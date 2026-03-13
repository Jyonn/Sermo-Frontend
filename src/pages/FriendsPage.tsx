import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { ApiError, api } from "../lib/api";
import type { AppViewState, FriendAccepted, FriendTab, FriendshipRequestDTO, UserDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function tabFromPath(pathname: string): FriendTab {
  return pathname === "/app/friends" ? "accepted" : "incoming";
}

function timeAgo(timestamp: number) {
  const delta = Math.max(1, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (delta < 60) return `${delta} 分钟前`;
  if (delta < 1440) return `${Math.floor(delta / 60)} 小时前`;
  return `${Math.floor(delta / 1440)} 天前`;
}

function mapFriend(user: UserDTO): FriendAccepted {
  return {
    id: user.user_id,
    name: user.name,
    status: user.is_alive ? "在线" : "离线",
    mood: user.verified ? "Verified 用户" : "Basic 用户",
  };
}

function requestTitle(request: FriendshipRequestDTO, tab: FriendTab) {
  return tab === "incoming" ? request.from_user.name : request.to_user.name;
}

function requestLevel(request: FriendshipRequestDTO, tab: FriendTab) {
  return tab === "incoming" ? "来自对方发起" : "由你发起";
}

export default function FriendsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FriendTab>(tabFromPath(location.pathname));
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendAccepted[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRequestDTO[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRequestDTO[]>([]);

  useEffect(() => {
    if (location.pathname === "/app/friends") {
      setTab("accepted");
    } else if (location.pathname === "/app/friends/requests") {
      setTab("incoming");
    }
  }, [location.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([api.getFriends(controller.signal), api.getFriendRequests(controller.signal)])
      .then(([friendRows, requestRows]) => {
        setFriends(friendRows.map(mapFriend));
        setIncoming(requestRows.incoming);
        setOutgoing(requestRows.outgoing);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "好友数据加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, []);

  const activeRequests = useMemo(() => {
    if (tab === "incoming") return incoming;
    if (tab === "outgoing") return outgoing;
    return [];
  }, [incoming, outgoing, tab]);

  const actOnRequest = async (requestId: number, accept?: boolean) => {
    try {
      if (accept === undefined) {
        await api.removeFriendRequest(requestId);
      } else {
        await api.respondFriendRequest(requestId, accept);
      }

      const requests = await api.getFriendRequests();
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
      if (accept) {
        const refreshedFriends = await api.getFriends();
        setFriends(refreshedFriends.map(mapFriend));
      }
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "操作失败";
      setError(message);
    }
  };

  return (
    <AppChrome mobileNav="friends">
      <section className="friend-shell">
        <div className="panel">
          <div className="panel-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
            <p className="eyebrow">Friends</p>
            <h2 className="panel-title">好友与申请</h2>
            <p className="card-subtitle">好友列表和申请列表已经接入真实接口；限制态仍按产品规范前置展示。</p>
          </div>

          <div className="tab-row" style={{ padding: "18px 0" }}>
            <Link className={`tab-chip ${tab === "incoming" ? "active" : ""}`} to="/app/friends/requests">
              Incoming ({incoming.length})
            </Link>
            <button className={`tab-chip ${tab === "outgoing" ? "active" : ""}`} onClick={() => setTab("outgoing")} type="button">
              Outgoing ({outgoing.length})
            </button>
            <Link className={`tab-chip ${tab === "accepted" ? "active" : ""}`} to="/app/friends">
              Friends ({friends.length})
            </Link>
          </div>

          {viewState === "loading" ? <div className="empty-state">好友数据加载中...</div> : null}
          {error ? <div className="alert" style={{ marginBottom: 14 }}>{error}</div> : null}

          <div className={tab === "accepted" ? "settings-list" : "request-list"}>
            {tab === "accepted"
              ? friends.map((friend) => (
                  <div key={friend.id} className="request-card">
                    <div className="request-head">
                      <div className="request-profile">
                        <div className={`mini-avatar ${friend.status === "在线" ? "status-online" : ""}`}>{avatarLabel(friend.name)}</div>
                        <div>
                          <strong>{friend.name}</strong>
                          <div className="detail-text">{friend.status}</div>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button className="ghost-button" type="button">
                          发起私聊
                        </button>
                      </div>
                    </div>
                    <div className="detail-text" style={{ marginTop: 12 }}>
                      {friend.mood}
                    </div>
                  </div>
                ))
              : activeRequests.map((request) => (
                  <div key={request.request_id} className="request-card">
                    <div className="request-head">
                      <div className="request-profile">
                        <div className="mini-avatar">{avatarLabel(requestTitle(request, tab))}</div>
                        <div>
                          <strong>{requestTitle(request, tab)}</strong>
                          <div className="detail-text">
                            {requestLevel(request, tab)} · {timeAgo(request.updated_at)}
                          </div>
                        </div>
                      </div>
                      <span className="status-chip">{tab === "incoming" ? "待处理" : "挂起中"}</span>
                    </div>
                    <div className="detail-text" style={{ margin: "14px 0" }}>
                      请求 ID: {request.request_id} · {request.is_system_locked ? "系统锁定" : "普通关系请求"}
                    </div>
                    <div className="request-actions">
                      {tab === "incoming" ? (
                        <>
                          <button className="button" onClick={() => void actOnRequest(request.request_id, true)} type="button">
                            同意
                          </button>
                          <button className="ghost-button" onClick={() => void actOnRequest(request.request_id, false)} type="button">
                            拒绝
                          </button>
                        </>
                      ) : (
                        <button className="danger-button" onClick={() => void actOnRequest(request.request_id)} type="button">
                          撤回
                        </button>
                      )}
                    </div>
                  </div>
                ))}

            {!friends.length && tab === "accepted" && viewState === "ready" ? <div className="empty-state">还没有好友。</div> : null}
            {!activeRequests.length && tab !== "accepted" && viewState === "ready" ? <div className="empty-state">当前没有待处理申请。</div> : null}
          </div>
        </div>

        <div className="settings-list">
          <div className="restriction-banner">
            <span className="material-symbols-outlined" style={{ color: "var(--brand-primary)" }}>
              lock_open
            </span>
            <div>
              <strong>Basic 限制态</strong>
              <div className="detail-text" style={{ marginTop: 6 }}>
                当前账号只能保留 5 个挂起中的 outgoing request。若后端返回禁止错误，前端应引导升级。
              </div>
              <div className="button-row" style={{ marginTop: 14 }}>
                <button className="button" onClick={() => navigate("/app/settings/account")} type="button">
                  升级到 Verified
                </button>
                <button className="ghost-button" onClick={() => navigate("/app/space-users/online")} type="button">
                  去在线用户页
                </button>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <p className="eyebrow">Permissions</p>
            <h3 className="settings-headline">受限交互说明</h3>
            <div className="detail-list" style={{ marginTop: 14 }}>
              <div className="detail-row">
                <div>
                  <strong>主动加好友</strong>
                  <div className="detail-text">后端仅允许 Verified 账号发起申请</div>
                </div>
                <span className="small-badge">LOCKED</span>
              </div>
              <div className="detail-row">
                <div>
                  <strong>响应申请</strong>
                  <div className="detail-text">所有等级均可处理 incoming request</div>
                </div>
                <span className="status-chip">OPEN</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppChrome>
  );
}
