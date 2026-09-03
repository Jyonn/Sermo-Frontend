import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AddFriendDrawer } from "../components/AddFriendDrawer";
import { QuietState } from "../components/BoundaryState";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SideDrawer, drawerPathFromSearch } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { emitFriendRequestsUpdated } from "../lib/friendRequestBadge";
import { formatRelativeTime } from "../lib/presentation";
import { VerificationBanner } from "../components/VerificationBanner";
import { OfficialBadge } from "../components/OfficialBadge";
import { OperatorBadge } from "../components/OperatorBadge";
import { TabPageHeader } from "../components/TabPageHeader";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { AppViewState, ChatDTO, FriendshipRequestDTO, UserDTO } from "../types";
import { i18n, useI18n } from "../lib/language";

const FRIEND_REQUEST_STATUS_PENDING = 0;
const FRIEND_REQUEST_STATUS_ACCEPTED = 1;
const FRIEND_REQUEST_STATUS_REJECTED = 2;
const FRIEND_REQUEST_STATUS_DELETED = 3;

function pendingIncomingCount(rows: FriendshipRequestDTO[]) {
  return rows.filter((request) => request.status === FRIEND_REQUEST_STATUS_PENDING).length;
}

function requestStatus(request: FriendshipRequestDTO, direction: "incoming" | "outgoing") {
  if (request.status === FRIEND_REQUEST_STATUS_PENDING) {
    return { label: i18n.t(direction === "incoming" ? "request.pending" : "request.awaiting"), tone: "pending" };
  }
  if (request.status === FRIEND_REQUEST_STATUS_ACCEPTED) {
    return { label: i18n.t(direction === "incoming" ? "request.accepted" : "request.approved"), tone: "accepted" };
  }
  if (request.status === FRIEND_REQUEST_STATUS_REJECTED) {
    return { label: i18n.t(direction === "incoming" ? "request.ignored" : "request.rejected"), tone: "rejected" };
  }
  if (request.status === FRIEND_REQUEST_STATUS_DELETED) {
    return { label: i18n.t("request.closed"), tone: "closed" };
  }
  return { label: i18n.t("request.handled"), tone: "closed" };
}

