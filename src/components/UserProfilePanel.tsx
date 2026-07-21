import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncErrorDialog } from "./AsyncErrorDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { RequestStatusModal } from "./RequestStatusModal";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { formatRelativeTime } from "../lib/presentation";
import type { AppViewState, ChatDTO, UserDTO } from "../types";

interface UserProfilePanelProps {
  userId: number;
  onOpenChat?: (chatId: number) => void;
}

function friendshipAge(respondedAt?: number | null) {
  if (!respondedAt) return "已是好友";
  const days = Math.max(1, Math.floor((Date.now() / 1000 - respondedAt) / 86400));
  return days < 30 ? `认识 ${days} 天` : `认识 ${Math.floor(days / 30)} 个月`;
}

export function UserProfilePanel({ userId, onOpenChat }: UserProfilePanelProps) {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [groupChats, setGroupChats] = useState<ChatDTO[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [respondedAt, setRespondedAt] = useState<number | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "sent">("idle");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    phase: "loading" | "success" | "error";
    loadingLabel: string;
    successLabel: string;
    errorLabel: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);
    Promise.all([
      api.getFriends(controller.signal),
      api.getChats(controller.signal),
      api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal),
      api.getFriendStatus(userId, controller.signal),
    ])
      .then(([friends, chats, users, status]) => {
        const matchedFriend = friends.find((row) => row.user_id === userId) ?? null;
        const matchedUser = matchedFriend ?? users.find((row) => row.user_id === userId) ?? null;
        if (!matchedUser) throw new Error("没有找到这个用户");
        setUser(matchedUser);
        setIsFriend(status.is_friend);
        setRespondedAt(status.friendship?.responded_at ?? matchedFriend?.responded_at ?? null);
        setGroupChats(chats.filter((chat) => chat.group && chat.members.some((member) => member.user_id === userId)));
        setRequestState("idle");
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        setError(apiError instanceof ApiError || apiError instanceof Error ? apiError.message : "用户详情加载失败");
        setViewState("error");
      });
    return () => controller.abort();
  }, [userId]);

  const presence = useMemo(() => {
    if (!user) return "";
    return user.is_alive ? "现在在线" : `上次活跃 ${formatRelativeTime(user.last_heartbeat)}`;
  }, [user]);

  const openChat = async () => {
    if (!user) return;
    try {
      const chat = await api.createDirectChat(user.user_id);
      if (onOpenChat) onOpenChat(chat.chat_id);
      else navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "发起私聊失败");
    }
  };

  const sendRequest = async () => {
    if (!user || requestState !== "idle") return;
    setRequestState("sending");
    setStatusModal({ phase: "loading", loadingLabel: "正在发送", successLabel: "好友申请已发送", errorLabel: "发送失败" });
    try {
      await api.createFriendRequest(user.user_id);
      setRequestState("sent");
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setRequestState("idle");
      setStatusModal((current) =>
        current ? { ...current, phase: "error", errorLabel: apiError instanceof ApiError ? apiError.message : "发送失败" } : null
      );
    }
  };

  const removeFriend = async () => {
    if (!user) return;
    setStatusModal({ phase: "loading", loadingLabel: "正在删除", successLabel: "好友已删除", errorLabel: "删除失败" });
    try {
      await api.removeFriendRequest(user.user_id);
      setIsFriend(false);
      setRespondedAt(null);
      setRemoveConfirmOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current ? { ...current, phase: "error", errorLabel: apiError instanceof ApiError ? apiError.message : "删除失败" } : null
      );
    }
  };

  if (viewState === "loading") return <FeedbackState title="正在打开用户资料" description="" tone="loading" />;
  if (!user || viewState === "error") return <FeedbackState title="无法打开用户资料" description={error ?? "请稍后重试"} />;

  return (
    <div className="user-profile-panel">
      <section className="user-profile-identity">
        <div className="user-profile-avatar-wrap">
          <UserAvatar className={`user-profile-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
        </div>
        <div className="user-profile-copy">
          <div className="user-profile-kicker">{isFriend ? friendshipAge(respondedAt) : "同一空间成员"}</div>
          <h2>{user.name}</h2>
          <p className={user.is_alive ? "is-online" : ""}>{presence}</p>
        </div>
      </section>

      <div className="user-profile-primary-actions">
        {isFriend ? (
          <button className="button" onClick={() => void openChat()} type="button">发消息</button>
        ) : (
          <button className="button" disabled={requestState !== "idle"} onClick={() => void sendRequest()} type="button">
            {requestState === "sending" ? "发送中" : requestState === "sent" ? "已发送" : "加好友"}
          </button>
        )}
      </div>

      <section className="user-profile-section">
        <div className="section-label">共同群聊 · {groupChats.length}</div>
        {groupChats.length ? (
          <div className="user-profile-groups">
            {groupChats.map((chat) => (
              <button key={chat.chat_id} className="user-profile-group-row" onClick={() => (onOpenChat ? onOpenChat(chat.chat_id) : navigate(`/app/chats/${chat.chat_id}`))} type="button">
                <UserAvatar className="mini-avatar" groupMembers={chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri }))} name={chat.title ?? "群聊"} />
                <span><strong>{chat.title ?? "未命名群聊"}</strong><small>{chat.members.length} 人</small></span>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="user-profile-empty">暂时没有共同群聊</div>
        )}
      </section>

      {isFriend ? (
        <button className="user-profile-danger-action" onClick={() => setRemoveConfirmOpen(true)} type="button">删除好友</button>
      ) : null}

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <ConfirmDialog danger open={removeConfirmOpen} title="删除好友？" description="已有聊天记录仍会保留。" confirmLabel="删除" onClose={() => setRemoveConfirmOpen(false)} onConfirm={() => void removeFriend()} />
      <RequestStatusModal errorLabel={statusModal?.errorLabel} loadingLabel={statusModal?.loadingLabel} onAutoClose={() => setStatusModal(null)} open={Boolean(statusModal)} phase={statusModal?.phase ?? "loading"} successLabel={statusModal?.successLabel} />
    </div>
  );
}
