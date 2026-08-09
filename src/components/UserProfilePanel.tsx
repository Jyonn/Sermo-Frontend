import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncErrorDialog } from "./AsyncErrorDialog";
import { AvatarPreviewDrawer } from "./AvatarPreviewDrawer";
import { BottomSheet } from "./BottomSheet";
import { QuietState } from "./BoundaryState";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";
import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatRelativeTime } from "../lib/presentation";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { showToast } from "../lib/toast";
import type { AppViewState, ChatDTO, UserDTO, UserMeDTO } from "../types";
import { i18n, useI18n } from "../lib/language";

export interface UserProfileSeed {
  user_id: number;
  name: string;
  official?: boolean;
  avatar_uri?: string;
  is_alive?: boolean;
  last_heartbeat?: number;
  is_permanent_vip?: boolean;
  growth_level?: number;
  growth_level_name?: string;
  avatar_frame_style?: UserDTO["avatar_frame_style"];
}

interface UserProfilePanelProps {
  userId: number;
  initialUser?: UserProfileSeed | null;
  initialIsFriend?: boolean;
  onSyncingChange?: (syncing: boolean) => void;
  onOpenChat?: (chatId: number) => void;
}

interface UserProfileCacheSnapshot {
  user: UserDTO;
  groupChats: ChatDTO[];
  isFriend: boolean;
  respondedAt: number | null;
}

function friendshipAge(respondedAt?: number | null) {
  if (!respondedAt) return i18n.t("profile.friend");
  const days = Math.max(1, Math.floor((Date.now() / 1000 - respondedAt) / 86400));
  return days < 30 ? i18n.t("profile.knownDays", { count: days }) : i18n.t("profile.knownMonths", { count: Math.floor(days / 30) });
}

