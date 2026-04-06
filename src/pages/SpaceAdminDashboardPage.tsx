import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { copyText } from "../lib/presentation";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import type { AppViewState, SpaceAdminDashboardDTO, UserDTO } from "../types";

type MemberFilter = "all" | "online";

function formatCreatedAt(value?: number) {
  if (!value) return "刚刚创建";
  return new Date(value * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SpaceAdminDashboardPage() {
  const { session, logout, patchSpace } = useAdminAuth();
  const [dashboardState, setDashboardState] = useState<AppViewState>("idle");
  const [memberState, setMemberState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<SpaceAdminDashboardDTO | null>(null);
  const [members, setMembers] = useState<UserDTO[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [copied, setCopied] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSquareEnabled, setSettingsSquareEnabled] = useState(false);
  const [settingsMemberLimit, setSettingsMemberLimit] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [officialLoginBusy, setOfficialLoginBusy] = useState(false);
  const [removeUser, setRemoveUser] = useState<UserDTO | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
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

  return (
    <AppChrome
      title="空间后台"
      topbarAction={
        <button className="ghost-chip" onClick={() => logout()} type="button">
          退出登录
        </button>
      }
    >
      <section className="page-stack admin-dashboard-page">
        {dashboardState === "loading" ? <FeedbackState title="后台加载中" description="正在同步空间信息。" tone="loading" /> : null}

        {currentSpace ? (
          <section className="panel admin-dashboard-hero">
            <div className="admin-dashboard-copy">
              <p className="eyebrow">Admin Dashboard</p>
              <h2 className="panel-title">{currentSpace.name}</h2>
              <div className="admin-dashboard-domain">{currentSpace.slug}.sermo.jyonn.space</div>
              <div className="meta-row">
                <span className="count-badge">创建于 {formatCreatedAt(currentSpace.created_at)}</span>
                <span className="count-badge">管理员邮箱 {currentSpace.email}</span>
              </div>
            </div>

            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <span>成员</span>
                <strong>{dashboard?.stats.members_count ?? 0}</strong>
              </div>
              <div className="admin-stat-card">
                <span>在线</span>
                <strong>{dashboard?.stats.online_count ?? 0}</strong>
              </div>
            </div>

            <div className="admin-dashboard-actions">
              <button className="button" onClick={() => void copyEntryLink()} type="button">
                {copied ? "已复制入口" : "复制成员入口"}
              </button>
              <a className="ghost-button" href={entryHref}>
                打开成员入口
              </a>
            </div>
          </section>
        ) : null}

        {currentSpace ? (
          <section className="panel admin-dashboard-section">
            <div className="admin-section-head">
              <div>
                <p className="eyebrow">Settings</p>
                <h3 className="panel-title">基础设置</h3>
              </div>
            </div>

            <div className="field-stack">
              <div>
                <label className="field-label">空间名称</label>
                <input className="input" placeholder="输入空间名称" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} />
              </div>

              <div>
                <label className="field-label">成员上限</label>
                <input
                  className="input mono"
                  inputMode="numeric"
                  placeholder="留空表示不限制"
                  value={settingsMemberLimit}
                  onChange={(event) => setSettingsMemberLimit(event.target.value.replace(/[^\d]/g, ""))}
                />
                <div className="field-help">当前成员数 {dashboard?.stats.members_count ?? 0}，不能设置得比当前更低。</div>
              </div>

              <div className="admin-toggle-row">
                <div className="row-main">
                  <strong>空间广场</strong>
                  <div className="row-subtle">控制这个空间的成员是否可以进入广场。</div>
                </div>
                <button className={`mode-pill ${settingsSquareEnabled ? "active" : ""}`} onClick={() => setSettingsSquareEnabled((current) => !current)} type="button">
                  {settingsSquareEnabled ? "已开启" : "已关闭"}
                </button>
              </div>
            </div>

            <button className="button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">
              {settingsSaving ? "保存中..." : "保存基础设置"}
            </button>
          </section>
        ) : null}

        {currentSpace?.official_user ? (
          <section className="panel admin-dashboard-section">
            <div className="admin-section-head">
              <div>
                <p className="eyebrow">Official</p>
                <h3 className="panel-title">官方账号</h3>
              </div>
            </div>
            <div className="simple-row person-row admin-official-row">
              <UserAvatar className="mini-avatar" name={currentSpace.official_user.name} uri={currentSpace.official_user.avatar_uri} />
              <div className="row-main">
                <strong>{currentSpace.official_user.name}</strong>
                <div className="row-subtle">加入成员后，会默认和它建立关系并收到欢迎消息。</div>
              </div>
              <button className="button row-button" disabled={officialLoginBusy} onClick={() => void loginAsOfficial()} type="button">
                {officialLoginBusy ? "进入中..." : "进入账号"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="panel admin-dashboard-section">
          <div className="admin-section-head">
            <div>
              <p className="eyebrow">Members</p>
              <h3 className="panel-title">成员</h3>
            </div>
            <div className="list-segment segmented-switch">
              <button className={`tab-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")} type="button">
                全部
              </button>
              <button className={`tab-chip ${filter === "online" ? "active" : ""}`} onClick={() => setFilter("online")} type="button">
                在线
              </button>
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

          {memberState === "loading" ? <FeedbackState title="成员加载中" description="正在同步成员列表。" tone="loading" /> : null}

          {members.length ? (
            <div className="simple-list">
              {members.map((user) => (
                <div className="simple-row person-row" key={user.user_id}>
                  <UserAvatar className={`mini-avatar ${user.is_alive ? "status-online" : ""}`} name={user.name} uri={user.avatar_uri} />
                  <div className="row-main">
                    <div className="title-row">
                      <strong>{user.name}</strong>
                      {user.verified ? <span className="verified-badge">Verified</span> : null}
                      {user.official ? <span className="type-badge">官方</span> : null}
                      {user.is_deleted ? <span className="type-badge">历史残留</span> : null}
                    </div>
                    <div className="row-subtle">
                      {user.is_deleted ? "已删除，但仍残留在旧关系里" : user.is_alive ? "在线" : "离线"}
                    </div>
                  </div>
                  <button className="ghost-button row-button" onClick={() => setRemoveUser(user)} type="button">
                    {user.is_deleted ? "彻底移除" : "移出"}
                  </button>
                </div>
              ))}
            </div>
          ) : memberState === "ready" ? (
            <FeedbackState title="还没有成员" description={query.trim() ? "换个关键词试试。" : filter === "online" ? "当前没有在线成员。" : "成员进入后会出现在这里。"} />
          ) : null}
        </section>
      </section>

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