function requestSourceLabel(source: string) {
  if (source === "qr") return i18n.t("request.source.qr");
  if (source === "square") return i18n.t("request.source.square");
  if (source === "search") return i18n.t("request.source.search");
  return i18n.t("request.source.direct");
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
  if (user.is_alive) return i18n.t("presence.online");

  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - user.last_heartbeat);
  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 1) return i18n.t("presence.justNow");
  if (minutes < 60) return i18n.t("presence.minutesAgo", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("presence.hoursAgo", { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 30) return i18n.t("presence.daysAgo", { count: days });

  return i18n.t("presence.monthAgo");
}

function notificationChatAvatar(chat: ChatDTO) {
  if (chat.group) {
    return {
      name: chat.title ?? i18n.t("chat.group"),
      uri: undefined,
      groupMembers: chat.members.map((member) => ({
        name: member.name,
        uri: member.avatar_uri,
      })),
    };
  }
  const peer = chat.members[0];
  return {
    name: peer?.name ?? chat.title ?? i18n.t("chat.conversation"),
    uri: peer?.avatar_uri,
    groupMembers: undefined,
  };
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const friendDirectoryRef = useRef<HTMLDivElement | null>(null);
  const friendSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<UserDTO[]>([]);
  const [groupChats, setGroupChats] = useState<ChatDTO[]>([]);
  const [requests, setRequests] = useState<{ incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] }>({
    incoming: [],
    outgoing: [],
  });
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [requestDrawerTab, setRequestDrawerTab] = useState<"incoming" | "outgoing">("incoming");
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [profileDrawerUserId, setProfileDrawerUserId] = useState<number | null>(null);
  const [, setProfileSyncing] = useState(false);
  const [ignoreRequest, setIgnoreRequest] = useState<FriendshipRequestDTO | null>(null);
  const [revokeRequest, setRevokeRequest] = useState<FriendshipRequestDTO | null>(null);
  const [friendIndexNeeded, setFriendIndexNeeded] = useState(false);
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

  useEffect(() => {
    const profileSegment = drawerPathFromSearch(location.search).find((item) => /^user-profile-\d+$/.test(item));
    if (!profileSegment) return;
    const userId = Number(profileSegment.replace("user-profile-", ""));
    if (Number.isFinite(userId) && userId > 0) setProfileDrawerUserId(userId);
  }, [location.search]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readTabCache<{
      friends: UserDTO[];
      groupChats: ChatDTO[];
      requests: { incoming: FriendshipRequestDTO[]; outgoing: FriendshipRequestDTO[] };
    }>(cacheScope, "notifications");
    if (cached) {
      setFriends(cached.data.friends);
      setGroupChats(cached.data.groupChats);
      setRequests(cached.data.requests);
      emitFriendRequestsUpdated(pendingIncomingCount(cached.data.requests.incoming));
      setViewState("ready");
    } else {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    Promise.all([api.getFriends(controller.signal), api.getFriendRequests(controller.signal), api.getChats(controller.signal)])
      .then(([friendRows, requestRows, chatRows]) => {
        setFriends(friendRows);
        setRequests(requestRows);
        emitFriendRequestsUpdated(pendingIncomingCount(requestRows.incoming));
        setGroupChats(chatRows.filter((chat) => chat.group));
        writeTabCache(cacheScope, "notifications", {
          friends: friendRows,
          requests: requestRows,
          groupChats: chatRows.filter((chat) => chat.group),
        });
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached) {
          const message = apiError instanceof ApiError ? apiError.message : t("contacts.loadFailed");
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
    writeTabCache(cacheScope, "notifications", { friends, groupChats, requests });
  }, [cacheScope, friends, groupChats, requests, viewState]);

  const filteredFriends = friends;
  const friendSections = useMemo(() => groupFriends(filteredFriends), [filteredFriends]);
  const filteredIncoming = requests.incoming;
  const filteredOutgoing = requests.outgoing;
  const filteredGroups = groupChats;

  const pendingRequestCount = pendingIncomingCount(requests.incoming);

  useEffect(() => {
    const directory = friendDirectoryRef.current;
    if (!directory || !friendSections.length) {
      setFriendIndexNeeded(false);
      return;
    }

    const update = () => {
      const rect = directory.getBoundingClientRect();
      const bottomNavigationAllowance = window.matchMedia("(max-width: 767px)").matches ? 88 : 24;
      const availableHeight = Math.max(0, window.innerHeight - Math.max(0, rect.top) - bottomNavigationAllowance);
      setFriendIndexNeeded(rect.height > availableHeight + 24);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(directory);
    window.addEventListener("resize", update);
    const frame = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [friendSections]);

  const actOnRequest = async (userId: number, accept: boolean) => {
    try {
      await api.respondFriendRequest(userId, accept);
      const refreshed = await api.getFriendRequests();
      setRequests(refreshed);
      emitFriendRequestsUpdated(pendingIncomingCount(refreshed.incoming));
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("request.handleFailed");
      setError(message);
    }
  };

  const revokeOutgoingRequest = async (userId: number) => {
    try {
      await api.removeFriendRequest(userId);
      const refreshed = await api.getFriendRequests();
      setRequests(refreshed);
      emitFriendRequestsUpdated(pendingIncomingCount(refreshed.incoming));
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : t("request.revokeFailed");
      setError(message);
    }
  };

  const scrollToFriendSection = (key: string) => {
    friendSectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppChrome title={t("contacts.title")} hideTopbar shellClassName="desktop-tab-shell">
      <section className="page-stack">
        <TabPageHeader title={t("contacts.title")} syncing={syncing} actions={<button aria-label={t("friendSearch.title")} className="tab-header-action" onClick={() => setAddFriendOpen(true)} type="button"><span className="material-symbols-outlined">person_add</span></button>} />
        <VerificationBanner hasPassword={Boolean(session?.user?.has_password)} verified={Boolean(session?.user?.verified)} />

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row communication-entry-row" onClick={() => setRequestSheetOpen(true)} type="button">
              <div className="row-icon notification-icon live">
                <span className="material-symbols-outlined">person_add</span>
              </div>
              <div className="row-main">
                <strong>{t("contacts.requests")}</strong>
                <div className="row-subtle">{pendingRequestCount ? t("contacts.pending", { count: pendingRequestCount }) : t("contacts.noRequests")}</div>
              </div>
              {pendingRequestCount ? <span className="small-badge">{pendingRequestCount}</span> : <span className="material-symbols-outlined chevron-inline">chevron_right</span>}
            </button>

            <button className="simple-row communication-entry-row" onClick={() => setGroupSheetOpen(true)} type="button">
              <div className="row-icon notification-icon success">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div className="row-main">
                <strong>{t("contacts.groups")}</strong>
                <div className="row-subtle">{groupChats.length ? t("contacts.groupCount", { count: groupChats.length }) : t("contacts.noGroups")}</div>
              </div>
              <span className="material-symbols-outlined chevron-inline">chevron_right</span>
            </button>
          </div>
        </section>

        <section className="list-section">
          <div className="friend-directory" ref={friendDirectoryRef}>
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
                        onClick={() => setProfileDrawerUserId(friend.user_id)}
                        type="button"
                      >
                        <UserAvatar
                          className={`mini-avatar friend-avatar-neutral ${friend.is_alive ? "status-online" : ""}`}
                          name={friend.name}
                          uri={friend.avatar_uri}
                        />
                        <div className="row-main">
                          <div className="person-name-row">
                            <strong>{friend.name}</strong>
                            {friend.official ? <OfficialBadge /> : null}
                            {friend.operator ? <OperatorBadge /> : null}
                          </div>
                          <div className="row-subtle">{formatLastSeen(friend)}</div>
                        </div>
                        <span className="material-symbols-outlined chevron-inline">chevron_right</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {friendIndexNeeded && !requestSheetOpen && !groupSheetOpen && profileDrawerUserId === null ? (
              <div className="friend-directory-index" aria-label={t("contacts.friendIndex")}>
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
          <QuietState icon="person_add" title={t("contacts.noFriends")} description={t("contacts.noFriendsHint")} />
        ) : null}
      </section>

      <SideDrawer
        historyKey="friend-requests"
        onRouteOpen={() => setRequestSheetOpen(true)}
        open={requestSheetOpen}
        title={t("contacts.requests")}
        onClose={() => setRequestSheetOpen(false)}
      >
        <div className="friend-request-drawer">
          <div className="friend-request-tabs" role="tablist">
            <button className={requestDrawerTab === "incoming" ? "active" : ""} onClick={() => setRequestDrawerTab("incoming")} role="tab" type="button">
              {t("request.incoming")}{filteredIncoming.length ? ` ${filteredIncoming.length}` : ""}
            </button>
            <button className={requestDrawerTab === "outgoing" ? "active" : ""} onClick={() => setRequestDrawerTab("outgoing")} role="tab" type="button">
              {t("request.outgoing")}{filteredOutgoing.length ? ` ${filteredOutgoing.length}` : ""}
            </button>
          </div>
          {requestDrawerTab === "incoming" ? filteredIncoming.length ? (
            <div className="simple-list friend-request-list">
              {filteredIncoming.map((request) => (
                <div key={request.request_id} className="simple-row request-row friend-request-card">
                  <UserAvatar className="mini-avatar" name={request.from_user.name} uri={request.from_user.avatar_uri} />
                  <div className="row-main">
                    <strong>{request.from_user.name}</strong>
                    <div className="row-subtle">{t("request.source", { source: requestSourceLabel(request.source) })} · {formatRelativeTime(request.responded_at ?? request.updated_at)}</div>
                  </div>
                  {request.status === FRIEND_REQUEST_STATUS_PENDING ? (
                    <div className="row-actions">
                      <button className="button row-button friend-request-accept" onClick={() => void actOnRequest(request.from_user.user_id, true)} type="button">
                        {t("request.accept")}
                      </button>
                      <button className="ghost-button row-button" onClick={() => setIgnoreRequest(request)} type="button">
                        {t("request.ignore")}
                      </button>
                    </div>
                  ) : (
                    <span className={`friend-request-status is-${requestStatus(request, "incoming").tone}`}>
                      {requestStatus(request, "incoming").label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : <QuietState icon="inbox" title={t("request.noIncoming")} /> : filteredOutgoing.length ? (
            <div className="simple-list friend-request-list">
              {filteredOutgoing.map((request) => (
                <div key={request.request_id} className="simple-row request-row friend-request-card">
                  <UserAvatar className="mini-avatar" name={request.to_user.name} uri={request.to_user.avatar_uri} />
                  <div className="row-main">
                    <strong>{request.to_user.name}</strong>
                    <div className="row-subtle">{t("request.source", { source: requestSourceLabel(request.source) })} · {formatRelativeTime(request.responded_at ?? request.updated_at)}</div>
                  </div>
                  {request.status === FRIEND_REQUEST_STATUS_PENDING ? (
                    <button className="ghost-button row-button" onClick={() => setRevokeRequest(request)} type="button">
                      {t("request.withdraw")}
                    </button>
                  ) : (
                    <span className={`friend-request-status is-${requestStatus(request, "outgoing").tone}`}>
                      {requestStatus(request, "outgoing").label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : <QuietState icon="outbox" title={t("request.noOutgoing")} />}
        </div>
      </SideDrawer>
      <ConfirmDialog
        danger
        open={Boolean(ignoreRequest)}
        title={t("request.ignoreTitle")}
        description={ignoreRequest ? t("request.ignoreDescription", { name: ignoreRequest.from_user.name }) : ""}
        confirmLabel={t("request.ignoreConfirm")}
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
        title={t("request.withdrawTitle")}
        description={revokeRequest ? t("request.withdrawDescription", { name: revokeRequest.to_user.name }) : ""}
        confirmLabel={t("request.withdrawConfirm")}
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
        historyKey="groups"
        onRouteOpen={() => setGroupSheetOpen(true)}
        open={groupSheetOpen}
        title={t("contacts.groups")}
        onClose={() => setGroupSheetOpen(false)}
      >
        <section className="list-section">
          <div className="section-label">{t("contacts.groupJoined")}</div>
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
                      <strong>{chat.title ?? t("contacts.unnamedGroup")}</strong>
                      <div className="row-subtle">{chat.last_message?.content || t("contacts.groupContinue")}</div>
                    </div>
                    <span className="count-badge">{t("contacts.memberCount", { count: chat.members.length })}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <QuietState icon="group_add" title={t("contacts.noGroups")} description={t("contacts.noGroupHint")} />
          )}
        </section>
      </SideDrawer>

      <SideDrawer
        headerless
        historyKey={`user-profile-${profileDrawerUserId ?? "user"}`}
        open={profileDrawerUserId !== null}
        title={profileDrawerUserId === session?.user.user_id ? t("profile.myCard") : t("contacts.userDetails")}
        onClose={() => setProfileDrawerUserId(null)}
      >
        {profileDrawerUserId !== null ? (
          <UserProfilePanel
            key={profileDrawerUserId}
            userId={profileDrawerUserId}
            initialUser={friends.find((friend) => friend.user_id === profileDrawerUserId)}
            initialIsFriend
            onSyncingChange={setProfileSyncing}
            onOpenChat={(chatId) => {
              window.history.replaceState({ ...window.history.state, sermoDrawerStack: [] }, "");
              setProfileDrawerUserId(null);
              navigate(`/app/chats/${chatId}`);
            }}
          />
        ) : null}
      </SideDrawer>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <AddFriendDrawer onRouteOpen={() => setAddFriendOpen(true)} onClose={() => setAddFriendOpen(false)} open={addFriendOpen} />
    </AppChrome>
  );
}
