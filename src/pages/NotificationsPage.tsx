import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { confirmDangerAction, formatRelativeTime } from "../lib/presentation";
import type { AppViewState, ChatDTO, FriendshipRequestDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatDTO[]>([]);
  const [requests, setRequests] = useState<{ incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }>({
    incoming: [],
    outgoing: [],
  });
  const [requestSheet, setRequestSheet] = useState<FriendshipRequestDTO | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([api.getChats(controller.signal), api.getFriendRequests(controller.signal)])
      .then(([chatRows, requestRows]) => {
        setChats(chatRows);
        setRequests(requestRows);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "通知加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, []);

  const unreadChats = useMemo(() => chats.filter((chat) => (chat.unread_count ?? 0) > 0), [chats]);
  const totalCount = requests.incoming.length + unreadChats.length;

  const actOnRequest = async (requestId: number, accept: boolean) => {
    if (!accept && !confirmDangerAction("确认忽略这条好友申请？")) return;

    try {
      await api.respondFriendRequest(requestId, accept);
      const refreshed = await api.getFriendRequests();
      setRequests(refreshed);
      setRequestSheet(null);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "处理申请失败";
      setError(message);
    }
  };

  return (
    <AppChrome title="通知" hideTopbar>
      <section className="page-stack">
        <div className="page-toolbar">
          <strong>{totalCount ? `${totalCount} 条更新` : "通知"}</strong>
          {totalCount ? <span className="presence-badge">{totalCount}</span> : null}
        </div>

        {viewState === "loading" ? <FeedbackState title="通知加载中" description="正在同步未读消息和好友申请。" tone="loading" /> : null}
        {requests.incoming.length ? (
          <section className="list-section">
            <div className="section-label">好友申请</div>
            <div className="simple-list">
              {requests.incoming.map((request) => (
                <button key={request.request_id} className="simple-row notification-row" onClick={() => setRequestSheet(request)} type="button">
                  <div className="mini-avatar">{avatarLabel(request.from_user.name)}</div>
                  <div className="row-main">
                    <strong>{request.from_user.name}</strong>
                    <div className="row-subtle">{formatRelativeTime(request.updated_at)}</div>
                  </div>
                  <span className="small-badge">新申请</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {unreadChats.length ? (
          <section className="list-section">
            <div className="section-label">未读消息</div>
            <div className="simple-list">
              {unreadChats.map((chat) => (
                <button key={chat.chat_id} className="simple-row notification-row" onClick={() => navigate(`/app/chats/${chat.chat_id}`)} type="button">
                  <div className="row-icon">
                    <span className="material-symbols-outlined">chat_bubble</span>
                  </div>
                  <div className="row-main">
                    <strong>{chat.title ?? "未命名会话"}</strong>
                    <div className="row-subtle">{chat.last_message?.content || "点进去继续聊"}</div>
                  </div>
                  <span className="small-badge">{chat.unread_count}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!requests.incoming.length && !unreadChats.length && viewState === "ready" ? (
          <FeedbackState
            title="现在没有新通知"
            description="有新消息或好友申请时，这里会直接出现。"
            action={
              <Link className="button" to="/app/square">
                去广场
              </Link>
            }
          />
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(requestSheet)}
        title={requestSheet ? requestSheet.from_user.name : "好友申请"}
        description="处理这条申请"
        onClose={() => setRequestSheet(null)}
      >
        {requestSheet ? (
          <div className="detail-list">
            <div className="simple-sheet-user">
              <div className="mini-avatar">{avatarLabel(requestSheet.from_user.name)}</div>
              <div>
                <strong>{requestSheet.from_user.name}</strong>
                <div className="row-subtle">{formatRelativeTime(requestSheet.updated_at)} 发起</div>
              </div>
            </div>
            <div className="sheet-action-list">
              <button className="button" onClick={() => void actOnRequest(requestSheet.request_id, true)} type="button">
                同意
              </button>
              <button className="ghost-button" onClick={() => void actOnRequest(requestSheet.request_id, false)} type="button">
                忽略
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
