import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { RequestStatusModal } from "../components/RequestStatusModal";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import type { AppViewState, ChatDTO, UserDTO } from "../types";

function formatFriendshipDays(respondedAt?: number | null) {
  if (!respondedAt) return "已成为好友";
  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - respondedAt);
  const days = Math.max(1, Math.floor(diffSeconds / 86400));
  return `已成为好友 ${days} 天`;
}

export default function FriendProfilePage() {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const parsedFriendId = Number(friendId);
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [groupChats, setGroupChats] = useState<ChatDTO[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [respondedAt, setRespondedAt] = useState<number | null>(null);
  const [friendActionState, setFriendActionState] = useState<"idle" | "sending" | "sent">("idle");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    phase: "loading" | "success" | "error";
    loadingLabel: string;
    successLabel: string;
    errorLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(parsedFriendId)) {
      setViewState("error");
      setError("用户不存在");
      return;
    }

    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([
      api.getFriends(controller.signal),
      api.getChats(controller.signal),
      api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal),
      api.getFriendStatus(parsedFriendId, controller.signal),
    ])
      .then(([friends, chats, users, status]) => {
        const matchedFriend = friends.find((row) => row.user_id === parsedFriendId) ?? null;
        const matchedUser = matchedFriend ?? users.find((row) => row.user_id === parsedFriendId) ?? null;
        if (!matchedUser) {
          setUser(null);
          setGroupChats([]);
          setViewState("error");
          setError("没有找到这个用户");
          return;
        }

        setUser(matchedUser);
        setIsFriend(status.is_friend);
        setRespondedAt(status.friendship?.responded_at ?? matchedFriend?.responded_at ?? null);
        setFriendActionState("idle");
        setGroupChats(chats.filter((chat) => chat.group && chat.members.some((member) => member.user_id === parsedFriendId)));
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "用户详情加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [parsedFriendId]);

  const title = user?.name ?? "用户详情";
  const relationshipSummary = useMemo(() => {
    if (!user) return "";
    return isFriend ? formatFriendshipDays(respondedAt) : "还不是好友";
  }, [isFriend, respondedAt, user]);

  const startDirectChat = async () => {
    if (!user) return;

    try {
      const chat = await api.createDirectChat(user.user_id);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起私聊失败";
      setError(message);
    }
  };

  const sendFriendRequest = async () => {
    if (!user || isFriend) return;

    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在发送好友申请",
      successLabel: "好友申请已发送",
      errorLabel: "好友申请发送失败",
    });

    try {
      setFriendActionState("sending");
      await api.createFriendRequest(user.user_id);
      setFriendActionState("sent");
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setFriendActionState("idle");
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "好友申请发送失败",
            }
          : null
      );
    }
  };

  const removeFriend = async () => {
    if (!user || !isFriend) return;

    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在删除好友",
      successLabel: "好友已删除",
      errorLabel: "删除好友失败",
    });

    try {
      await api.removeFriendRequest(user.user_id);
      setIsFriend(false);
      setRespondedAt(null);
      setFriendActionState("idle");
      setRemoveConfirmOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "删除好友失败",
            }
          : null
      );
    }
  };

  return (
    <AppChrome title={title} hideTopbar shellClassName="shell-friend-profile">
      <header className="chat-list-screen-header minimal-page-header friend-profile-header">
        <button className="icon-button" onClick={() => navigate("/app/notifications")} type="button" aria-label="返回通讯">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="page-toolbar friend-profile-toolbar" />
      </header>
      <section className="page-stack friend-profile-page">

        {viewState === "loading" ? <FeedbackState title="用户详情加载中" description="正在同步用户信息。" tone="loading" /> : null}

        {user && viewState === "ready" ? (
          <>
            <section className="friend-profile-hero">
              <UserAvatar
                className={`friend-profile-avatar ${user.is_alive ? "status-online" : ""}`}
                name={user.name}
                uri={user.avatar_uri}
              />
              <div className="friend-profile-name-row">
                <h3>{user.name}</h3>
              </div>
              <div className="friend-profile-meta">{relationshipSummary}</div>
              <div className="friend-profile-actions">
                {isFriend ? (
                  <>
                    <button className="button friend-profile-chat-button" onClick={() => void startDirectChat()} type="button">
                      发消息
                    </button>
                    <button className="ghost-button danger-ghost-button friend-profile-secondary-action" onClick={() => setRemoveConfirmOpen(true)} type="button">
                      删除好友
                    </button>
                  </>
                ) : (
                  <button
                    className="button friend-profile-chat-button"
                    disabled={friendActionState !== "idle"}
                    onClick={() => void sendFriendRequest()}
                    type="button"
                  >
                    {friendActionState === "sending" ? "发送中..." : friendActionState === "sent" ? "已发送申请" : "加好友"}
                  </button>
                )}
              </div>
            </section>

            <section className="list-section">
              <div className="section-label">共同群聊</div>
              {groupChats.length ? (
                <div className="simple-list">
                  {groupChats.map((chat) => (
                    <button
                      key={chat.chat_id}
                      className="simple-row notification-row"
                      onClick={() => navigate(`/app/chats/${chat.chat_id}`)}
                      type="button"
                    >
                      <UserAvatar
                        className="mini-avatar"
                        groupMembers={chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri }))}
                        name={chat.title ?? "未命名群聊"}
                      />
                      <div className="row-main">
                        <strong>{chat.title ?? "未命名群聊"}</strong>
                        <div className="row-subtle">{chat.members.length} 人</div>
                      </div>
                      <span className="material-symbols-outlined chevron-inline">chevron_right</span>
                    </button>
                  ))}
                </div>
              ) : (
                <FeedbackState title="暂无共同群聊" description="当前没有可展示的共同群聊。" />
              )}
            </section>
          </>
        ) : null}
      </section>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error) && viewState !== "loading"} />
      <ConfirmDialog
        danger
        open={removeConfirmOpen}
        title="确认删除好友？"
        description="删除后会解除好友关系，但共同群聊不会受到影响。"
        confirmLabel="删除好友"
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={() => void removeFriend()}
      />
      <RequestStatusModal
        errorLabel={statusModal?.errorLabel}
        loadingLabel={statusModal?.loadingLabel}
        onAutoClose={() => setStatusModal(null)}
        open={Boolean(statusModal?.open)}
        phase={statusModal?.phase ?? "loading"}
        successLabel={statusModal?.successLabel}
      />
    </AppChrome>
  );
}
