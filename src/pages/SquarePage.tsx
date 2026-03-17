import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import type { AppViewState, UserDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const orbOffsets = [
  { x: "8%", y: "22%", delay: "0s" },
  { x: "29%", y: "10%", delay: ".4s" },
  { x: "56%", y: "26%", delay: ".8s" },
  { x: "76%", y: "12%", delay: "1.2s" },
  { x: "16%", y: "58%", delay: "1.6s" },
  { x: "46%", y: "64%", delay: "2s" },
  { x: "72%", y: "56%", delay: "2.4s" },
];

export default function SquarePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserDTO[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([
      api.getSpaceUsers({ q: query || undefined, limit: 24, offset: 0 }, controller.signal),
      api.getOnlineUsers({ q: query || undefined, limit: 12, offset: 0 }, controller.signal),
    ])
      .then(([allUsers, liveUsers]) => {
        setUsers(allUsers);
        setOnlineUsers(liveUsers);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "广场加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [query]);

  const featuredUsers = useMemo(() => (onlineUsers.length ? onlineUsers : users).slice(0, 7), [onlineUsers, users]);
  const browseUsers = useMemo(() => users.slice(0, 16), [users]);

  const startChat = async (userId: number) => {
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
      navigate("/app/notifications");
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起好友申请失败";
      setError(message);
    }
  };

  return (
    <AppChrome title="广场" hideTopbar>
      <section className="page-stack">
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

        <section className="square-stage square-stage-plain">
          {featuredUsers.map((user, index) => (
            <button
              key={user.user_id}
              className={`avatar-orb ${user.is_alive ? "live" : ""}`}
              onClick={() => setSelectedUser(user)}
              style={{
                left: orbOffsets[index % orbOffsets.length]?.x,
                top: orbOffsets[index % orbOffsets.length]?.y,
                animationDelay: orbOffsets[index % orbOffsets.length]?.delay,
              }}
              type="button"
            >
              <div className={`avatar-orb-core ${user.is_alive ? "status-online" : ""}`}>{avatarLabel(user.name)}</div>
              <span>{user.name}</span>
            </button>
          ))}
        </section>

        {viewState === "loading" ? <FeedbackState title="广场加载中" description="正在同步成员。" tone="loading" /> : null}
        {onlineUsers.length ? (
          <section className="list-section">
            <div className="section-label">在线</div>
            <div className="simple-list">
              {onlineUsers.map((user) => (
                <button key={`live-${user.user_id}`} className="simple-row person-row" onClick={() => setSelectedUser(user)} type="button">
                  <div className={`mini-avatar ${user.is_alive ? "status-online" : ""}`}>{avatarLabel(user.name)}</div>
                  <div className="row-main">
                    <strong>{user.name}</strong>
                  </div>
                  {user.verified ? <span className="verified-badge">Verified</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="list-section">
          <div className="section-label">成员</div>
          <div className="simple-list">
            {browseUsers.map((user) => (
              <button key={`browse-${user.user_id}`} className="simple-row person-row" onClick={() => setSelectedUser(user)} type="button">
                <div className={`mini-avatar ${user.is_alive ? "status-online" : ""}`}>{avatarLabel(user.name)}</div>
                <div className="row-main">
                  <strong>{user.name}</strong>
                  <div className="row-subtle">{user.is_alive ? "在线" : "离线"}</div>
                </div>
                {user.verified ? <span className="verified-badge">Verified</span> : null}
              </button>
            ))}
          </div>
        </section>
      </section>

      <BottomSheet
        open={Boolean(selectedUser)}
        title={selectedUser?.name ?? "成员"}
        description="选择一个动作"
        onClose={() => setSelectedUser(null)}
      >
        {selectedUser ? (
          <div className="detail-list">
            <div className="simple-sheet-user">
              <div className={`mini-avatar ${selectedUser.is_alive ? "status-online" : ""}`}>{avatarLabel(selectedUser.name)}</div>
              <div>
                <strong>{selectedUser.name}</strong>
                <div className="row-subtle">{selectedUser.is_alive ? "在线" : "离线"}</div>
              </div>
            </div>
            <div className="sheet-action-list">
              <button className="button" onClick={() => void startChat(selectedUser.user_id)} type="button">
                发消息
              </button>
              <button className="ghost-button" onClick={() => void sendFriendRequest(selectedUser.user_id)} type="button">
                加好友
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
