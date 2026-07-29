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
import { getActiveLocale, i18n, useI18n } from "../lib/language";
import type { AdminMemberDTO, AppViewState, MessageMediaKind, SpaceAdminBroadcastResultDTO, SpaceAdminDashboardDTO } from "../types";

type MemberFilter = "all" | "online";

function formatCreatedAt(value?: number) {
  if (!value) return i18n.t("admin.justCreated");
  return new Date(value * 1000).toLocaleDateString(getActiveLocale(), {
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
  const { t } = useI18n();
  const defaultLevelNames = useMemo(() => t("admin.defaultLevelNames").split("|"), [t]);
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
  const [settingsLevelNames, setSettingsLevelNames] = useState<string[]>(defaultLevelNames);
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
        const message = apiError instanceof ApiError ? apiError.message : t("admin.dashboardLoadFailed");
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
    setSettingsLevelNames(dashboard.space.level_names?.length === 18 ? dashboard.space.level_names : defaultLevelNames);
  }, [dashboard?.space, defaultLevelNames]);

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
        const message = apiError instanceof ApiError ? apiError.message : t("admin.membersLoadFailed");
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
      setError(t("admin.copyEntryFailed"));
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
      setError(apiError instanceof ApiError ? apiError.message : t("admin.settingsSaveFailed"));
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
      setError(apiError instanceof ApiError ? apiError.message : t("admin.removeMemberFailed"));
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
      setError(apiError instanceof ApiError ? apiError.message : t("admin.officialLoginLinkFailed"));
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
      setError(apiError instanceof ApiError ? apiError.message : t("admin.broadcastFailed"));
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
      setError(t("audio.unsupported"));
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
      setError(t("audio.startFailed"));
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
    if (!contact.bound) return <span className="admin-channel-state is-muted">{t("channel.unbound")}</span>;
    if (!contact.verified) return <span className="admin-channel-state is-pending">{t("channel.pendingVerification")}</span>;
    if (key === "sms") return <span className="admin-channel-state is-muted">{t("common.unsupported")}</span>;
    return (
      <span className="admin-channel-state">
        <span className={`admin-table-dot ${preference?.enabled ? "is-on" : ""}`} />
        {preference?.enabled ? t("common.enabled") : t("common.disabled")} · {t("common.minutes", { count: preference?.offline_threshold_minutes ?? 30 })}
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
      title={t("admin.dashboardTitle")}
      topbarAction={
        <button className="ghost-chip" onClick={() => logout()} type="button">
          {t("auth.logout")}
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
              <div className="admin-dashboard-domain">sermo.jyonn.space/{currentSpace.slug}</div>
            </div>

            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <strong>{dashboard?.stats.members_count ?? 0}</strong>
                <span>{t("admin.members")}</span>
              </div>
              <div className="admin-stat-card">
                <strong>{dashboard?.stats.online_count ?? 0}</strong>
                <span>{t("presence.online")}</span>
              </div>
            </div>

            <div className="admin-dashboard-actions">
              <button className="ghost-button" onClick={() => void copyEntryLink()} type="button">
                {copied ? t("admin.entryCopied") : t("admin.copyMemberEntry")}
              </button>
              <a className="ghost-button" href={entryHref}>
                {t("admin.openMemberEntry")}
              </a>
            </div>
          </section>
        ) : null}

        <div className="admin-dashboard-workspace">
          <section className="panel admin-dashboard-section admin-members-panel">
            <div className="admin-section-head">
              <div className="admin-section-title-row">
                <h2 className="panel-title">{t("admin.members")}</h2>
                <HeaderSyncIndicator syncing={memberState === "loading"} />
              </div>
              <div className="list-segment segmented-switch">
                <button className={`tab-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")} type="button">{t("common.all")}</button>
                <button className={`tab-chip ${filter === "online" ? "active" : ""}`} onClick={() => setFilter("online")} type="button">{t("presence.online")}</button>
              </div>
            </div>

            <label className="search-box page-search admin-member-search">
              <span className="material-symbols-outlined">search</span>
              <input
                className="input"
                style={{ border: 0, background: "transparent", height: "auto", padding: 0 }}
                placeholder={t("admin.searchMembers")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {members.length ? (
              <div className="admin-member-table-scroll">
                <table className="admin-member-table">
                  <thead>
                    <tr>
                      <th>{t("admin.members")}</th>
                      <th>{t("growth.level")}</th>
                      <th>{t("admin.verified")}</th>
                      <th>{t("channel.email")}</th>
                      <th>{t("channel.sms")}</th>
                      <th>{t("channel.instant")}</th>
                      <th aria-label={t("common.actions")} />
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
                              <span>{user.is_deleted ? t("admin.historicalResidual") : user.is_alive ? t("presence.online") : t("presence.offline")}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="admin-growth-level">Lv.{user.growth_level ?? 1} {user.growth_level_name ?? settingsLevelNames[(user.growth_level ?? 1) - 1]}</span></td>
                        <td><span className={`admin-verified-state ${user.verified ? "is-verified" : ""}`}>{user.verified ? t("common.yes") : t("common.no")}</span></td>
                        <td>{notificationCell(user, "email", ADMIN_NOTIFICATION_CHANNEL.email)}</td>
                        <td>{notificationCell(user, "sms", ADMIN_NOTIFICATION_CHANNEL.sms)}</td>
                        <td>{notificationCell(user, "bark", ADMIN_NOTIFICATION_CHANNEL.bark)}</td>
                        <td>
                          <button className="admin-member-remove" onClick={() => setRemoveUser(user)} type="button">
                            {user.is_deleted ? t("common.clean") : t("admin.remove")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : memberState === "ready" ? (
              <FeedbackState title={t("admin.noMembers")} description={query.trim() ? t("common.tryAnotherKeyword") : filter === "online" ? t("admin.noOnlineMembers") : ""} />
            ) : null}
          </section>

          <aside className="admin-dashboard-aside">
            {currentSpace?.official_user ? (
              <section className="panel admin-dashboard-section admin-official-panel">
                <h2 className="panel-title">{t("admin.officialAccount")}</h2>
                <div className="admin-official-profile">
                  <UserAvatar className="avatar" name={currentSpace.official_user.name} uri={currentSpace.official_user.avatar_uri} />
                  <div>
                    <strong>{currentSpace.official_user.name}</strong>
                    <span>@{currentSpace.slug}</span>
                  </div>
                </div>
                <div className="admin-official-actions">
                  <button className="button" disabled={!dashboard?.stats.members_count} onClick={openBroadcast} type="button">{t("admin.broadcast")}</button>
                  <button className="ghost-button" disabled={officialLoginBusy} onClick={() => void loginAsOfficial()} type="button">
                    {officialLoginBusy ? t("admin.enteringAccount") : t("admin.enterAccount")}
                  </button>
                </div>
              </section>
            ) : null}

            {currentSpace ? (
              <section className="panel admin-dashboard-section admin-settings-panel">
                <div className="admin-section-title-row">
                  <h2 className="panel-title">{t("admin.basicSettings")}</h2>
                  <span>{formatCreatedAt(currentSpace.created_at)}</span>
                </div>
                <div className="admin-settings-email">{currentSpace.email}</div>
                <div className="field-stack">
                  <div>
                    <label className="field-label">{t("admin.spaceName")}</label>
                    <input className="input" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">{t("admin.memberLimit")}</label>
                    <input
                      className="input mono"
                      inputMode="numeric"
                      placeholder={t("admin.unlimited")}
                      value={settingsMemberLimit}
                      onChange={(event) => setSettingsMemberLimit(event.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t("admin.spaceLevels")}</label>
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
                    <div className="row-main"><strong>{t("admin.spaceSquare")}</strong></div>
                    <button
                      aria-label={t("admin.toggleSpaceSquare")}
                      className={`switch ${settingsSquareEnabled ? "active" : ""}`}
                      onClick={() => setSettingsSquareEnabled((current) => !current)}
                      type="button"
                    />
                  </div>
                </div>
                <button className="ghost-button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">
                  {settingsSaving ? t("common.saving") : t("admin.saveSettings")}
                </button>
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      <BottomSheet
        open={broadcastOpen}
        title={t("admin.broadcast")}
        description={t("admin.broadcastDescription", { count: dashboard?.stats.members_count ?? 0 })}
        onClose={closeBroadcast}
      >
        {broadcastState === "sent" && broadcastResult ? (
          <div className="admin-broadcast-result">
            <span>{broadcastResult.sent_count}</span>
            <strong>{t("admin.messagesSent")}</strong>
            <button className="button" onClick={closeBroadcast} type="button">{t("common.done")}</button>
          </div>
        ) : (
          <div className="admin-broadcast-form">
            {broadcastState === "sending" ? (
              <div aria-label={t("admin.sendProgress", { progress: Math.round(broadcastProgress * 100) })} className="admin-broadcast-progress" role="progressbar">
                <span style={{ transform: `scaleX(${Math.max(0.02, broadcastProgress)})` }} />
              </div>
            ) : null}
            <form className={`composer admin-broadcast-composer${broadcastRecording.phase !== "idle" ? " is-recording-mode" : ""}`} onSubmit={(event) => void sendBroadcast(event)}>
              {broadcastRecording.phase === "idle" ? (
                <div className="composer-row composer-row-text">
                  <button
                    aria-label={t("audio.record")}
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
                      placeholder={t("chat.inputPlaceholder")}
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
                    aria-label={broadcastMoreOpen ? t("common.collapseMore") : t("common.expandMore")}
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
                    aria-label={t("audio.deleteRecording")}
                    className="composer-recording-delete"
                    disabled={broadcastState === "sending"}
                    onClick={cancelBroadcastRecording}
                    type="button"
                  >
                    <span className="admin-composer-svg"><AdminComposerIcon kind="delete" /></span>
                  </button>
                  <div className="composer-recording-bar">
                    <button
                      aria-label={t("audio.stopRecording")}
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
                    aria-label={t("audio.sendRecording")}
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
                      <span>{t("media.gallery")}</span>
                    </button>
                    <button className="composer-action-tile" disabled={broadcastState === "sending"} onClick={() => broadcastFileInputRef.current?.click()} type="button">
                      <span className="composer-action-tile-icon"><AdminComposerIcon kind="file" /></span>
                      <span>{t("media.file")}</span>
                    </button>
                  </div>
                </div>
              ) : null}
              <input ref={broadcastGalleryInputRef} accept="image/*,video/*" hidden multiple onChange={(event) => void handleBroadcastFiles(event, "gallery")} type="file" />
              <input ref={broadcastFileInputRef} hidden multiple onChange={(event) => void handleBroadcastFiles(event, "file")} type="file" />
            </form>
            <div className="admin-broadcast-meta">
              <span>{broadcastContent.length}/512</span>
              <span>{broadcastState === "sending" ? `${Math.round(broadcastProgress * 100)}%` : t("admin.sendToAllMembers")}</span>
            </div>
          </div>
        )}
      </BottomSheet>

      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
      <ConfirmDialog
        busy={removeBusy}
        confirmLabel={removeUser?.is_deleted ? t("admin.confirmClean") : t("admin.confirmRemove")}
        description={
          removeUser
            ? removeUser.is_deleted
              ? t("admin.cleanResidualHint", { name: removeUser.name })
              : t("admin.removeMemberHint", { name: removeUser.name })
            : ""
        }
        onClose={() => setRemoveUser(null)}
        onConfirm={() => void confirmRemoveUser()}
        open={Boolean(removeUser)}
        title={removeUser?.is_deleted ? t("admin.cleanResidualTitle") : t("admin.removeMemberTitle")}
      />
    </AppChrome>
  );
}
