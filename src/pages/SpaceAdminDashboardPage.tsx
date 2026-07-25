import { type ChangeEvent, type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { resolveMediaKind, toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import { copyText } from "../lib/presentation";
import { setCachedGroupSquareEnabled } from "../lib/spaceFeatures";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import type { AdminMemberDTO, AppViewState, MessageMediaKind, SpaceAdminBroadcastResultDTO, SpaceAdminDashboardDTO } from "../types";

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

const BROADCAST_MESSAGE_TYPE = {
  text: 0,
  image: 1,
  file: 2,
  video: 4,
  audio: 5,
} as const;
const AUDIO_MAX_DURATION_SECONDS = 60;

function broadcastTypeForKind(kind: MessageMediaKind) {
  return BROADCAST_MESSAGE_TYPE[kind];
}

function formatBroadcastDuration(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function AdminComposerIcon({ kind }: { kind: "mic" | "gallery" | "file" | "delete" | "stop" }) {
  if (kind === "gallery") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <rect x="3.5" y="5" width="17" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1.7" fill="currentColor" />
        <path d="m7 16.5 4.2-4.2a1.1 1.1 0 0 1 1.56 0l1.58 1.58a1.1 1.1 0 0 0 1.56 0L17 12.6l3.5 3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "file") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M7 3.75h6.7L18.5 8.6v11.65H7V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M13.5 4v5h4.75M9.5 13h6M9.5 16.5h4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "delete") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M7 7.5h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-11ZM5 6h14M9 6V4h6v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "stop") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="9" y="9" width="6" height="6" rx="1.3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect x="8.25" y="3.5" width="7.5" height="11.5" rx="3.75" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

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
  const [settingsLevelNames, setSettingsLevelNames] = useState<string[]>(["初来", "同频", "热聊", "浪潮", "尽兴"]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [officialLoginBusy, setOfficialLoginBusy] = useState(false);
  const [removeUser, setRemoveUser] = useState<AdminMemberDTO | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastState, setBroadcastState] = useState<"idle" | "sending" | "sent">("idle");
  const [broadcastResult, setBroadcastResult] = useState<SpaceAdminBroadcastResultDTO | null>(null);
  const [broadcastMoreOpen, setBroadcastMoreOpen] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastRecording, setBroadcastRecording] = useState<{
    phase: "idle" | "recording" | "recorded";
    duration: number;
    file: File | null;
  }>({ phase: "idle", duration: 0, file: null });
  const broadcastIdRef = useRef("");
  const broadcastGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const broadcastFileInputRef = useRef<HTMLInputElement | null>(null);
  const broadcastRecorderRef = useRef<MediaRecorder | null>(null);
  const broadcastStreamRef = useRef<MediaStream | null>(null);
  const broadcastChunksRef = useRef<Blob[]>([]);
  const broadcastRecordingStartedAtRef = useRef(0);
  const broadcastRecordingTimerRef = useRef<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const currentSpace = dashboard?.space ?? session?.space ?? null;
  const entryHref = useMemo(() => (currentSpace ? buildJoinHrefForCurrentHost(currentSpace.slug) : ""), [currentSpace]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => () => {
    if (broadcastRecordingTimerRef.current !== null) window.clearInterval(broadcastRecordingTimerRef.current);
    broadcastStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
    setSettingsLevelNames(dashboard.space.level_names?.length === 5 ? dashboard.space.level_names : ["初来", "同频", "热聊", "浪潮", "尽兴"]);
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
        level_names: settingsLevelNames.map((name) => name.trim()),
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

  const sendBroadcastPayload = async (type: number, content: string, broadcastId: string) => {
    return api.broadcastAdminMessage({
      content,
      type,
      broadcast_id: broadcastId,
    });
  };

  const finishBroadcast = (results: SpaceAdminBroadcastResultDTO[]) => {
    setBroadcastResult(results.reduce<SpaceAdminBroadcastResultDTO>(
      (total, result) => ({
        recipients_count: Math.max(total.recipients_count, result.recipients_count),
        sent_count: total.sent_count + result.sent_count,
        duplicate_count: total.duplicate_count + result.duplicate_count,
      }),
      { recipients_count: 0, sent_count: 0, duplicate_count: 0 }
    ));
    setBroadcastProgress(1);
    setBroadcastState("sent");
  };

  const sendBroadcast = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = broadcastContent.trim();
    if (!content || broadcastState === "sending") return;
    setBroadcastState("sending");
    setBroadcastProgress(0.08);
    setError(null);
    try {
      const payload = await sendBroadcastPayload(BROADCAST_MESSAGE_TYPE.text, content, broadcastIdRef.current);
      setBroadcastContent("");
      finishBroadcast([payload]);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "群发消息失败");
      setBroadcastState("idle");
      setBroadcastProgress(0);
    }
  };

  const openBroadcast = () => {
    broadcastIdRef.current = `admin-broadcast:${crypto.randomUUID()}`;
    setBroadcastProgress(0);
    setBroadcastOpen(true);
  };

  const stopBroadcastRecordingResources = () => {
    if (broadcastRecordingTimerRef.current !== null) {
      window.clearInterval(broadcastRecordingTimerRef.current);
      broadcastRecordingTimerRef.current = null;
    }
    broadcastStreamRef.current?.getTracks().forEach((track) => track.stop());
    broadcastStreamRef.current = null;
    broadcastRecorderRef.current = null;
  };

  const cancelBroadcastRecording = () => {
    if (broadcastRecorderRef.current?.state === "recording") {
      broadcastRecorderRef.current.onstop = null;
      broadcastRecorderRef.current.stop();
    }
    stopBroadcastRecordingResources();
    broadcastChunksRef.current = [];
    setBroadcastRecording({ phase: "idle", duration: 0, file: null });
  };

  const startBroadcastRecording = async () => {
    if (broadcastState === "sending" || broadcastRecording.phase !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前设备暂不支持录音。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      broadcastStreamRef.current = stream;
      broadcastRecorderRef.current = recorder;
      broadcastChunksRef.current = [];
      broadcastRecordingStartedAtRef.current = Date.now();
      setBroadcastMoreOpen(false);
      setBroadcastRecording({ phase: "recording", duration: 0, file: null });

      recorder.ondataavailable = (recordEvent) => {
        if (recordEvent.data.size) broadcastChunksRef.current.push(recordEvent.data);
      };
      recorder.onstop = () => {
        const duration = Math.max(1, Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - broadcastRecordingStartedAtRef.current) / 1000));
        const resolvedType = recorder.mimeType || mimeType || "audio/webm";
        const extension = resolvedType.includes("mp4") ? "m4a" : resolvedType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(broadcastChunksRef.current, { type: resolvedType });
        const file = new File([blob], `broadcast-${Date.now()}.${extension}`, { type: resolvedType });
        stopBroadcastRecordingResources();
        setBroadcastRecording({ phase: "recorded", duration, file });
      };
      recorder.start(250);
      broadcastRecordingTimerRef.current = window.setInterval(() => {
        const duration = Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - broadcastRecordingStartedAtRef.current) / 1000);
        setBroadcastRecording((current) => ({ ...current, duration }));
        if (duration >= AUDIO_MAX_DURATION_SECONDS && recorder.state === "recording") recorder.stop();
      }, 200);
    } catch {
      stopBroadcastRecordingResources();
      setBroadcastRecording({ phase: "idle", duration: 0, file: null });
      setError("无法开始录音，请检查麦克风权限。");
    }
  };

  const stopBroadcastRecording = () => {
    if (broadcastRecorderRef.current?.state === "recording") broadcastRecorderRef.current.stop();
  };

  const sendBroadcastMedia = async (
    files: Array<{ file: File; kind: MessageMediaKind; duration?: number }>
  ) => {
    if (!files.length || broadcastState === "sending") return;
    setBroadcastState("sending");
    setBroadcastProgress(0.02);
    setError(null);
    const results: SpaceAdminBroadcastResultDTO[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const { file, kind, duration } = files[index];
        const upload = await uploadMessageMediaWith(
          file,
          kind,
          (mediaKind, fileName, contentType) => api.createAdminBroadcastUpload(mediaKind, fileName, contentType),
          (progress) => setBroadcastProgress((index + progress * 0.82) / files.length)
        );
        const content = JSON.stringify({
          key: upload.key,
          mime_type: file.type,
          duration_seconds: kind === "audio" ? duration : undefined,
          file_name: kind === "file" ? file.name : undefined,
          file_size: kind === "file" ? file.size : undefined,
        });
        const result = await sendBroadcastPayload(
          broadcastTypeForKind(kind),
          content,
          `admin-broadcast:${crypto.randomUUID()}`
        );
        results.push(result);
        setBroadcastProgress((index + 1) / files.length);
      }
      setBroadcastRecording({ phase: "idle", duration: 0, file: null });
      finishBroadcast(results);
    } catch (uploadError) {
      setError(toMessageUploadError(uploadError).message);
      setBroadcastState("idle");
      setBroadcastProgress(0);
    }
  };

  const handleBroadcastFiles = async (event: ChangeEvent<HTMLInputElement>, source: "gallery" | "file") => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    setBroadcastMoreOpen(false);
    try {
      const files = selectedFiles.map((file) => ({
        file,
        kind: source === "file" ? "file" as const : resolveMediaKind(file),
      }));
      await sendBroadcastMedia(files);
    } catch (uploadError) {
      setError(toMessageUploadError(uploadError).message);
    }
  };

  const closeBroadcast = () => {
    if (broadcastState === "sending") return;
    cancelBroadcastRecording();
    setBroadcastOpen(false);
    setBroadcastState("idle");
    setBroadcastResult(null);
    setBroadcastContent("");
    setBroadcastMoreOpen(false);
    setBroadcastProgress(0);
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
                      <th>等级</th>
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
                        <td><span className="admin-growth-level">Lv.{user.growth_level ?? 1} {user.growth_level_name ?? settingsLevelNames[(user.growth_level ?? 1) - 1]}</span></td>
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
                  <div>
                    <label className="field-label">空间等级</label>
                    <div className="admin-level-name-grid">
                      {settingsLevelNames.map((levelName, index) => (
                        <label key={index}>
                          <span>Lv.{index + 1}</span>
                          <input
                            className="input"
                            maxLength={8}
                            value={levelName}
                            onChange={(event) => setSettingsLevelNames((current) => current.map((name, levelIndex) => levelIndex === index ? event.target.value : name))}
                          />
                        </label>
                      ))}
                    </div>
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
            {broadcastState === "sending" ? (
              <div aria-label={`发送进度 ${Math.round(broadcastProgress * 100)}%`} className="admin-broadcast-progress" role="progressbar">
                <span style={{ transform: `scaleX(${Math.max(0.02, broadcastProgress)})` }} />
              </div>
            ) : null}
            <form className={`composer admin-broadcast-composer${broadcastRecording.phase !== "idle" ? " is-recording-mode" : ""}`} onSubmit={(event) => void sendBroadcast(event)}>
              {broadcastRecording.phase === "idle" ? (
                <div className="composer-row composer-row-text">
                  <button
                    aria-label="录制语音"
                    className="composer-action-button"
                    disabled={broadcastState === "sending"}
                    onClick={() => void startBroadcastRecording()}
                    type="button"
                  >
                    <span className="admin-composer-svg"><AdminComposerIcon kind="mic" /></span>
                  </button>
                  <div className="composer-input-wrap">
                    <textarea
                      className="textarea composer-input"
                      enterKeyHint="send"
                      maxLength={512}
                      placeholder="输入消息..."
                      rows={1}
                      value={broadcastContent}
                      onChange={(event) => setBroadcastContent(event.target.value)}
                      onKeyDown={(event) => {
                        const nativeEvent = event.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
                        if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                  </div>
                  <button
                    aria-expanded={broadcastMoreOpen}
                    aria-label={broadcastMoreOpen ? "收起更多操作" : "展开更多操作"}
                    className={`composer-plus ${broadcastMoreOpen ? "is-open" : ""}`}
                    disabled={broadcastState === "sending"}
                    onClick={() => setBroadcastMoreOpen((current) => !current)}
                    type="button"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                  <button hidden disabled={!broadcastContent.trim()} type="submit" />
                </div>
              ) : (
                <div className="composer-row composer-row-recording">
                  <button
                    aria-label="删除录音"
                    className="composer-recording-delete"
                    disabled={broadcastState === "sending"}
                    onClick={cancelBroadcastRecording}
                    type="button"
                  >
                    <span className="admin-composer-svg"><AdminComposerIcon kind="delete" /></span>
                  </button>
                  <div className="composer-recording-bar">
                    <button
                      aria-label="停止录音"
                      className="composer-recording-stop"
                      disabled={broadcastRecording.phase !== "recording"}
                      onClick={stopBroadcastRecording}
                      type="button"
                    >
                      <span className="admin-composer-svg"><AdminComposerIcon kind="stop" /></span>
                    </button>
                    <div aria-hidden="true" className={`admin-broadcast-waveform${broadcastRecording.phase === "recording" ? " is-recording" : ""}`}>
                      {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
                    </div>
                    <span className="composer-recording-time">{formatBroadcastDuration(broadcastRecording.duration)}</span>
                  </div>
                  <button
                    aria-label="发送录音"
                    className="composer-recording-send"
                    disabled={broadcastRecording.phase !== "recorded" || !broadcastRecording.file || broadcastState === "sending"}
                    onClick={() => {
                      if (!broadcastRecording.file) return;
                      void sendBroadcastMedia([{
                        file: broadcastRecording.file,
                        kind: "audio",
                        duration: broadcastRecording.duration,
                      }]);
                    }}
                    type="button"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              )}
              {broadcastRecording.phase === "idle" ? (
                <div className={`composer-actions-reveal ${broadcastMoreOpen ? "is-open" : ""}`} aria-hidden={!broadcastMoreOpen}>
                  <div className="composer-actions-grid">
                    <button className="composer-action-tile" disabled={broadcastState === "sending"} onClick={() => broadcastGalleryInputRef.current?.click()} type="button">
                      <span className="composer-action-tile-icon"><AdminComposerIcon kind="gallery" /></span>
                      <span>相册</span>
                    </button>
                    <button className="composer-action-tile" disabled={broadcastState === "sending"} onClick={() => broadcastFileInputRef.current?.click()} type="button">
                      <span className="composer-action-tile-icon"><AdminComposerIcon kind="file" /></span>
                      <span>文件</span>
                    </button>
                  </div>
                </div>
              ) : null}
              <input ref={broadcastGalleryInputRef} accept="image/*,video/*" hidden multiple onChange={(event) => void handleBroadcastFiles(event, "gallery")} type="file" />
              <input ref={broadcastFileInputRef} hidden multiple onChange={(event) => void handleBroadcastFiles(event, "file")} type="file" />
            </form>
            <div className="admin-broadcast-meta">
              <span>{broadcastContent.length}/512</span>
              <span>{broadcastState === "sending" ? `${Math.round(broadcastProgress * 100)}%` : "发送给全部成员"}</span>
            </div>
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