export function UserProfilePanel({ userId, initialUser, initialIsFriend, onSyncingChange, onOpenChat }: UserProfilePanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = useAuth();
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);
  const initialCached = useMemo(
    () => readTabCache<UserProfileCacheSnapshot>(cacheScope, `user-profile:${userId}`)?.data ?? null,
    [cacheScope, userId]
  );
  const syncingCallbackRef = useRef(onSyncingChange);
  syncingCallbackRef.current = onSyncingChange;
  const [viewState, setViewState] = useState<AppViewState>(initialCached || initialUser ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | UserProfileSeed | null>(initialCached?.user ?? initialUser ?? null);
  const [groupChats, setGroupChats] = useState<ChatDTO[]>(initialCached?.groupChats ?? []);
  const [allGroupsOpen, setAllGroupsOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupCandidates, setGroupCandidates] = useState<UserProfileSeed[]>([]);
  const [groupCandidatesLoading, setGroupCandidatesLoading] = useState(false);
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [groupCreating, setGroupCreating] = useState(false);
  const [isFriend, setIsFriend] = useState<boolean | null>(initialCached?.isFriend ?? initialIsFriend ?? null);
  const [respondedAt, setRespondedAt] = useState<number | null>(initialCached?.respondedAt ?? null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "sent">("idle");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [currentUserMe, setCurrentUserMe] = useState<UserMeDTO | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readTabCache<UserProfileCacheSnapshot>(cacheScope, `user-profile:${userId}`)?.data ?? null;
    setUser(cached?.user ?? initialUser ?? null);
    setGroupChats(cached?.groupChats ?? []);
    setIsFriend(cached?.isFriend ?? initialIsFriend ?? null);
    setRespondedAt(cached?.respondedAt ?? null);
    setViewState(cached || initialUser ? "ready" : "loading");
    setError(null);
    syncingCallbackRef.current?.(true);
    Promise.all([
      api.getFriends(controller.signal),
      api.getChats(controller.signal),
      api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal),
      api.getFriendStatus(userId, controller.signal),
    ])
      .then(([friends, chats, users, status]) => {
        const matchedFriend = friends.find((row) => row.user_id === userId) ?? null;
        const matchedUser = matchedFriend ?? users.find((row) => row.user_id === userId) ?? null;
        if (!matchedUser) throw new Error(t("profile.userMissing"));
        setUser(matchedUser);
        setIsFriend(status.is_friend);
        const nextRespondedAt = status.friendship?.responded_at ?? matchedFriend?.responded_at ?? null;
        const nextGroupChats = chats.filter((chat) => chat.group && chat.members.some((member) => member.user_id === userId));
        setRespondedAt(nextRespondedAt);
        setGroupChats(nextGroupChats);
        writeTabCache(cacheScope, `user-profile:${userId}`, {
          user: matchedUser,
          groupChats: nextGroupChats,
          isFriend: status.is_friend,
          respondedAt: nextRespondedAt,
        });
        setRequestState("idle");
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError || apiError instanceof Error ? apiError.message : t("profile.loadFailed");
        if (!cached && !initialUser) {
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) syncingCallbackRef.current?.(false);
      });
    api.getUserMe(controller.signal).then(setCurrentUserMe).catch(() => undefined);
    return () => {
      controller.abort();
      syncingCallbackRef.current?.(false);
    };
  }, [cacheScope, userId]);

  const presence = useMemo(() => {
    if (!user) return "";
    return user.is_alive ? t("profile.onlineNow") : user.last_heartbeat ? t("profile.lastActive", { time: formatRelativeTime(user.last_heartbeat) }) : t("profile.offline");
  }, [user]);
  const createGroupCapability = currentUserMe?.growth?.capabilities?.create_group;
  const canCreateGroup = createGroupCapability?.available ?? false;

  const openChat = async () => {
    if (!user) return;
    try {
      const chat = await api.createDirectChat(user.user_id);
      if (onOpenChat) onOpenChat(chat.chat_id);
      else navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("profile.chatFailed"));
    }
  };

  const openStatements = () => {
    if (!user) return;
    const params = new URLSearchParams({ user_id: String(user.user_id), user_name: user.name });
    navigate(`/app/square?${params.toString()}`);
  };

  const openGroupPicker = async () => {
    if (!user) return;
    if (!canCreateGroup) {
      showToast(t("profile.groupLevelRequired", { level: createGroupCapability?.required_level ?? 4 }), "error");
      return;
    }
    setGroupSelectedIds([user.user_id]);
    setGroupCandidates([user]);
    setGroupCandidatesLoading(true);
    setGroupPickerOpen(true);
    try {
      const friends = await api.getFriends();
      setGroupCandidates([user, ...friends.filter((friend) => friend.user_id !== user.user_id)]);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("friends.loadFailed"));
    } finally {
      setGroupCandidatesLoading(false);
    }
  };

  const createGroupChat = async () => {
    if (!user || groupSelectedIds.length < 2 || groupCreating) return;
    setGroupCreating(true);
    try {
      const me = await api.getUserMe();
      const capability = me.growth?.capabilities?.create_group;
      if (capability && !capability.available) {
        showToast(t("profile.groupLevelRequired", { level: capability.required_level }), "error");
        return;
      }
      const chat = await api.createGroupChat(groupSelectedIds);
      setGroupPickerOpen(false);
      showToast(t("profile.groupCreated"));
      if (onOpenChat) onOpenChat(chat.chat_id);
      else navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("profile.groupFailed"), "error");
    } finally {
      setGroupCreating(false);
    }
  };

  const renderGroupRow = (chat: ChatDTO) => (
    <button key={chat.chat_id} className="user-profile-group-row" onClick={() => (onOpenChat ? onOpenChat(chat.chat_id) : navigate(`/app/chats/${chat.chat_id}`))} type="button">
      <UserAvatar className="mini-avatar" groupMembers={chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri }))} name={chat.title ?? t("chat.group")} />
      <span><strong>{chat.title ?? t("chat.unnamedGroup")}</strong><small>{t("chat.memberCount", { count: chat.members.length })}</small></span>
      <span className="material-symbols-outlined">chevron_right</span>
    </button>
  );

  const sendRequest = async () => {
    if (!user || requestState !== "idle") return;
    setRequestState("sending");
    try {
      await api.createFriendRequest(user.user_id);
      setRequestState("sent");
      showToast(t("profile.requestSent"));
    } catch (apiError) {
      setRequestState("idle");
      showToast(apiError instanceof ApiError ? apiError.message : t("profile.sendFailed"), "error");
    }
  };

  const removeFriend = async () => {
    if (!user || removingFriend) return;
    try {
      setRemovingFriend(true);
      await api.removeFriendRequest(user.user_id);
      setIsFriend(false);
      setRespondedAt(null);
      setRemoveConfirmOpen(false);
      const cached = readTabCache<UserProfileCacheSnapshot>(cacheScope, `user-profile:${userId}`)?.data;
      if (cached) writeTabCache(cacheScope, `user-profile:${userId}`, { ...cached, isFriend: false, respondedAt: null });
      showToast(t("profile.friendRemoved"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("profile.removeFailed"), "error");
    } finally {
      setRemovingFriend(false);
    }
  };

  if (!user && viewState === "loading") {
    return (
      <div className="user-profile-loading-shell" aria-hidden="true">
        <span className="user-profile-loading-avatar" />
        <span className="user-profile-loading-copy">
          <span className="user-profile-loading-line" />
          <span className="user-profile-loading-line is-short" />
        </span>
      </div>
    );
  }
  if (!user || viewState === "error") return <FeedbackState title={t("profile.unavailable")} description={error ?? t("profile.tryLater")} />;

  return (
    <div className="user-profile-panel">
      <section className="user-profile-identity">
        <button
          aria-label={t("profile.avatarLabel", { name: user.name })}
          className="user-profile-avatar-wrap"
          disabled={!user.avatar_uri}
          onClick={() => setAvatarPreviewOpen(true)}
          type="button"
        >
          <UserAvatar
            className={`user-profile-avatar ${user.is_alive ? "status-online" : ""}`}
            frame={user.avatar_frame_style}
            name={user.name}
            uri={user.avatar_uri}
            vip={Boolean(user.is_permanent_vip)}
          />
        </button>
        <div className="user-profile-copy">
          <div className="user-profile-kicker">{isFriend ? friendshipAge(respondedAt) : t("profile.sameSpace")}</div>
          <div className="user-profile-name-row">
            <h2>{user.name}</h2>
            <div className="user-profile-status-badges">
              {user.is_permanent_vip ? <span className="user-profile-vip-badge">{t("profile.permanentVip")}</span> : null}
              {!user.official && user.growth_level ? (
                <span className="user-profile-level-badge">
                  <b>Lv.{user.growth_level}</b>
                  {user.growth_level_name ? <span>{user.growth_level_name}</span> : null}
                </span>
              ) : null}
            </div>
          </div>
          <p className={user.is_alive ? "is-online" : ""}>{presence}</p>
        </div>
      </section>

      <div className="user-profile-primary-actions">
        {isFriend === true ? (
          <button className="button" onClick={() => void openChat()} type="button">{t("profile.sendMessage")}</button>
        ) : isFriend === false ? (
          <button className="button" disabled={requestState !== "idle"} onClick={() => void sendRequest()} type="button">
            {requestState === "sending" ? t("profile.sending") : requestState === "sent" ? t("profile.sent") : t("profile.addFriend")}
          </button>
        ) : null}
        <button className="button secondary-button" onClick={openStatements} type="button">{t("profile.viewStatements")}</button>
      </div>

      <section className="user-profile-section">
        <div className="user-profile-section-head">
          <div className="section-label">{t("profile.sharedGroups", { count: groupChats.length })}</div>
          {groupChats.length > 3 ? <button className="user-profile-section-more" onClick={() => setAllGroupsOpen(true)} type="button">{t("profile.viewAll")}</button> : null}
        </div>
        <div className="user-profile-groups">
          {isFriend === true ? (
            <button className={`user-profile-group-row user-profile-create-group${canCreateGroup ? "" : " is-locked"}`} disabled={!canCreateGroup} onClick={() => void openGroupPicker()} type="button">
              <span className="mini-avatar user-profile-create-group-icon material-symbols-outlined">{canCreateGroup ? "add" : "lock"}</span>
              <span><strong>{t("profile.newGroup")}</strong><small>{canCreateGroup ? t("profile.inviteFriends") : t("profile.levelUnlock", { level: createGroupCapability?.required_level ?? 4 })}</small></span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          ) : null}
          {groupChats.slice(0, 3).map(renderGroupRow)}
        </div>
      </section>

      {isFriend === true ? (
        <section className="user-profile-relationship-actions">
          <button className="user-profile-danger-action" onClick={() => setRemoveConfirmOpen(true)} type="button">{t("profile.removeFriend")}</button>
        </section>
      ) : null}

      <BottomSheet
        open={groupPickerOpen}
        title={t("profile.newGroup")}
        titleAccessory={<HeaderSyncIndicator syncing={groupCandidatesLoading} />}
        onClose={() => setGroupPickerOpen(false)}
      >
        <div className="user-profile-group-picker">
          {groupCandidates.length ? (
            <div className="simple-list">
              {groupCandidates.map((candidate) => {
                const selected = groupSelectedIds.includes(candidate.user_id);
                const locked = candidate.user_id === user.user_id;
                return (
                  <button
                    key={candidate.user_id}
                    className={`simple-row person-row user-profile-picker-row${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
                    onClick={() => {
                      if (locked) return;
                      setGroupSelectedIds((current) => selected ? current.filter((id) => id !== candidate.user_id) : [...current, candidate.user_id]);
                    }}
                    type="button"
                  >
                    <UserAvatar className="mini-avatar" name={candidate.name} uri={candidate.avatar_uri} />
                    <span className="row-main">
                      <strong>{candidate.name}</strong>
                      {locked ? <small className="row-subtle">{t("profile.currentFriend")}</small> : null}
                    </span>
                    <span aria-hidden="true" className="user-profile-picker-check">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : !groupCandidatesLoading ? <QuietState icon="group_add" title={t("profile.noCandidates")} /> : null}
          <button className="button user-profile-create-confirm" disabled={groupSelectedIds.length < 2 || groupCreating} onClick={() => void createGroupChat()} type="button">
            {groupCreating ? t("profile.creating") : t("profile.createGroup", { count: groupSelectedIds.length + 1 })}
          </button>
        </div>
      </BottomSheet>

      <SideDrawer open={allGroupsOpen} onClose={() => setAllGroupsOpen(false)} title={t("contacts.groups")}>
        <div className="user-profile-groups user-profile-all-groups">{groupChats.map(renderGroupRow)}</div>
      </SideDrawer>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <ConfirmDialog
        busy={removingFriend}
        danger
        open={removeConfirmOpen}
        title={t("profile.removeTitle")}
        description={t("profile.removeHint")}
        confirmLabel={t("profile.remove")}
        onClose={() => {
          if (removingFriend) return;
          setRemoveConfirmOpen(false);
        }}
        onConfirm={() => void removeFriend()}
      />
      {user.avatar_uri ? (
        <AvatarPreviewDrawer
          frame={user.avatar_frame_style}
          level={user.growth_level}
          name={user.name}
          onClose={() => setAvatarPreviewOpen(false)}
          online={Boolean(user.is_alive)}
          open={avatarPreviewOpen}
          uri={user.avatar_uri}
          vip={Boolean(user.is_permanent_vip)}
        />
      ) : null}
    </div>
  );
}
