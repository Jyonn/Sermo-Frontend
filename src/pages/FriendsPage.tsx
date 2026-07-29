import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { emitFriendRequestsUpdated } from "../lib/friendRequestBadge";
import { formatRelativeTime } from "../lib/presentation";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { showToast } from "../lib/toast";
import type { AppViewState, FriendAccepted, FriendTab, FriendshipRequestDTO, UserDTO } from "../types";
import { i18n, useI18n } from "../lib/language";

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
    status: user.is_alive ? i18n.t("presence.online") : i18n.t("presence.offline"),
    mood: user.verified ? i18n.t("friends.verifiedMember") : i18n.t("friends.member"),
    verified: user.verified,
  };
}

function requestName(request: FriendshipRequestDTO, tab: FriendTab) {
  return tab === "incoming" ? request.from_user.name : request.to_user.name;
}

export default function FriendsPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [tab, setTab] = useState<FriendTab>(tabFromPath(location.pathname));
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendAccepted[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRequestDTO[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRequestDTO[]>([]);
  const [sheetFriend, setSheetFriend] = useState<FriendAccepted | null>(null);
  const [sheetRequest, setSheetRequest] = useState<FriendshipRequestDTO | null>(null);
  const [ignoreRequest, setIgnoreRequest] = useState<FriendshipRequestDTO | null>(null);
  const [revokeRequest, setRevokeRequest] = useState<FriendshipRequestDTO | null>(null);
  const [requestActionUserId, setRequestActionUserId] = useState<number | null>(null);
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

  useEffect(() => {
    if (location.pathname === "/app/friends") setTab("accepted");
    if (location.pathname === "/app/friends/requests") setTab("incoming");
  }, [location.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readTabCache<{
      friends: FriendAccepted[];
      incoming: FriendshipRequestDTO[];
      outgoing: FriendshipRequestDTO[];
    }>(cacheScope, "friends");
    if (cached) {
      setFriends(cached.data.friends);
      setIncoming(cached.data.incoming);
      setOutgoing(cached.data.outgoing);
      setViewState("ready");
    } else {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    Promise.all([api.getFriends(controller.signal), api.getFriendRequests(controller.signal)])
      .then(([friendRows, requestRows]) => {
        const normalizedRequests = normalizePendingRequests(requestRows);
        const nextFriends = friendRows.map(mapFriend);
        setFriends(nextFriends);
        setIncoming(normalizedRequests.incoming);
        setOutgoing(normalizedRequests.outgoing);
        writeTabCache(cacheScope, "friends", {
          friends: nextFriends,
          incoming: normalizedRequests.incoming,
          outgoing: normalizedRequests.outgoing,
        });
        emitFriendRequestsUpdated(normalizedRequests.incoming.length);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached) {
          const message = apiError instanceof ApiError ? apiError.message : t("friends.loadFailed");
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope]);

  useEffect(() => {
    if (viewState !== "ready") return;
    writeTabCache(cacheScope, "friends", { friends, incoming, outgoing });
  }, [cacheScope, friends, incoming, outgoing, viewState]);

  const activeRequests = useMemo(() => {
    if (tab === "incoming") return incoming;
    if (tab === "outgoing") return outgoing;
    return [];
  }, [incoming, outgoing, tab]);

  const actOnRequest = async (userId: number, accept?: boolean) => {
    try {
      setRequestActionUserId(userId);
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
      showToast(accept === undefined ? t("friends.withdrawn") : accept ? t("friends.added") : t("friends.ignored"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("friends.actionFailed"), "error");
    } finally {
      setRequestActionUserId(null);
    }
  };

  const startDirectChat = async (userId: number) => {
    try {
      const chat = await api.createDirectChat(userId);
      navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("profile.chatFailed");
      setError(message);
    }
  };

  return (
    <AppChrome title={t("friends.title")} hideTopbar>
      <section className="page-stack">
        <div className="page-tabs">
          <Link className={`tab-chip ${tab === "incoming" ? "active" : ""}`} to="/app/friends/requests">
            {t("request.incoming")} {incoming.length ? `(${incoming.length})` : ""}
          </Link>
          <button className={`tab-chip ${tab === "outgoing" ? "active" : ""}`} onClick={() => setTab("outgoing")} type="button">
            {t("request.outgoing")} {outgoing.length ? `(${outgoing.length})` : ""}
          </button>
          <Link className={`tab-chip ${tab === "accepted" ? "active" : ""}`} to="/app/friends">
            {t("friends.title")} {friends.length ? `(${friends.length})` : ""}
          </Link>
          <HeaderSyncIndicator syncing={syncing} />
        </div>

        {tab === "accepted" ? (
          <section className="list-section">
            <div className="simple-list">
              {friends.map((friend) => (
                <div key={friend.id} className="simple-row person-row">
                  <UserAvatar
                    className={`mini-avatar friend-avatar-neutral ${friend.status === t("presence.online") ? "status-online" : ""}`}
                    name={friend.name}
                    uri={friend.avatarUri}
                  />
                  <div className="row-main">
                    <strong>{friend.name}</strong>
                    <div className="row-subtle">{friend.status}</div>
                  </div>
                  <button className="ghost-button row-button" onClick={() => void startDirectChat(friend.id)} type="button">
                    {t("profile.message")}
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
                      <button className="button row-button" disabled={requestActionUserId === request.from_user.user_id} onClick={() => void actOnRequest(request.from_user.user_id, true)} type="button">
                        {requestActionUserId === request.from_user.user_id ? t("request.processing") : t("request.accept")}
                      </button>
                      <button className="icon-button" onClick={() => setSheetRequest(request)} type="button">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  ) : (
                    <button className="ghost-button row-button" onClick={() => setRevokeRequest(request)} type="button">
                      {t("request.withdraw")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!friends.length && tab === "accepted" && viewState === "ready" ? (
          <FeedbackState
            title={t("friends.empty")}
            description={t("friends.emptyHint")}
            action={
              <Link className="button" to="/app/space-users/online">
                {t("friends.openMembers")}
              </Link>
            }
          />
        ) : null}

        {!activeRequests.length && tab !== "accepted" && viewState === "ready" ? (
          <FeedbackState
            title={tab === "incoming" ? t("request.noIncoming") : t("request.noOutgoing")}
            description={tab === "incoming" ? t("request.noIncomingHint") : t("request.noOutgoingHint")}
            action={
              <Link className="button" to="/app/space-users">
                {t("friends.openMembers")}
              </Link>
            }
          />
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(sheetFriend || sheetRequest)}
        title={sheetFriend?.name ?? (sheetRequest ? requestName(sheetRequest, tab === "accepted" ? "incoming" : tab) : t("common.more"))}
        onClose={() => {
          setSheetFriend(null);
          setSheetRequest(null);
        }}
      >
        {sheetFriend ? (
          <div className="sheet-action-list">
            <button className="button" onClick={() => void startDirectChat(sheetFriend.id)} type="button">
              {t("profile.message")}
            </button>
            <Link className="ghost-button" to="/app/space-users/online">
              {t("friends.openMembers")}
            </Link>
          </div>
        ) : null}

        {sheetRequest ? (
          <div className="sheet-action-list">
            {tab === "incoming" ? (
              <>
                <button className="button" disabled={requestActionUserId === sheetRequest.from_user.user_id} onClick={() => void actOnRequest(sheetRequest.from_user.user_id, true)} type="button">
                  {requestActionUserId === sheetRequest.from_user.user_id ? t("request.processing") : t("request.accept")}
                </button>
                <button className="ghost-button" onClick={() => setIgnoreRequest(sheetRequest)} type="button">
                  {t("request.ignore")}
                </button>
              </>
            ) : (
              <button className="danger-button" onClick={() => setRevokeRequest(sheetRequest)} type="button">
                {t("request.withdrawRequest")}
              </button>
            )}
          </div>
        ) : null}
      </BottomSheet>
      <ConfirmDialog
        danger
        open={Boolean(ignoreRequest)}
        title={t("request.ignoreConfirmTitle")}
        description={ignoreRequest ? t("request.ignoreConfirmHint", { name: ignoreRequest.from_user.name }) : ""}
        confirmLabel={t("request.confirmIgnore")}
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
        title={t("request.withdrawConfirmTitle")}
        description={revokeRequest ? t("request.withdrawConfirmHint", { name: revokeRequest.to_user.name }) : ""}
        confirmLabel={t("request.confirmWithdraw")}
        onClose={() => setRevokeRequest(null)}
        onConfirm={() => {
          const targetUserId = revokeRequest?.to_user.user_id;
          setRevokeRequest(null);
          if (targetUserId) {
            void actOnRequest(targetUserId);
          }
        }}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
