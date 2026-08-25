import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncErrorDialog } from "./AsyncErrorDialog";
import { BottomSheet } from "./BottomSheet";
import { QuietState } from "./BoundaryState";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { HeaderSyncIndicator } from "./HeaderSyncIndicator";
import { ImageLightbox } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatRelativeTime } from "../lib/presentation";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { showToast } from "../lib/toast";
import type { AppViewState, ChatDTO, SquareStatementDTO, UserDTO, UserMeDTO } from "../types";
import { i18n, useI18n } from "../lib/language";

export interface UserProfileSeed {
  user_id: number;
  name: string;
  official?: boolean;
  avatar_uri?: string;
  is_alive?: boolean;
  last_heartbeat?: number;
  is_permanent_vip?: boolean;
  permanent_vip_slot?: number | null;
  growth_level?: number;
  growth_level_name?: string;
  avatar_frame_style?: UserDTO["avatar_frame_style"];
  profile_card_theme?: UserDTO["profile_card_theme"];
}

interface UserProfilePanelProps {
  userId: number;
  initialUser?: UserProfileSeed | null;
  initialIsFriend?: boolean;
  onSyncingChange?: (syncing: boolean) => void;
  onOpenChat?: (chatId: number) => void;
  friendRequestSource?: "direct" | "square";
}

interface UserProfileCacheSnapshot {
  user: UserDTO;
  groupChats: ChatDTO[];
  isFriend: boolean;
  respondedAt: number | null;
  directChatId?: number | null;
  onlineReminder?: boolean;
  statementReminder?: boolean;
  recentStatement?: SquareStatementDTO | null;
}

const RECENT_STATEMENT_WINDOW_SECONDS = 7 * 24 * 60 * 60;

function friendshipAge(respondedAt?: number | null) {
  if (!respondedAt) return i18n.t("profile.friend");
  const days = Math.max(1, Math.floor((Date.now() / 1000 - respondedAt) / 86400));
  return days < 30 ? i18n.t("profile.knownDays", { count: days }) : i18n.t("profile.knownMonths", { count: Math.floor(days / 30) });
}

