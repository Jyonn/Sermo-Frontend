import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncErrorDialog } from "./AsyncErrorDialog";
import { BottomSheet } from "./BottomSheet";
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
import type { AppViewState, ChatDTO, UserDTO } from "../types";

export interface UserProfileSeed {
  user_id: number;
  name: string;
  avatar_uri?: string;
  is_alive?: boolean;
  last_heartbeat?: number;
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
  if (!respondedAt) return "已是好友";
  const days = Math.max(1, Math.floor((Date.now() / 1000 - respondedAt) / 86400));
  return days < 30 ? `认识 ${days} 天` : `认识 ${Math.floor(days / 30)} 个月`;
}

export function UserProfilePanel({ userId, initialUser, initialIsFriend, onSyncingChange, onOpenChat }: UserProfilePanelProps) {
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
        if (!matchedUser) throw new Error("没有找到这个用户");
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
        const message = apiError instanceof ApiError || apiError instanceof Error ? apiError.message : "用户详情加载失败";
        if (!cached && !initialUser) {
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) syncingCallbackRef.current?.(false);
      });
    return () => {
      controller.abort();
      syncingCallbackRef.current?.(false);
    };
  }, [cacheScope, userId]);

  const presence = useMemo(() => {
    if (!user) return "";
    return user.is_alive ? "现在在线" : user.last_heartbeat ? `上次活跃 ${formatRelativeTime(user.last_heartbeat)}` : "暂时离线";
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

  const openGroupPicker = async () => {
    if (!user) return;
    setGroupSelectedIds([user.user_id]);
    setGroupCandidates([user]);
    setGroupCandidatesLoading(true);
    setGroupPickerOpen(true);
    try {
      const friends = await api.getFriends();
      setGroupCandidates([user, ...friends.filter((friend) => friend.user_id !== user.user_id)]);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "好友列表加载失败");
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
        showToast(`达到 Lv.${capability.required_level} 后可创建群聊`, "error");
        return;
      }
      const chat = await api.createGroupChat(groupSelectedIds);
      setGroupPickerOpen(false);
      showToast("群聊已创建");
      if (onOpenChat) onOpenChat(chat.chat_id);
      else navigate(`/app/chats/${chat.chat_id}`);
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "新建群聊失败", "error");
    } finally {
      setGroupCreating(false);
    }
  };

  const renderGroupRow = (chat: ChatDTO) => (
    <button key={chat.chat_id} className="user-profile-group-row" onClick={() => (onOpenChat ? onOpenChat(chat.chat_id) : navigate(`/app/chats/${chat.chat_id}`))} type="button">
      <UserAvatar className="mini-avatar" groupMembers={chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri }))} name={chat.title ?? "群聊"} />
      <span><strong>{chat.title ?? "未命名群聊"}</strong><small>{chat.members.length} 人</small></span>
      <span className="material-symbols-outlined">chevron_right</span>
    </button>
  );

  const sendRequest = async () => {
    if (!user || requestState !== "idle") return;
    setRequestState("sending");
    try {
      await api.createFriendRequest(user.user_id);
      setRequestState("sent");
      showToast("好友申请已发送");
    } catch (apiError) {
      setRequestState("idle");
      showToast(apiError instanceof ApiError ? apiError.message : "发送失败", "error");
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
      showToast("好友已删除");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "删除失败", "error");
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
        {isFriend === true ? (
          <button className="button" onClick={() => void openChat()} type="button">发消息</button>
        ) : isFriend === false ? (
          <button className="button" disabled={requestState !== "idle"} onClick={() => void sendRequest()} type="button">
            {requestState === "sending" ? "发送中" : requestState === "sent" ? "已发送" : "加好友"}
          </button>
        ) : null}
      </div>

      <section className="user-profile-section">
        <div className="user-profile-section-head">
          <div className="section-label">共同群聊 · {groupChats.length}</div>
          {groupChats.length > 3 ? <button className="user-profile-section-more" onClick={() => setAllGroupsOpen(true)} type="button">查看全部</button> : null}
        </div>
        <div className="user-profile-groups">
          <button className="user-profile-group-row user-profile-create-group" onClick={() => void openGroupPicker()} type="button">
            <span className="mini-avatar user-profile-create-group-icon material-symbols-outlined">add</span>
            <span><strong>新建群聊</strong><small>邀请共同好友加入</small></span>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          {groupChats.slice(0, 3).map(renderGroupRow)}
        </div>
      </section>

      {isFriend === true ? (
        <section className="user-profile-relationship-actions">
          <button className="user-profile-danger-action" onClick={() => setRemoveConfirmOpen(true)} type="button">删除好友</button>
        </section>
      ) : null}

      <BottomSheet
        open={groupPickerOpen}
        title="新建群聊"
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
                      {locked ? <small className="row-subtle">当前好友</small> : null}
                    </span>
                    <span aria-hidden="true" className="user-profile-picker-check">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : !groupCandidatesLoading ? <FeedbackState title="没有可邀请的好友" description="" /> : null}
          <button className="button user-profile-create-confirm" disabled={groupSelectedIds.length < 2 || groupCreating} onClick={() => void createGroupChat()} type="button">
            {groupCreating ? "创建中" : `创建群聊 · ${groupSelectedIds.length + 1} 人`}
          </button>
        </div>
      </BottomSheet>

      <SideDrawer open={allGroupsOpen} onClose={() => setAllGroupsOpen(false)} title="共同群聊">
        <div className="user-profile-groups user-profile-all-groups">{groupChats.map(renderGroupRow)}</div>
      </SideDrawer>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <ConfirmDialog
        busy={removingFriend}
        danger
        open={removeConfirmOpen}
        title="删除好友？"
        description="已有聊天记录仍会保留。"
        confirmLabel="删除"
        onClose={() => {
          if (removingFriend) return;
          setRemoveConfirmOpen(false);
        }}
        onConfirm={() => void removeFriend()}
      />
    </div>
  );
}
