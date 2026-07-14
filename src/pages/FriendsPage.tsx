import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { RequestStatusModal } from "../components/RequestStatusModal";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { emitFriendRequestsUpdated } from "../lib/friendRequestBadge";
import { formatRelativeTime } from "../lib/presentation";
import type { AppViewState, FriendAccepted, FriendTab, FriendshipRequestDTO, UserDTO } from "../types";

const FRIEND_REQUEST_STATUS_PENDING = 0;

function normalizePendingRequests(rows: { incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }) {
  return {
    incoming: rows.incoming.filter((request) => request.status === FRIEND_REQUEST_STATUS_PENDING),
    outgoing: rows.outgoing.filter((request) => request.status === FRIEND_REQUEST_STATUS_PENDING),
  };
}

function tabFromPath(pathname: string): FriendTab {
  return pathname === "/app/friends" ? "accepted" : "incoming";
}

function mapFriend(user: UserDTO): FriendAccepted {
  return {
    id: user.user_id,
    name: user.name,
    avatarUri: user.avatar_uri,
    status: user.is_alive ? "在线" : "离线",
    mood: user.verified ? "已验证成员" : "成员",
    verified: user.verified,
  };
}

function requestName(request: FriendshipRequestDTO, tab: FriendTab) {
  return tab === "incoming" ? request.from_user.name : request.to_user.name;
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
  const [sheetFriend, setSheetFriend] = useState<FriendAccepted | null>(null);
  const [sheetRequest, setSheetRequest] = useState<FriendshipRequestDTO | null>(null);
  const [ignoreRequest, setIgnoreRequest] = useState<FriendshipRequestDTO | null>(null);
  const [revokeRequest, setRevokeRequest] = useState<FriendshipRequestDTO | null>(null);
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    phase: "loading" | "success" | "error";
    loadingLabel: string;
    successLabel: string;
    errorLabel: string;
  } | null>(null);

  useEffect(() => {
    if (location.pathname === "/app/friends") setTab("accepted");
    if (location.pathname === "/app/friends/requests") setTab("incoming");
  }, [location.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([api.getFriends(controller.signal), api.getFriendRequests(controller.signal)])
      .then(([friendRows, requestRows]) => {
        const normalizedRequests = normalizePendingRequests(requestRows);
        setFriends(friendRows.map(mapFriend));
        setIncoming(normalizedRequests.incoming);
        setOutgoing(normalizedRequests.outgoing);
        emitFriendRequestsUpdated(normalizedRequests.incoming.length);
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

  const actOnRequest = async (userId: number, accept?: boolean) => {
    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: accept === undefined ? "正在撤回申请" : accept ? "正在同意申请" : "正在忽略申请",
      successLabel: accept === undefined ? "申请已撤回" : accept ? "已添加为好友" : "已忽略申请",
      errorLabel: "操作失败",
    });

    try {
      if (accept === undefined) await api.removeFriendRequest(userId);
      else await api.respondFriendRequest(userId, accept);

      const requests = normalizePendingRequests(await api.getFriendRequests());
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
      emitFriendRequestsUpdated(requests.incoming.length);
      if (accept) {
        const refreshedFriends = await api.getFriends();
        setFriends(refreshedFriends.map(mapFriend));
      }
      setSheetRequest(null);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "操作失败",
            }
          : null
      );
    }
  };

  const startDirectChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "发起私聊失败";
      setError(message);
    }
  };

  return (
    <AppChrome title="好友" hideTopbar>
      <section className="page-stack">
        <div className="page-tabs">
          <Link className={`tab-chip ${tab === "incoming" ? "active" : ""}`} to="/app/friends/requests">
            收到的 {incoming.length ? `(${incoming.length})` : ""}
          </Link>
          <button className={`tab-chip ${tab === "outgoing" ? "active" : ""}`} onClick={() => setTab("outgoing")} type="button">
            发出的 {outgoing.length ? `(${outgoing.length})` : ""}
          </button>
          <Link className={`tab-chip ${tab === "accepted" ? "active" : ""}`} to="/app/friends">
            好友 {friends.length ? `(${friends.length})` : ""}
          </Link>
        </div>

        {viewState === "loading" ? <FeedbackState title="好友加载中" description="正在同步好友和申请。" tone="loading" /> : null}
        {tab === "accepted" ? (
          <section className="list-section">
            <div className="simple-list">
              {friends.map((friend) => (
                <div key={friend.id} className="simple-row person-row">
                  <UserAvatar
                    className={`mini-avatar friend-avatar-neutral ${friend.status === "在线" ? "status-online" : ""}`}
                    name={friend.name}
                    uri={friend.avatarUri}
                  />
                  <div className="row-main">
                    <strong>{friend.name}</strong>
                    <div className="row-subtle">{friend.status}</div>
                  </div>
                  <button className="ghost-button row-button" onClick={() => void startDirectChat(friend.id)} type="button">
                    发消息
                  </button>
                  <button className="icon-button row-trailing-button" onClick={() => setSheetFriend(friend)} type="button">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="list-section">
            <div className="simple-list">
              {activeRequests.map((request) => (
                <div key={request.request_id} className="simple-row request-row">
                  <UserAvatar
                    className="mini-avatar"
                    name={requestName(request, tab)}
                    uri={tab === "incoming" ? request.from_user.avatar_uri : request.to_user.avatar_uri}
                  />
                  <div className="row-main">
                    <strong>{requestName(request, tab)}</strong>
                    <div className="row-subtle">{formatRelativeTime(request.updated_at)}</div>
                  </div>
                  {tab === "incoming" ? (
                    <div className="row-actions">
                      <button className="button row-button" onClick={() => void actOnRequest(request.from_user.user_id, true)} type="button">
                        同意
                      </button>
                      <button className="icon-button" onClick={() => setSheetRequest(request)} type="button">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  ) : (
                    <button className="ghost-button row-button" onClick={() => setRevokeRequest(request)} type="button">
                      撤回
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!friends.length && tab === "accepted" && viewState === "ready" ? (
          <FeedbackState
            title="还没有好友"
            description="从成员里开始第一段对话后，再把想保留的人加进来。"
            action={
              <Link className="button" to="/app/space-users/online">
                去成员页
              </Link>
            }
          />
        ) : null}

        {!activeRequests.length && tab !== "accepted" && viewState === "ready" ? (
          <FeedbackState
            title={tab === "incoming" ? "没有待处理申请" : "你还没发出申请"}
            description={tab === "incoming" ? "有新的好友申请时，这里会直接出现。" : "想主动建立关系时，先去成员页。"}
            action={
              <Link className="button" to="/app/space-users">
                去成员页
              </Link>
            }
          />
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(sheetFriend || sheetRequest)}
        title={sheetFriend?.name ?? (sheetRequest ? requestName(sheetRequest, tab === "accepted" ? "incoming" : tab) : "更多")}
        description="选择一个动作"
        onClose={() => {
          setSheetFriend(null);
          setSheetRequest(null);
        }}
      >
        {sheetFriend ? (
          <div className="sheet-action-list">
            <button className="button" onClick={() => void startDirectChat(sheetFriend.id)} type="button">
              发消息
            </button>
            <Link className="ghost-button" to="/app/space-users/online">
              去成员页
            </Link>
          </div>
        ) : null}

        {sheetRequest ? (
          <div className="sheet-action-list">
            {tab === "incoming" ? (
              <>
                <button className="button" onClick={() => void actOnRequest(sheetRequest.from_user.user_id, true)} type="button">
                  同意
                </button>
                <button className="ghost-button" onClick={() => setIgnoreRequest(sheetRequest)} type="button">
                  忽略
                </button>
              </>
            ) : (
              <button className="danger-button" onClick={() => setRevokeRequest(sheetRequest)} type="button">
                撤回申请
              </button>
            )}
          </div>
        ) : null}
      </BottomSheet>
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
            void actOnRequest(targetUserId);
          }
        }}
      />
      <RequestStatusModal
        open={Boolean(statusModal?.open)}
        phase={statusModal?.phase ?? "loading"}
        loadingLabel={statusModal?.loadingLabel}
        successLabel={statusModal?.successLabel}
        errorLabel={statusModal?.errorLabel}
        onAutoClose={() => setStatusModal(null)}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
