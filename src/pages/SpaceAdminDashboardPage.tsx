import { type ChangeEvent, type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { SideDrawer } from "../components/SideDrawer";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { SettingGroup, SettingRow, SettingSwitch } from "../components/SettingRow";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { resolveMediaKind, toMessageUploadError, uploadFormData, uploadMessageMediaWith } from "../lib/messageUpload";
import { copyText } from "../lib/presentation";
import { setCachedSpaceFeatures } from "../lib/spaceFeatures";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { getActiveLocale, i18n, useI18n, type TranslationKey } from "../lib/language";
import type { AdminMemberDTO, AppViewState, MessageMediaKind, SpaceAdminBroadcastResultDTO, SpaceAdminDashboardDTO, SquareStatementDTO } from "../types";
import { showToast } from "../lib/toast";

type MemberFilter = "all" | "online";
type AdminTab = "members" | "square" | "menu";

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
  const [activeTab, setActiveTab] = useState<AdminTab>("members");
  const [selectedMember, setSelectedMember] = useState<AdminMemberDTO | null>(null);
  const [squareStatements, setSquareStatements] = useState<SquareStatementDTO[]>([]);
  const [squareState, setSquareState] = useState<AppViewState>("idle");
  const [copied, setCopied] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSquareEnabled, setSettingsSquareEnabled] = useState(false);
  const [settingsChatEnabled, setSettingsChatEnabled] = useState(true);
  const [settingsExploreEnabled, setSettingsExploreEnabled] = useState(true);
  const [settingsUnverifiedGroupPolicy, setSettingsUnverifiedGroupPolicy] = useState<0 | 1 | 2>(2);
  const [basicSettingsOpen, setBasicSettingsOpen] = useState(false);
  const [moduleSettingsOpen, setModuleSettingsOpen] = useState(false);
  const [accessPolicyOpen, setAccessPolicyOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPhoneCode, setAdminPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const identityInputRef = useRef<HTMLInputElement | null>(null);
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
  const adminTabs: Array<{ key: AdminTab; icon: string; label: string }> = [
    { key: "members", icon: "group", label: t("admin.members") },
    ...(settingsSquareEnabled ? [{ key: "square" as const, icon: "explore", label: t("nav.square") }] : []),
    { key: "menu", icon: "menu", label: t("nav.menu") },
  ];
  const formatRelativeTime = (value: number) => {
    const minutes = Math.max(0, Math.floor((Date.now() / 1000 - value) / 60));
    if (minutes < 1) return t("time.justNow");
    if (minutes < 60) return t("time.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hoursAgo", { count: hours });
    return new Date(value * 1000).toLocaleDateString(getActiveLocale(), { month: "short", day: "numeric" });
  };

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
    setSettingsChatEnabled(dashboard.space.chat_enabled !== false);
    setSettingsExploreEnabled(dashboard.space.square_explore_enabled !== false);
    setSettingsUnverifiedGroupPolicy(dashboard.space.unverified_group_policy ?? 2);
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

  useEffect(() => {
    if (activeTab !== "square" || !settingsSquareEnabled || squareState === "ready") return;
    const controller = new AbortController();
    setSquareState("loading");
    api.getAdminSquareStatements({ limit: 30 }, controller.signal).then((rows) => {
      setSquareStatements(rows);
      setSquareState("ready");
    }).catch((apiError) => {
      if (controller.signal.aborted) return;
      setSquareState("error");
      showToast(apiError instanceof ApiError ? apiError.message : t("admin.dashboardLoadFailed"), "error");
    });
    return () => controller.abort();
  }, [activeTab, settingsSquareEnabled, squareState, t]);

  const copyEntryLink = async () => {
    if (!entryHref) return;
    try {
      const copied = await copyText(entryHref);
      if (!copied) throw new Error("copy_failed");
      setCopied(true);
      showToast(t("admin.entryCopied"), "success");
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
        chat_enabled: settingsChatEnabled ? 1 : 0,
        square_explore_enabled: settingsExploreEnabled ? 1 : 0,
        unverified_group_policy: settingsUnverifiedGroupPolicy,
        member_limit: settingsMemberLimit.trim() ? Number(settingsMemberLimit.trim()) : null,
        level_names: settingsLevelNames.map((name) => name.trim()),
      });
      setCachedSpaceFeatures(payload.space_id, {
        chatEnabled: payload.chat_enabled !== false,
        squareEnabled: payload.group_square_enabled !== false,
        squareExploreEnabled: payload.square_explore_enabled !== false,
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
      setBasicSettingsOpen(false);
      setModuleSettingsOpen(false);
      setAccessPolicyOpen(false);
      showToast(t("admin.settingsSaved"), "success");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("admin.settingsSaveFailed"));
    } finally {
      setSettingsSaving(false);
    }
  };

  const patchDashboardSpace = (space: SpaceAdminDashboardDTO["space"]) => {
    patchSpace(space);
    setDashboard((current) => current ? { ...current, space } : current);
  };

  const sendPhoneCode = async () => {
    if (!adminPhone.trim()) return;
    setVerificationBusy(true);
    setError(null);
    try {
      await api.sendAdminPhoneCode(adminPhone.trim());
      setPhoneCodeSent(true);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("admin.phoneCodeFailed"));
    } finally {
      setVerificationBusy(false);
    }
  };

  const verifyPhone = async () => {
    if (!adminPhone.trim() || !adminPhoneCode.trim()) return;
    setVerificationBusy(true);
    setError(null);
    try {
      patchDashboardSpace(await api.verifyAdminPhone(adminPhone.trim(), adminPhoneCode.trim()));
      setPhoneCodeSent(false);
      setAdminPhoneCode("");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("admin.phoneVerifyFailed"));
    } finally {
      setVerificationBusy(false);
    }
  };

  const submitIdentity = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setError(t("admin.identityFileInvalid"));
      return;
    }
    setVerificationBusy(true);
    setError(null);
    try {
      const upload = await api.createSpaceIdentityUpload(file.name, file.type);
      const data = new FormData();
      data.set("token", upload.upload_token);
      data.set("key", upload.key);
      data.set("file", file);
      await uploadFormData(upload.upload_url, data);
      patchDashboardSpace(await api.submitSpaceIdentity(upload.key));
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : t("admin.identitySubmitFailed"));
    } finally {
      setVerificationBusy(false);
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
      <section className="admin-app-shell">
        <nav className="admin-app-nav" aria-label={t("admin.dashboardTitle")}>
          <div className="admin-nav-brand">
            <UserAvatar className="admin-nav-space-avatar" name={currentSpace?.name ?? "Sermo"} uri={currentSpace?.official_user?.avatar_uri} />
            <span><strong>{currentSpace?.name}</strong><small>@{currentSpace?.slug}</small></span>
          </div>
          <div className="admin-nav-items">
            {adminTabs.map((item) => <button aria-current={activeTab === item.key ? "page" : undefined} className={activeTab === item.key ? "is-active" : ""} key={item.key} onClick={() => setActiveTab(item.key)} type="button"><span className="material-symbols-outlined">{item.icon}</span><span>{item.label}</span></button>)}
          </div>
          <button className="admin-nav-logout" onClick={() => logout()} type="button"><span className="material-symbols-outlined">logout</span><span>{t("auth.logout")}</span></button>
        </nav>

        <div className="admin-app-content">
          <header className="admin-app-header">
            <div><h1>{adminTabs.find((item) => item.key === activeTab)?.label}</h1><span>{currentSpace?.name}</span></div>
            <HeaderSyncIndicator syncing={dashboardState === "loading" || memberState === "loading" || squareState === "loading"} />
          </header>

          {activeTab === "members" ? <section className="admin-tab-page admin-members-tab">
            <div className="admin-members-overview">
              <span><strong>{dashboard?.stats.members_count ?? 0}</strong>{t("admin.members")}</span>
              <span><strong>{dashboard?.stats.online_count ?? 0}</strong>{t("presence.online")}</span>
              <button onClick={openBroadcast} type="button"><span className="material-symbols-outlined">campaign</span>{t("admin.broadcast")}</button>
            </div>
            <div className="admin-list-tools">
              <label className="admin-member-search"><span className="material-symbols-outlined">search</span><input placeholder={t("admin.searchMembers")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <div className="admin-filter-tabs"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")} type="button">{t("common.all")}</button><button className={filter === "online" ? "is-active" : ""} onClick={() => setFilter("online")} type="button">{t("presence.online")}</button></div>
            </div>
            <div className="admin-member-list">
              {members.map((user) => <button className="admin-member-row" key={user.user_id} onClick={() => setSelectedMember(user)} type="button">
                <span className="admin-member-avatar-wrap"><UserAvatar className="admin-member-avatar" name={user.name} uri={user.avatar_uri} />{user.is_alive && !user.is_deleted ? <i /> : null}</span>
                <span className="admin-member-main"><span><strong>{user.name}</strong><b>LV.{user.growth_level ?? 1}</b>{user.verified ? <em>{t("admin.verified")}</em> : null}</span><small>{user.is_deleted ? t("admin.historicalResidual") : `${user.friend_count ?? 0} ${t("admin.friends")} · ${user.statement_count ?? 0} ${t("admin.statements")}`}</small></span>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>)}
              {!members.length && memberState === "ready" ? <FeedbackState title={t("admin.noMembers")} description={query.trim() ? t("common.tryAnotherKeyword") : ""} /> : null}
            </div>
          </section> : null}

          {activeTab === "square" ? <section className="admin-tab-page admin-square-tab">
            <div className="admin-square-intro"><span><strong>{t("admin.squareManagement")}</strong><small>{t("admin.squareManagementHint")}</small></span><button onClick={() => setSquareState("idle")} type="button"><span className="material-symbols-outlined">refresh</span></button></div>
            <div className="admin-square-feed">
              {squareStatements.map((statement) => <article className="admin-statement" key={statement.statement_id}>
                <header><UserAvatar className="admin-statement-avatar" name={statement.user.name} uri={statement.user.avatar_uri} /><span><strong>{statement.user.name}</strong><small>{formatRelativeTime(statement.created_at)}</small></span><b>{statement.visibility === "friends" ? t("square.friendsOnly") : t("square.public")}</b></header>
                {statement.text ? <p>{statement.text}</p> : null}
                {statement.media.length ? <div className="admin-statement-media">{statement.media.slice(0, 3).map((media) => media.kind === "image" ? <img alt="" key={media.media_id} src={media.thumbnail_uri || media.uri} /> : <span key={media.media_id}><span className="material-symbols-outlined">{media.kind === "video" ? "videocam" : "mic"}</span>{media.kind === "video" ? t("media.video") : t("media.audio")}</span>)}</div> : null}
                <footer><span>{statement.like_count} {t("square.like")}</span><span>{statement.comment_count} {t("square.comments")}</span></footer>
              </article>)}
              {!squareStatements.length && squareState === "ready" ? <FeedbackState title={t("square.empty")} /> : null}
            </div>
          </section> : null}

          {activeTab === "menu" && currentSpace ? <section className="admin-tab-page admin-menu-tab">
            <section className="admin-menu-profile"><UserAvatar className="admin-menu-avatar" name={currentSpace.name} uri={currentSpace.official_user?.avatar_uri} /><span><strong>{currentSpace.name}</strong><small>sermo.jyonn.space/{currentSpace.slug}</small></span><b>{dashboard?.stats.members_count ?? 0}/{currentSpace.effective_member_limit ?? currentSpace.tier_member_limit}</b></section>
            <section className="admin-menu-section"><h2>{t("admin.spaceGovernance")}</h2><div className="admin-menu-list">
              <button onClick={() => setBasicSettingsOpen(true)} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">settings</span></span><span><strong>{t("admin.basicSettings")}</strong><small>{currentSpace.email}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
              <button onClick={() => setModuleSettingsOpen(true)} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">tune</span></span><span><strong>{t("admin.featureAccess")}</strong><small>{settingsChatEnabled ? t("admin.chatOn") : t("admin.chatOff")} · {settingsSquareEnabled ? t("admin.squareOn") : t("admin.squareOff")}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
              <button onClick={() => setAccessPolicyOpen(true)} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">shield</span></span><span><strong>{t("admin.unverifiedAccess")}</strong><small>{t(`admin.unverifiedPolicy${settingsUnverifiedGroupPolicy}` as TranslationKey)}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
              <button onClick={() => setVerificationOpen(true)} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">verified_user</span></span><span><strong>{t("admin.spaceVerification")}</strong><small>{t(`admin.tier.${currentSpace.verification_tier ?? "email"}` as TranslationKey)}</small></span><span className="material-symbols-outlined">chevron_right</span></button>
            </div></section>
            <section className="admin-menu-section"><h2>{t("admin.officialAccount")}</h2><div className="admin-menu-list"><button onClick={openBroadcast} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">campaign</span></span><span><strong>{t("admin.broadcast")}</strong><small>{t("admin.broadcastDescription", { count: dashboard?.stats.members_count ?? 0 })}</small></span><span className="material-symbols-outlined">chevron_right</span></button><button disabled={officialLoginBusy} onClick={() => void loginAsOfficial()} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">login</span></span><span><strong>{t("admin.enterAccount")}</strong><small>{currentSpace.official_user?.name}</small></span><span className="material-symbols-outlined">chevron_right</span></button></div></section>
            <section className="admin-menu-section"><h2>{t("admin.spaceEntry")}</h2><div className="admin-menu-list"><button onClick={() => void copyEntryLink()} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">link</span></span><span><strong>{t("admin.copyMemberEntry")}</strong></span><span className="material-symbols-outlined">content_copy</span></button><a href={entryHref}><span className="admin-policy-icon"><span className="material-symbols-outlined">open_in_new</span></span><span><strong>{t("admin.openMemberEntry")}</strong></span><span className="material-symbols-outlined">chevron_right</span></a></div></section>
          </section> : null}
        </div>

        <nav className="admin-mobile-nav">{adminTabs.map((item) => <button aria-current={activeTab === item.key ? "page" : undefined} className={activeTab === item.key ? "is-active" : ""} key={item.key} onClick={() => setActiveTab(item.key)} type="button"><span className="material-symbols-outlined">{item.icon}</span><span>{item.label}</span></button>)}</nav>
      </section>

      <SideDrawer historyKey="admin-member-detail" onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} title={t("admin.memberDetail")}>
        {selectedMember ? <div className="admin-member-drawer"><section className="admin-member-profile"><UserAvatar className="admin-member-profile-avatar" name={selectedMember.name} uri={selectedMember.avatar_uri} /><span><strong>{selectedMember.name}</strong><small>{selectedMember.is_alive ? t("presence.online") : t("presence.offline")}</small></span><b>LV.{selectedMember.growth_level ?? 1}</b></section><section className="admin-member-facts"><div><span>{t("admin.verified")}</span><strong>{selectedMember.verified ? t("common.yes") : t("common.no")}</strong></div><div><span>{t("admin.friends")}</span><strong>{selectedMember.friend_count ?? 0}</strong></div><div><span>{t("admin.statements")}</span><strong>{selectedMember.statement_count ?? 0}</strong></div></section><section className="admin-member-detail-section"><h3>{t("admin.notificationAndContacts")}</h3><div className="admin-member-channel-list"><div><span>{t("channel.email")}</span>{notificationCell(selectedMember, "email", ADMIN_NOTIFICATION_CHANNEL.email)}</div><div><span>{t("channel.sms")}</span>{notificationCell(selectedMember, "sms", ADMIN_NOTIFICATION_CHANNEL.sms)}</div><div><span>{t("channel.instant")}</span>{notificationCell(selectedMember, "bark", ADMIN_NOTIFICATION_CHANNEL.bark)}</div></div></section><button className="admin-member-danger" onClick={() => { setRemoveUser(selectedMember); setSelectedMember(null); }} type="button">{selectedMember.is_deleted ? t("common.clean") : t("admin.remove")}</button></div> : null}
      </SideDrawer>

      <SideDrawer actionBusy={settingsSaving} actionLabel={t("common.save")} historyKey="admin-features" onAction={() => void saveSettings()} onClose={() => setModuleSettingsOpen(false)} open={moduleSettingsOpen} title={t("admin.featureAccess")}>
        <div className="admin-policy-drawer">
          <section className="admin-policy-intro"><strong>{t("admin.featureAccessTitle")}</strong><p>{t("admin.featureAccessHint")}</p></section>
          <SettingGroup>
            <SettingRow description={t("admin.chatFeatureHint")} title={t("nav.chats")} trailing={<SettingSwitch checked={settingsChatEnabled} label={t("nav.chats")} onChange={() => { if (settingsChatEnabled && !settingsSquareEnabled) return; setSettingsChatEnabled((value) => !value); }} />} />
            <SettingRow disabled={currentSpace?.verification_tier === "email"} description={currentSpace?.verification_tier === "email" ? t("admin.squareNeedsPhone") : t("admin.squareFeatureHint")} title={t("nav.square")} trailing={<SettingSwitch checked={settingsSquareEnabled} disabled={currentSpace?.verification_tier === "email"} label={t("nav.square")} onChange={() => { if (settingsSquareEnabled && !settingsChatEnabled) return; setSettingsSquareEnabled((value) => !value); }} />} />
            <SettingRow disabled={!settingsSquareEnabled} description={t("admin.exploreFeatureHint")} title={t("square.feedAll")} trailing={<SettingSwitch checked={settingsSquareEnabled && settingsExploreEnabled} disabled={!settingsSquareEnabled} label={t("square.feedAll")} onChange={() => setSettingsExploreEnabled((value) => !value)} />} />
          </SettingGroup>
          <p className="admin-policy-footnote">{t("admin.moduleSafetyHint")}</p>
        </div>
      </SideDrawer>

      <SideDrawer actionBusy={settingsSaving} actionLabel={t("common.save")} historyKey="admin-unverified-policy" onAction={() => void saveSettings()} onClose={() => setAccessPolicyOpen(false)} open={accessPolicyOpen} title={t("admin.unverifiedAccess")}>
        <div className="admin-policy-drawer">
          <section className="admin-policy-intro"><strong>{t("admin.unverifiedAccessTitle")}</strong><p>{t("admin.unverifiedAccessHint")}</p></section>
          <div className="admin-policy-options">
            {([2, 1, 0] as const).map((policy) => <button aria-pressed={settingsUnverifiedGroupPolicy === policy} className={settingsUnverifiedGroupPolicy === policy ? "is-selected" : ""} key={policy} onClick={() => setSettingsUnverifiedGroupPolicy(policy)} type="button"><span className="admin-policy-radio" /><span><strong>{t(`admin.unverifiedPolicy${policy}` as TranslationKey)}</strong><small>{t(`admin.unverifiedPolicy${policy}Hint` as TranslationKey)}</small></span></button>)}
          </div>
          <section className="admin-permission-matrix">
            <header><span>{t("admin.capability")}</span><span>{t("admin.currentResult")}</span></header>
            <div><span>{t("admin.browseSquare")}</span><strong>{t("common.enabled")}</strong></div>
            <div><span>{t("admin.publishAndInteract")}</span><strong className="is-locked">{t("admin.verificationRequired")}</strong></div>
            <div><span>{t("admin.receiveGroupInvite")}</span><strong>{settingsUnverifiedGroupPolicy >= 1 ? t("common.enabled") : t("common.disabled")}</strong></div>
            <div><span>{t("admin.sendGroupMessage")}</span><strong>{settingsUnverifiedGroupPolicy >= 2 ? t("common.enabled") : t("common.disabled")}</strong></div>
            <div><span>{t("admin.createOrInviteGroup")}</span><strong className="is-locked">{t("admin.verificationRequired")}</strong></div>
          </section>
        </div>
      </SideDrawer>

      <SideDrawer actionBusy={settingsSaving} actionLabel={t("common.save")} historyKey="admin-basic-settings" onAction={() => void saveSettings()} onClose={() => setBasicSettingsOpen(false)} open={basicSettingsOpen} title={t("admin.basicSettings")}>
        <div className="admin-policy-drawer"><section className="admin-policy-card field-stack"><div><label className="field-label">{t("admin.spaceName")}</label><input className="input" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} /></div><div><label className="field-label">{t("admin.memberLimit")}</label><input className="input mono" inputMode="numeric" max={currentSpace?.tier_member_limit ?? 5} placeholder={String(currentSpace?.tier_member_limit ?? 5)} value={settingsMemberLimit} onChange={(event) => setSettingsMemberLimit(event.target.value.replace(/[^\d]/g, ""))} /><small>{t("admin.memberTierLimit", { count: currentSpace?.tier_member_limit ?? 5 })}</small></div><div><label className="field-label">{t("admin.spaceLevels")}</label><div className="admin-level-name-grid">{settingsLevelNames.map((levelName, index) => <label key={index}><span>Lv.{index + 1}</span><input className="input" maxLength={8} value={levelName} onChange={(event) => setSettingsLevelNames((current) => current.map((name, levelIndex) => levelIndex === index ? event.target.value : name))} /></label>)}</div></div></section></div>
      </SideDrawer>

      <SideDrawer historyKey="admin-verification" onClose={() => setVerificationOpen(false)} open={verificationOpen} title={t("admin.spaceVerification")}>
        <div className="admin-policy-drawer admin-verification-drawer">
          <section className="admin-verification-tier">
            <span>{t(`admin.tier.${currentSpace?.verification_tier ?? "email"}` as TranslationKey)}</span>
            <strong>{currentSpace?.tier_member_limit ?? 5}</strong>
            <small>{t("admin.memberCapacity")}</small>
          </section>
          {currentSpace?.verification_tier === "email" ? <section className="admin-policy-card field-stack">
            <div><strong>{t("admin.verifyPhoneTitle")}</strong><small>{t("admin.verifyPhoneHint")}</small></div>
            <input className="input" inputMode="tel" placeholder={t("admin.phonePlaceholder")} value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} />
            {phoneCodeSent ? <VerificationCodeInput ariaLabel={t("admin.phoneCodePlaceholder")} value={adminPhoneCode} onChange={setAdminPhoneCode} /> : null}
            <button className="button" disabled={verificationBusy || !adminPhone.trim() || (phoneCodeSent && adminPhoneCode.length !== 6)} onClick={() => void (phoneCodeSent ? verifyPhone() : sendPhoneCode())} type="button">{phoneCodeSent ? t("admin.completePhoneVerification") : t("admin.sendPhoneCode")}</button>
          </section> : <section className="admin-policy-card field-stack">
            <div><strong>{t("admin.phoneVerified")}</strong><small>{currentSpace?.admin_phone}</small></div>
            {currentSpace?.identity_verified_at ? <div><strong>{t("admin.identityVerified")}</strong><small>{t("admin.identityCapacityHint")}</small></div> : currentSpace?.identity_submitted_at ? <div><strong>{t("admin.identityPending")}</strong><small>{t("admin.identityPendingHint")}</small></div> : <><div><strong>{t("admin.identityTitle")}</strong><small>{t("admin.identityHint")}</small></div><button className="ghost-button" disabled={verificationBusy} onClick={() => identityInputRef.current?.click()} type="button">{t("admin.uploadIdentity")}</button></>}
          </section>}
          <input ref={identityInputRef} accept="application/pdf,.pdf" hidden onChange={(event) => void submitIdentity(event)} type="file" />
        </div>
      </SideDrawer>

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