export function UserProfilePanel({ userId, initialUser, initialIsFriend, onSyncingChange, onOpenChat, friendRequestSource = "direct" }: UserProfilePanelProps) {
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
  const [directChatId, setDirectChatId] = useState<number | null>(initialCached?.directChatId ?? null);
  const [onlineReminder, setOnlineReminder] = useState(Boolean(initialCached?.onlineReminder));
  const [statementReminder, setStatementReminder] = useState(Boolean(initialCached?.statementReminder));
  const [recentStatement, setRecentStatement] = useState<SquareStatementDTO | null>(initialCached?.recentStatement ?? null);
  const [reminderSaving, setReminderSaving] = useState<"online" | "statement" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readTabCache<UserProfileCacheSnapshot>(cacheScope, `user-profile:${userId}`)?.data ?? null;
    setUser(cached?.user ?? initialUser ?? null);
    setGroupChats(cached?.groupChats ?? []);
    setIsFriend(cached?.isFriend ?? initialIsFriend ?? null);
    setRespondedAt(cached?.respondedAt ?? null);
    setRecentStatement(cached?.recentStatement ?? null);
    setViewState(cached || initialUser ? "ready" : "loading");
    setError(null);
    syncingCallbackRef.current?.(true);
    Promise.all([
      api.getFriends(controller.signal),
      api.getChats(controller.signal),
      api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal),
      api.getFriendStatus(userId, controller.signal),
      api.getSquareStatements({ limit: 5, scope: "all", user_id: userId }, controller.signal).catch(() => []),
    ])
      .then(([friends, chats, users, status, statements]) => {
        const matchedFriend = friends.find((row) => row.user_id === userId) ?? null;
        const matchedSpaceUser = users.find((row) => row.user_id === userId) ?? null;
        const matchedUser = matchedFriend && matchedSpaceUser
          ? { ...matchedFriend, ...matchedSpaceUser }
          : matchedFriend ?? matchedSpaceUser;
        if (!matchedUser) throw new Error(t("profile.userMissing"));
        setUser(matchedUser);
        setIsFriend(status.is_friend);
        const nextRespondedAt = status.friendship?.responded_at ?? matchedFriend?.responded_at ?? null;
        const nextGroupChats = chats.filter((chat) => chat.group && chat.members.some((member) => member.user_id === userId));
        const directChat = chats.find((chat) => !chat.group && chat.members.some((member) => member.user_id === userId));
        const recentStatement = statements.find(
          (statement) => statement.created_at >= Date.now() / 1000 - RECENT_STATEMENT_WINDOW_SECONDS
        ) ?? null;
        setRespondedAt(nextRespondedAt);
        setGroupChats(nextGroupChats);
        setDirectChatId(directChat?.chat_id ?? null);
        setOnlineReminder(Boolean(directChat?.online_reminder_enabled));
        setStatementReminder(Boolean(directChat?.statement_reminder_enabled));
        setRecentStatement(recentStatement);
        writeTabCache(cacheScope, `user-profile:${userId}`, {
          user: matchedUser,
          groupChats: nextGroupChats,
          isFriend: status.is_friend,
          respondedAt: nextRespondedAt,
          directChatId: directChat?.chat_id ?? null,
          onlineReminder: Boolean(directChat?.online_reminder_enabled),
          statementReminder: Boolean(directChat?.statement_reminder_enabled),
          recentStatement,
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
  const createGroupCapability = currentUserMe?.growth?.capabilities?.["chat.group.create"];
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

  const openRecentStatement = () => {
    if (!recentStatement) return;
    navigate(`/app/square/statements/${recentStatement.statement_id}`);
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
      const capability = me.growth?.capabilities?.["chat.group.create"];
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

  const renderGroupTile = (chat: ChatDTO) => (
    <button key={chat.chat_id} className="user-profile-group-tile" onClick={() => (onOpenChat ? onOpenChat(chat.chat_id) : navigate(`/app/chats/${chat.chat_id}`))} type="button">
      <UserAvatar className="user-profile-group-tile-avatar" groupMembers={chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri }))} name={chat.title ?? t("chat.group")} />
      <strong>{chat.title ?? t("chat.unnamedGroup")}</strong>
    </button>
  );

  const sendRequest = async () => {
    if (!user || requestState !== "idle") return;
    setRequestState("sending");
    try {
      await api.createFriendRequest(user.user_id, friendRequestSource);
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

  const updateReminder = async (kind: "online" | "statement", enabled: boolean) => {
    if (!user || reminderSaving) return;
    setReminderSaving(kind);
    try {
      const chatId = directChatId ?? (await api.createDirectChat(user.user_id)).chat_id;
      const preference = await api.updateChatPreference(chatId, kind === "online"
        ? { online_reminder_enabled: enabled ? 1 : 0 }
        : { statement_reminder_enabled: enabled ? 1 : 0 });
      setDirectChatId(chatId);
      setOnlineReminder(preference.online_reminder_enabled);
      setStatementReminder(preference.statement_reminder_enabled);
      showToast(t(enabled ? "profile.reminderEnabled" : "profile.reminderDisabled"));
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("profile.reminderFailed"), "error");
    } finally {
      setReminderSaving(null);
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
    <div className={`user-profile-panel profile-theme-${user.profile_card_theme ?? "default"}`}>
      <section className="user-profile-social-card">
        <div className="user-profile-cover" aria-hidden="true" />
        <div className="user-profile-identity">
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
            <div className="user-profile-name-row">
              <h2>{user.name}</h2>
            </div>
            <p className={user.is_alive ? "is-online" : ""}>{presence}</p>
          </div>
        </div>
        <div className="user-profile-facts">
          {!user.official && user.growth_level ? <span className="is-level">LV {user.growth_level}</span> : null}
          {user.is_permanent_vip ? (
            <span className="is-vip">
              {user.permanent_vip_slot
                ? t("profile.permanentVipRank", { slot: user.permanent_vip_slot })
                : t("profile.permanentVip")}
            </span>
          ) : null}
          <span className="is-relationship">{isFriend ? friendshipAge(respondedAt) : t("profile.sameSpace")}</span>
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
        <button className="button user-profile-statements-action" onClick={openStatements} type="button">{t("profile.viewStatements")}</button>
      </div>

      <button className={`user-profile-recent-statement${recentStatement ? "" : " is-empty"}`} onClick={recentStatement ? openRecentStatement : openStatements} type="button">
        <small>
          {t("profile.recentStatement")}
          {recentStatement ? ` · ${formatRelativeTime(recentStatement.created_at)}` : ""}
        </small>
        <strong>{recentStatement ? recentStatement.text || t("profile.mediaStatement") : t("profile.noRecentStatement")}</strong>
        <span>{t(recentStatement ? "profile.enterStatement" : "profile.viewStatements")} ›</span>
        <i className="material-symbols-outlined" aria-hidden="true">campaign</i>
      </button>

      {isFriend === true ? (
        <section className="user-profile-reminders" aria-label={t("profile.reminders")}>
          <button className={onlineReminder ? "is-active" : ""} disabled={reminderSaving !== null} onClick={() => void updateReminder("online", !onlineReminder)} type="button">
            <span className="material-symbols-outlined">notifications_active</span>
            <span><strong>{t("profile.onlineReminder")}</strong><small>{t(onlineReminder ? "profile.enabled" : "profile.disabled")}</small></span>
          </button>
          <button className={statementReminder ? "is-active" : ""} disabled={reminderSaving !== null} onClick={() => void updateReminder("statement", !statementReminder)} type="button">
            <span className="material-symbols-outlined">campaign</span>
            <span><strong>{t("profile.statementReminder")}</strong><small>{t(statementReminder ? "profile.enabled" : "profile.disabled")}</small></span>
          </button>
        </section>
      ) : null}

      <section className="user-profile-section">
        <div className="user-profile-section-head">
          <div className="section-label">{t("profile.sharedGroups", { count: groupChats.length })}</div>
          {groupChats.length > 3 ? <button className="user-profile-section-more" onClick={() => setAllGroupsOpen(true)} type="button">{t("profile.viewAll")}</button> : null}
        </div>
        <div className="user-profile-groups">
          {isFriend === true ? (
            <button className={`user-profile-group-tile user-profile-create-group${canCreateGroup ? "" : " is-locked"}`} disabled={!canCreateGroup} onClick={() => void openGroupPicker()} type="button">
              <span className="user-profile-group-tile-avatar user-profile-create-group-icon material-symbols-outlined">{canCreateGroup ? "add" : "lock"}</span>
              <strong>{t("profile.newGroup")}</strong>
            </button>
          ) : null}
          {groupChats.slice(0, 2).map(renderGroupTile)}
          {groupChats.length > 0 ? (
            <button className="user-profile-group-tile user-profile-all-groups-tile" onClick={() => setAllGroupsOpen(true)} type="button">
              <span className="user-profile-group-tile-avatar material-symbols-outlined">more_horiz</span>
              <strong>{t("profile.viewAll")}</strong>
            </button>
          ) : null}
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

      <SideDrawer historyKey="mutual-groups" onRouteOpen={() => setAllGroupsOpen(true)} open={allGroupsOpen} onClose={() => setAllGroupsOpen(false)} title={t("contacts.groups")}>
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
      {avatarPreviewOpen && user.avatar_uri ? (
        <ImageLightbox
          altPrefix={t("profile.avatarAlt", { name: user.name })}
          fileNamePrefix="sermo-avatar"
          index={0}
          onClose={() => setAvatarPreviewOpen(false)}
          onIndexChange={() => undefined}
          uris={[user.avatar_uri]}
        />
      ) : null}
    </div>
  );
}
