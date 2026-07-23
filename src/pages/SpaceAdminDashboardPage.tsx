import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { copyText } from "../lib/presentation";
import { setCachedGroupSquareEnabled } from "../lib/spaceFeatures";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import type { AdminMemberDTO, AppViewState, SpaceAdminBroadcastResultDTO, SpaceAdminDashboardDTO } from "../types";

type MemberFilter = "all" | "online";

function formatCreatedAt(value?: number) {
  if (!value) return "刚刚创建";
  return new Date(value * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const ADMIN_NOTIFICATION_CHANNEL = {
  email: 1,
  sms: 2,
  bark: 3,
} as const;

export default function SpaceAdminDashboardPage() {
  const { session, logout, patchSpace } = useAdminAuth();
  const [dashboardState, setDashboardState] = useState<AppViewState>("idle");
  const [memberState, setMemberState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<SpaceAdminDashboardDTO | null>(null);
  const [members, setMembers] = useState<AdminMemberDTO[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [copied, setCopied] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSquareEnabled, setSettingsSquareEnabled] = useState(false);
  const [settingsMemberLimit, setSettingsMemberLimit] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [officialLoginBusy, setOfficialLoginBusy] = useState(false);
  const [removeUser, setRemoveUser] = useState<AdminMemberDTO | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastState, setBroadcastState] = useState<"idle" | "sending" | "sent">("idle");
  const [broadcastResult, setBroadcastResult] = useState<SpaceAdminBroadcastResultDTO | null>(null);
  const broadcastIdRef = useRef("");
  const [refreshTick, setRefreshTick] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const currentSpace = dashboard?.space ?? session?.space ?? null;
  const entryHref = useMemo(() => (currentSpace ? buildJoinHrefForCurrentHost(currentSpace.slug) : ""), [currentSpace]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const controller = new AbortController();
    setDashboardState("loading");
    setError(null);

    api
      .getAdminDashboard(controller.signal)
      .then((dashboardPayload) => {
        setDashboard(dashboardPayload);
        setDashboardState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载空间后台失败";
        setError(message);
        setDashboardState("error");
      });

    return () => controller.abort();
  }, [refreshTick]);

  useEffect(() => {
    if (!dashboard?.space) return;
    setSettingsName(dashboard.space.name);
    setSettingsSquareEnabled(Boolean(dashboard.space.group_square_enabled));
    setSettingsMemberLimit(dashboard.space.member_limit ? String(dashboard.space.member_limit) : "");
  }, [dashboard?.space]);

  useEffect(() => {
    const controller = new AbortController();
    setMemberState("loading");
    setError(null);

    api
      .getAdminUsers(
        {
          q: deferredQuery || undefined,
          online: filter === "online" ? 1 : undefined,
          limit: 50,
          offset: 0,
        },
        controller.signal
      )
      .then((memberRows) => {
        setMembers(memberRows);
        setMemberState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载成员列表失败";
        setError(message);
        setMemberState("error");
      });

    return () => controller.abort();
  }, [deferredQuery, filter, refreshTick]);

  const copyEntryLink = async () => {
    if (!entryHref) return;
    try {
      const copied = await copyText(entryHref);
      if (!copied) throw new Error("copy_failed");
      setCopied(true);
    } catch {
      setError("复制入口链接失败，请稍后再试。");
    }
  };

  const saveSettings = async () => {
    if (!currentSpace) return;
    setSettingsSaving(true);
    setError(null);
    try {
      const payload = await api.updateAdminSettings({
        name: settingsName.trim(),
        group_square_enabled: settingsSquareEnabled ? 1 : 0,
        member_limit: settingsMemberLimit.trim() ? Number(settingsMemberLimit.trim()) : null,
      });
      setCachedGroupSquareEnabled(payload.space_id, payload.group_square_enabled !== false);
      patchSpace(payload);
      setDashboard((current) =>
        current
          ? {
              ...current,
              space: payload,
            }
          : current
      );
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "保存基础设置失败");
    } finally {
      setSettingsSaving(false);
    }
  };

  const confirmRemoveUser = async () => {
    if (!removeUser) return;
    setRemoveBusy(true);
    setError(null);
    try {
      await api.removeAdminUser(removeUser.user_id);
      setMembers((current) => current.filter((user) => user.user_id !== removeUser.user_id));
      setDashboard((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                members_count: Math.max(0, current.stats.members_count - (removeUser.is_deleted ? 0 : 1)),
                online_count: current.stats.online_count - (removeUser.is_deleted ? 0 : removeUser.is_alive ? 1 : 0),
              },
            }
          : current
      );
      setRemoveUser(null);
      setRefreshTick((value) => value + 1);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "移出成员失败");
    } finally {
      setRemoveBusy(false);
    }
  };

  const loginAsOfficial = async () => {
    if (!currentSpace) return;
    setOfficialLoginBusy(true);
    setError(null);
    try {
      const payload = await api.createOfficialLoginTicket();
      const loginUrl = buildSpaceHrefForCurrentHost(currentSpace.slug, "/official-login", "", `ticket=${encodeURIComponent(payload.token)}`);
      window.location.assign(loginUrl);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "生成官方账号登录链接失败");
      setOfficialLoginBusy(false);
    }
  };

  const sendBroadcast = async () => {
    const content = broadcastContent.trim();
    if (!content || broadcastState === "sending") return;
    setBroadcastState("sending");
    setError(null);
    try {
      const payload = await api.broadcastAdminMessage({
        content,
        broadcast_id: broadcastIdRef.current,
      });
      setBroadcastResult(payload);
      setBroadcastState("sent");
      setBroadcastContent("");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "群发消息失败");
      setBroadcastState("idle");
    }
  };

  const openBroadcast = () => {
    broadcastIdRef.current = `admin-broadcast:${crypto.randomUUID()}`;
    setBroadcastOpen(true);
  };

  const closeBroadcast = () => {
    if (broadcastState === "sending") return;
    setBroadcastOpen(false);
    setBroadcastState("idle");
    setBroadcastResult(null);
    setBroadcastContent("");
    broadcastIdRef.current = "";
  };

  const notificationCell = (
    user: AdminMemberDTO,
    key: keyof AdminMemberDTO["contacts"],
    channel: number
  ) => {
    const contact = user.contacts[key];
    const preference = user.notification_preferences.find((item) => item.channel === channel);
    if (!contact.bound) return <span className="admin-channel-state is-muted">未绑定</span>;
    if (!contact.verified) return <span className="admin-channel-state is-pending">待认证</span>;
    if (key === "sms") return <span className="admin-channel-state is-muted">暂不支持</span>;
    return (
      <span className="admin-channel-state">
        <span className={`admin-table-dot ${preference?.enabled ? "is-on" : ""}`} />
        {preference?.enabled ? "已开启" : "未开启"} · {preference?.offline_threshold_minutes ?? 30} 分钟
      </span>
    );
  };

  return (
    <AppChrome
      guestSpaceBrand={
        currentSpace
          ? {
              name: currentSpace.name,
              avatarUri: currentSpace.official_user?.avatar_uri,
            }
          : undefined
      }
      hidePageTitle
      publicHeader
      title="空间后台"
      topbarAction={
        <button className="ghost-chip" onClick={() => logout()} type="button">
          退出登录
        </button>
      }
    >
      <section className="page-stack admin-dashboard-page">
        {currentSpace ? (
          <section className="admin-dashboard-hero">
            <div className="admin-dashboard-copy">
              <div className="admin-dashboard-title-row">
                <h1>{currentSpace.name}</h1>
                <HeaderSyncIndicator syncing={dashboardState === "loading"} />
              </div>
              <div className="admin-dashboard-domain">{currentSpace.slug}.sermo.jyonn.space</div>
            </div>

            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <strong>{dashboard?.stats.members_count ?? 0}</strong>
                <span>成员</span>
              </div>
              <div className="admin-stat-card">
                <strong>{dashboard?.stats.online_count ?? 0}</strong>
                <span>在线</span>
              </div>
            </div>

            <div className="admin-dashboard-actions">
              <button className="ghost-button" onClick={() => void copyEntryLink()} type="button">
                {copied ? "已复制入口" : "复制成员入口"}
              </button>
              <a className="ghost-button" href={entryHref}>
                打开成员入口
              </a>
            </div>
          </section>
        ) : null}

        <div className="admin-dashboard-workspace">
          <section className="panel admin-dashboard-section admin-members-panel">
            <div className="admin-section-head">
              <div className="admin-section-title-row">
                <h2 className="panel-title">成员</h2>
                <HeaderSyncIndicator syncing={memberState === "loading"} />
              </div>
              <div className="list-segment segmented-switch">
                <button className={`tab-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")} type="button">全部</button>
                <button className={`tab-chip ${filter === "online" ? "active" : ""}`} onClick={() => setFilter("online")} type="button">在线</button>
              </div>
            </div>

            <label className="search-box page-search admin-member-search">
              <span className="material-symbols-outlined">search</span>
              <input
                className="input"
                style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
                placeholder="搜索成员"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {members.length ? (
              <div className="admin-member-table-scroll">
                <table className="admin-member-table">
                  <thead>
                    <tr>
                      <th>成员</th>
                      <th>已认证</th>
                      <th>邮件</th>
                      <th>短信</th>
                      <th>即时</th>
                      <th aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((user) => (
                      <tr key={user.user_id}>
                        <td>
                          <div className="admin-member-identity">
                            <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                            <div>
                              <strong>{user.name}</strong>
                              <span>{user.is_deleted ? "历史残留" : user.is_alive ? "在线" : "离线"}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className={`admin-verified-state ${user.verified ? "is-verified" : ""}`}>{user.verified ? "是" : "否"}</span></td>
                        <td>{notificationCell(user, "email", ADMIN_NOTIFICATION_CHANNEL.email)}</td>
                        <td>{notificationCell(user, "sms", ADMIN_NOTIFICATION_CHANNEL.sms)}</td>
                        <td>{notificationCell(user, "bark", ADMIN_NOTIFICATION_CHANNEL.bark)}</td>
                        <td>
                          <button className="admin-member-remove" onClick={() => setRemoveUser(user)} type="button">
                            {user.is_deleted ? "清理" : "移出"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : memberState === "ready" ? (
              <FeedbackState title="还没有成员" description={query.trim() ? "换个关键词试试。" : filter === "online" ? "当前没有在线成员。" : ""} />
            ) : null}
          </section>

          <aside className="admin-dashboard-aside">
            {currentSpace?.official_user ? (
              <section className="panel admin-dashboard-section admin-official-panel">
                <h2 className="panel-title">官方账号</h2>
                <div className="admin-official-profile">
                  <UserAvatar className="avatar" name={currentSpace.official_user.name} uri={currentSpace.official_user.avatar_uri} />
                  <div>
                    <strong>{currentSpace.official_user.name}</strong>
                    <span>@{currentSpace.slug}</span>
                  </div>
                </div>
                <div className="admin-official-actions">
                  <button className="button" disabled={!dashboard?.stats.members_count} onClick={openBroadcast} type="button">群发消息</button>
                  <button className="ghost-button" disabled={officialLoginBusy} onClick={() => void loginAsOfficial()} type="button">
                    {officialLoginBusy ? "进入中..." : "进入账号"}
                  </button>
                </div>
              </section>
            ) : null}

            {currentSpace ? (
              <section className="panel admin-dashboard-section admin-settings-panel">
                <div className="admin-section-title-row">
                  <h2 className="panel-title">基础设置</h2>
                  <span>{formatCreatedAt(currentSpace.created_at)}</span>
                </div>
                <div className="admin-settings-email">{currentSpace.email}</div>
                <div className="field-stack">
                  <div>
                    <label className="field-label">空间名称</label>
                    <input className="input" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">成员上限</label>
                    <input
                      className="input mono"
                      inputMode="numeric"
                      placeholder="不限制"
                      value={settingsMemberLimit}
                      onChange={(event) => setSettingsMemberLimit(event.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                  <div className="admin-toggle-row">
                    <div className="row-main"><strong>空间广场</strong></div>
                    <button
                      aria-label="切换空间广场"
                      className={`switch ${settingsSquareEnabled ? "active" : ""}`}
                      onClick={() => setSettingsSquareEnabled((current) => !current)}
                      type="button"
                    />
                  </div>
                </div>
                <button className="ghost-button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">
                  {settingsSaving ? "保存中..." : "保存设置"}
                </button>
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      <BottomSheet
        open={broadcastOpen}
        title="群发消息"
        description={`以官方账号发送给 ${dashboard?.stats.members_count ?? 0} 位成员`}
        onClose={closeBroadcast}
      >
        {broadcastState === "sent" && broadcastResult ? (
          <div className="admin-broadcast-result">
            <span>{broadcastResult.sent_count}</span>
            <strong>条消息已发送</strong>
            <button className="button" onClick={closeBroadcast} type="button">完成</button>
          </div>
        ) : (
          <div className="admin-broadcast-form">
            <textarea
              className="textarea"
              maxLength={512}
              placeholder="输入要发送的消息"
              rows={6}
              value={broadcastContent}
              onChange={(event) => setBroadcastContent(event.target.value)}
            />
            <div className="admin-broadcast-meta">
              <span>{broadcastContent.length}/512</span>
              <span>消息将进入每位成员与官方账号的私聊</span>
            </div>
            <button className="button" disabled={!broadcastContent.trim() || broadcastState === "sending"} onClick={() => void sendBroadcast()} type="button">
              {broadcastState === "sending" ? "发送中..." : "确认群发"}
            </button>
          </div>
        )}
      </BottomSheet>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <ConfirmDialog
        busy={removeBusy}
        confirmLabel={removeUser?.is_deleted ? "确认清理" : "确认移出"}
        description={
          removeUser
            ? removeUser.is_deleted
              ? `将再次清理 ${removeUser.name} 的残留好友和群成员关系。`
              : `移出 ${removeUser.name} 后，对方将不能再进入这个空间。`
            : ""
        }
        onClose={() => setRemoveUser(null)}
        onConfirm={() => void confirmRemoveUser()}
        open={Boolean(removeUser)}
        title={removeUser?.is_deleted ? "清理历史残留成员" : "移出成员"}
      />
    </AppChrome>
  );
}
