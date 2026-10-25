import { type ChangeEvent, type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { managementSection, managementSettingsForSection, spaceManagementSections, type SpaceManagementSection } from "../lib/managementNavigation";
import { PageTabs } from "../components/PageTabs";
import { ManagementWorkspace } from "../components/ManagementWorkspace";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ChatMuteControls } from "../components/ChatMuteControls";
import { ChatComposerLayout, useMobileComposerLayout } from "../components/ChatComposerLayout";
import { ComposerSvgIcon } from "../components/ComposerSvgIcon";
import { MentionComposerInput, type MentionComposerHandle } from "../components/MentionComposerInput";
import { ComposerEmojiPicker } from "../components/ComposerEmojiPicker";
import { HoldToTalkInput } from "../components/HoldToTalkInput";
import { DesktopVoiceStudio } from "../components/DesktopVoiceStudio";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { SideDrawer } from "../components/SideDrawer";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { SettingGroup, SettingRow, SettingSwitch } from "../components/SettingRow";
import { PermissionWorkspace } from "../components/PermissionWorkspace";
import { SpaceAvatar, UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { audioFileExtension, createNoiseReducedAudioCapture, preferredAudioMimeType, type NoiseReducedAudioCapture } from "../lib/audioCapture";
import { useAdminAuth } from "../lib/adminAuth";
import { resolveMediaKind, toMessageUploadError, uploadFormData, uploadMessageMediaWith } from "../lib/messageUpload";
import { copyText } from "../lib/presentation";
import { setCachedSpaceFeatures } from "../lib/spaceFeatures";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { getActiveLocale, i18n, useI18n, type TranslationKey } from "../lib/language";
import type { AdminActivityDTO, AdminMemberDTO, AppViewState, ChatMuteDuration, MessageMediaKind, SpaceAdminBroadcastResultDTO, SpaceAdminDashboardDTO, SquareMuteDTO, SquareStatementDTO } from "../types";
import { showToast } from "../lib/toast";
import { PUBLIC_HOST } from "../lib/siteConfig";

type MemberFilter = "all" | "online";
type AdminTab = SpaceManagementSection;

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


export default function SpaceAdminDashboardPage() {
  const { t } = useI18n();
  const mobileComposerLayout = useMobileComposerLayout();
  const broadcastInputRef = useRef<MentionComposerHandle>(null);
  const broadcastComposerRef = useRef<HTMLFormElement>(null);
  const defaultLevelNames = useMemo(() => t("admin.defaultLevelNames").split("|"), [t]);
  const { session, logout, patchSpace } = useAdminAuth();
  const [dashboardState, setDashboardState] = useState<AppViewState>("idle");
  const [memberState, setMemberState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<SpaceAdminDashboardDTO | null>(null);
  const [members, setMembers] = useState<AdminMemberDTO[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = managementSection(searchParams.get("section"), spaceManagementSections, "members");
  const setActiveTab = (section: AdminTab) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("section", section); return next; });
  const [selectedMember, setSelectedMember] = useState<AdminMemberDTO | null>(null);
  const [squareStatements, setSquareStatements] = useState<SquareStatementDTO[]>([]);
  const [squareState, setSquareState] = useState<AppViewState>("idle");
  const [copied, setCopied] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSquareEnabled, setSettingsSquareEnabled] = useState(false);
  const [settingsChatEnabled, setSettingsChatEnabled] = useState(true);
  const [settingsSpaceGroupEnabled, setSettingsSpaceGroupEnabled] = useState(false);
  const [settingsSquareFreePostEnabled, setSettingsSquareFreePostEnabled] = useState(true);
  const [settingsSubmissionEnabled, setSettingsSubmissionEnabled] = useState(false);
  const [settingsExploreEnabled, setSettingsExploreEnabled] = useState(true);
  const [settingsQqBindingEnabled, setSettingsQqBindingEnabled] = useState(false);
  const [settingsOauthDeveloperEnabled, setSettingsOauthDeveloperEnabled] = useState(false);
  const [settingsUnverifiedGroupPolicy, setSettingsUnverifiedGroupPolicy] = useState<0 | 1 | 2>(2);
  const [activities, setActivities] = useState<AdminActivityDTO[]>([]);
  const [activitiesState, setActivitiesState] = useState<AppViewState>("idle");
  const [activityClaimingKey, setActivityClaimingKey] = useState<string | null>(null);
  const [squareMutes, setSquareMutes] = useState<SquareMuteDTO[]>([]);
  const [squareMutesState, setSquareMutesState] = useState<AppViewState>("idle");
  const [muteEditTarget, setMuteEditTarget] = useState<SquareMuteDTO | null>(null);
  const [muteDuration, setMuteDuration] = useState<"1d" | "3d" | "7d" | "30d" | "permanent">("1d");
  const [muteReason, setMuteReason] = useState("");
  const [muteBusy, setMuteBusy] = useState(false);
  const [unmuteTarget, setUnmuteTarget] = useState<SquareMuteDTO | null>(null);
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPhoneCode, setAdminPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const [settingsMemberLimit, setSettingsMemberLimit] = useState("");
  const [settingsLevelNames, setSettingsLevelNames] = useState<string[]>(defaultLevelNames);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [officialLoginBusy, setOfficialLoginBusy] = useState(false);
  const [operatorBusyUserId, setOperatorBusyUserId] = useState<number | null>(null);
  const [removeUser, setRemoveUser] = useState<AdminMemberDTO | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [globalChatMuteBusy, setGlobalChatMuteBusy] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastState, setBroadcastState] = useState<"idle" | "sending" | "sent">("idle");
  const [broadcastResult, setBroadcastResult] = useState<SpaceAdminBroadcastResultDTO | null>(null);
  const [broadcastMoreOpen, setBroadcastMoreOpen] = useState(false);
  const [voiceInputReady,setVoiceInputReady] = useState(false);
  const [desktopVoiceOpen, setDesktopVoiceOpen] = useState(false);
  useEffect(() => { setDesktopVoiceOpen(false); }, [mobileComposerLayout]);
  const [broadcastPreviewUri, setBroadcastPreviewUri] = useState("");
  const [broadcastPreviewPlaying, setBroadcastPreviewPlaying] = useState(false);
  const broadcastPreviewRef = useRef<HTMLAudioElement | null>(null);
  const broadcastRecordingAttemptRef = useRef(0);
  const [broadcastVoicePending, setBroadcastVoicePending] = useState(false);
  const [broadcastVoiceBars, setBroadcastVoiceBars] = useState<number[]>(Array(24).fill(.12));
  const [holdBusy,setHoldBusy] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastRecording, setBroadcastRecording] = useState<{
    phase: "idle" | "recording" | "recorded";
    duration: number;
    file: File | null;
  }>({ phase: "idle", duration: 0, file: null });
  useEffect(() => {
    const uri = broadcastRecording.file ? URL.createObjectURL(broadcastRecording.file) : "";
    setBroadcastPreviewUri(uri);
    setBroadcastPreviewPlaying(false);
    return () => { if (uri) URL.revokeObjectURL(uri); };
  }, [broadcastRecording.file]);
  const broadcastIdRef = useRef("");
  const broadcastGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const broadcastFileInputRef = useRef<HTMLInputElement | null>(null);
  const broadcastRecorderRef = useRef<MediaRecorder | null>(null);
  const broadcastAudioCaptureRef = useRef<NoiseReducedAudioCapture | null>(null);
  const broadcastChunksRef = useRef<Blob[]>([]);
  const broadcastRecordingStartedAtRef = useRef(0);
  const broadcastRecordingTimerRef = useRef<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const operators = dashboard?.operators ?? [];

  const currentSpace = dashboard?.space ?? session?.space ?? null;
  const communityEnabled = currentSpace?.group_square_enabled === true;
  const activeTab = (requestedTab === "square" || requestedTab === "mutes") && currentSpace && !communityEnabled ? "features" : requestedTab;
  const entryHref = useMemo(() => (currentSpace ? buildJoinHrefForCurrentHost(currentSpace.slug) : ""), [currentSpace]);
  const group = (id: string, icon: string) => ({ id, icon, label: t(`management.group.${id}` as TranslationKey) });
  const people = group("people", "group");
  const community = group("community", "forum");
  const operations = group("operations", "campaign");
  const configuration = group("configuration", "tune");
  const access = group("access", "shield");
  const adminTabs = [
    { id: "members", icon: "group", label: t("management.memberDirectory"), group: people },
    { id: "operators", icon: "shield_person", label: t("admin.operators"), group: people },
    ...(communityEnabled ? [
      { id: "square", icon: "explore", label: t("nav.square"), group: community },
      { id: "mutes", icon: "voice_over_off", label: t("admin.squareMutes"), group: community },
    ] : []),
    { id: "activities", icon: "local_activity", label: t("admin.activityManagement"), group: operations },
    { id: "official", icon: "campaign", label: t("admin.officialAccount"), group: operations },
    { id: "basics", icon: "settings", label: t("admin.basicSettings"), group: configuration },
    { id: "features", icon: "tune", label: t("admin.featureAccess"), group: configuration },
    { id: "levels", icon: "badge", label: t("admin.spaceLevels"), group: configuration },
    { id: "verification", icon: "verified_user", label: t("admin.spaceVerification"), group: configuration },
    { id: "access", icon: "shield", label: t("admin.unverifiedAccess"), group: access },
    { id: "permissions", icon: "account_tree", label: t("admin.permissionMatrix"), group: access },
  ];
  const formatRelativeTime = (value: number) => {
    const minutes = Math.max(0, Math.floor((Date.now() / 1000 - value) / 60));
    if (minutes < 1) return t("time.justNow");
    if (minutes < 60) return t("time.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hoursAgo", { count: hours });
    return new Date(value * 1000).toLocaleDateString(getActiveLocale(), { month: "short", day: "numeric" });
  };

  const setOperator = async (user: AdminMemberDTO, enabled: boolean) => {
    try {
      setOperatorBusyUserId(user.user_id);
      if (enabled) {
        const operator = await api.addSpaceOperator(user.user_id);
        setDashboard((current) => current ? { ...current, operators: [...current.operators.filter((item) => item.user.user_id !== user.user_id), operator] } : current);
      } else {
        await api.removeSpaceOperator(user.user_id);
        setDashboard((current) => current ? { ...current, operators: current.operators.filter((item) => item.user.user_id !== user.user_id) } : current);
      }
      setMembers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, operator: enabled } : item));
      setSelectedMember((current) => current?.user_id === user.user_id ? { ...current, operator: enabled } : current);
      showToast(t(enabled ? "admin.operatorAdded" : "admin.operatorRemoved"));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : t("admin.operatorUpdateFailed"), "error");
    } finally {
      setOperatorBusyUserId(null);
    }
  };

  const updateSelectedMemberChatMute = (userId: number, chatMute: AdminMemberDTO["chat_mute"]) => {
    setMembers((current) => current.map((item) => item.user_id === userId ? { ...item, chat_mute: chatMute } : item));
    setSelectedMember((current) => current?.user_id === userId ? { ...current, chat_mute: chatMute } : current);
  };

  const setGlobalChatMute = async (duration: ChatMuteDuration) => {
    if (!selectedMember || globalChatMuteBusy) return;
    setGlobalChatMuteBusy(true);
    try {
      const result = await api.setAdminGlobalChatMute(selectedMember.user_id, duration);
      updateSelectedMemberChatMute(selectedMember.user_id, result);
      showToast(t("admin.globalChatMuteUpdated"));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : t("admin.globalChatMuteFailed"), "error");
    } finally {
      setGlobalChatMuteBusy(false);
    }
  };

  const removeGlobalChatMute = async () => {
    if (!selectedMember || globalChatMuteBusy) return;
    setGlobalChatMuteBusy(true);
    try {
      const result = await api.removeAdminGlobalChatMute(selectedMember.user_id);
      updateSelectedMemberChatMute(selectedMember.user_id, result);
      showToast(t("admin.globalChatMuteRemoved"));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : t("admin.globalChatMuteFailed"), "error");
    } finally {
      setGlobalChatMuteBusy(false);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => () => {
    broadcastRecordingAttemptRef.current++;
    if (broadcastRecorderRef.current) {
      broadcastRecorderRef.current.onstop = null;
      if (broadcastRecorderRef.current.state === "recording") broadcastRecorderRef.current.stop();
    }
    if (broadcastRecordingTimerRef.current !== null) window.clearInterval(broadcastRecordingTimerRef.current);
    broadcastAudioCaptureRef.current?.cleanup();
    broadcastAudioCaptureRef.current = null;
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
    const controller = new AbortController();
    setActivitiesState("loading");
    api.getAdminActivities(controller.signal).then((payload) => {
      if (controller.signal.aborted) return;
      setActivities(payload);
      setActivitiesState("ready");
    }).catch(() => {
      if (!controller.signal.aborted) setActivitiesState("error");
    });
    return () => controller.abort();
  }, [refreshTick]);

  useEffect(() => {
    if (!dashboard?.space) return;
    setSettingsName(dashboard.space.name);
    setSettingsSquareEnabled(Boolean(dashboard.space.group_square_enabled));
    setSettingsChatEnabled(dashboard.space.chat_enabled !== false);
    setSettingsSpaceGroupEnabled(dashboard.space.space_group_enabled === true);
    setSettingsSquareFreePostEnabled(dashboard.space.square_free_post_enabled !== false);
    setSettingsSubmissionEnabled(dashboard.space.submission_enabled === true);
    setSettingsExploreEnabled(dashboard.space.square_explore_enabled !== false);
    setSettingsQqBindingEnabled(dashboard.space.qq_binding_enabled === true);
    setSettingsOauthDeveloperEnabled(dashboard.space.oauth_developer_enabled === true);
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

  useEffect(() => {
    if (activeTab !== "mutes") return;
    const controller = new AbortController();
    setSquareMutesState("loading");
    api.getAdminSquareMutes(controller.signal).then((rows) => {
      setSquareMutes(rows);
      setSquareMutesState("ready");
    }).catch((apiError) => {
      if (controller.signal.aborted) return;
      setSquareMutesState("error");
      showToast(apiError instanceof ApiError ? apiError.message : t("admin.muteLoadFailed"), "error");
    });
    return () => controller.abort();
  }, [activeTab, t]);

  const editSquareMute = (mute: SquareMuteDTO) => {
    setMuteEditTarget(mute);
    setMuteDuration(mute.permanent ? "permanent" : "1d");
    setMuteReason(mute.reason);
  };

  const saveSquareMute = async () => {
    if (!muteEditTarget || !muteReason.trim()) return;
    setMuteBusy(true);
    try {
      const updated = await api.setAdminSquareMute(muteEditTarget.user.user_id, muteDuration, muteReason.trim());
      setSquareMutes((rows) => rows.map((row) => row.user.user_id === updated.user.user_id ? updated : row));
      setMuteEditTarget(null);
      showToast(t("admin.muteUpdated"), "success");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("common.operationFailed"), "error");
    } finally {
      setMuteBusy(false);
    }
  };

  const removeSquareMute = async () => {
    if (!unmuteTarget) return;
    setMuteBusy(true);
    try {
      await api.removeAdminSquareMute(unmuteTarget.user.user_id);
      setSquareMutes((rows) => rows.filter((row) => row.user.user_id !== unmuteTarget.user.user_id));
      setUnmuteTarget(null);
      showToast(t("admin.muteRemoved"), "success");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("common.operationFailed"), "error");
    } finally {
      setMuteBusy(false);
    }
  };

  const claimActivity = async (activity: AdminActivityDTO) => {
    if (activity.claimed || activityClaimingKey) return;
    setActivityClaimingKey(activity.key);
    try {
      setActivities(await api.claimAdminActivity(activity.key));
      showToast(t("admin.activityClaimed", { name: activity.title }), "success");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : t("admin.activityClaimFailed"), "error");
    } finally {
      setActivityClaimingKey(null);
    }
  };

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
    if (activeTab === "features" && settingsSquareEnabled && !settingsSquareFreePostEnabled && !settingsSubmissionEnabled) {
      setError(t("admin.squareModesRequired"));
      return;
    }
    setSettingsSaving(true);
    setError(null);
    try {
      const payload = await api.updateAdminSettings(managementSettingsForSection<Parameters<typeof api.updateAdminSettings>[0]>(activeTab, {
        name: currentSpace.name,
        group_square_enabled: currentSpace.group_square_enabled ? 1 : 0,
        chat_enabled: currentSpace.chat_enabled !== false ? 1 : 0,
        space_group_enabled: currentSpace.space_group_enabled ? 1 : 0,
        square_free_post_enabled: currentSpace.square_free_post_enabled !== false ? 1 : 0,
        submission_enabled: currentSpace.submission_enabled ? 1 : 0,
        square_explore_enabled: currentSpace.square_explore_enabled !== false ? 1 : 0,
        qq_binding_enabled: currentSpace.qq_binding_enabled ? 1 : 0,
        ...(currentSpace.oauth_developer_granted ? { oauth_developer_enabled: currentSpace.oauth_developer_enabled ? 1 : 0 } : {}),
        unverified_group_policy: currentSpace.unverified_group_policy ?? 2,
        member_limit: currentSpace.member_limit ?? null,
        level_names: currentSpace.level_names?.length === 18 ? currentSpace.level_names : defaultLevelNames,
      }, {
        name: settingsName.trim(),
        group_square_enabled: settingsSquareEnabled ? 1 : 0,
        chat_enabled: settingsChatEnabled ? 1 : 0,
        space_group_enabled: settingsSpaceGroupEnabled ? 1 : 0,
        square_free_post_enabled: settingsSquareFreePostEnabled ? 1 : 0,
        submission_enabled: settingsSubmissionEnabled ? 1 : 0,
        square_explore_enabled: settingsExploreEnabled ? 1 : 0,
        qq_binding_enabled: settingsQqBindingEnabled ? 1 : 0,
        ...(currentSpace.oauth_developer_granted ? { oauth_developer_enabled: settingsOauthDeveloperEnabled ? 1 as const : 0 as const } : {}),
        unverified_group_policy: settingsUnverifiedGroupPolicy,
        member_limit: settingsMemberLimit.trim() ? Number(settingsMemberLimit.trim()) : null,
        level_names: settingsLevelNames.map((name) => name.trim()),
      }));
      setCachedSpaceFeatures(payload.space_id, {
        chatEnabled: payload.chat_enabled !== false,
        submissionEnabled: payload.submission_enabled === true,
        squareEnabled: payload.group_square_enabled !== false,
        squareFreePostEnabled: payload.square_free_post_enabled !== false,
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
    setVoiceInputReady(false);
    setDesktopVoiceOpen(false);
    setBroadcastMoreOpen(false);
  };

  const stopBroadcastRecordingResources = () => {
    if (broadcastRecordingTimerRef.current !== null) {
      window.clearInterval(broadcastRecordingTimerRef.current);
      broadcastRecordingTimerRef.current = null;
    }
    broadcastAudioCaptureRef.current?.cleanup();
    broadcastAudioCaptureRef.current = null;
    broadcastRecorderRef.current = null;
  };

  const cancelBroadcastRecording = () => {
    broadcastRecordingAttemptRef.current++;
    setBroadcastVoicePending(false);
    broadcastPreviewRef.current?.pause();
    if (broadcastRecorderRef.current?.state === "recording") {
      broadcastRecorderRef.current.onstop = null;
      broadcastRecorderRef.current.stop();
    }
    stopBroadcastRecordingResources();
    broadcastChunksRef.current = [];
    setBroadcastRecording({ phase: "idle", duration: 0, file: null });
  };

  const startBroadcastRecording = async () => {
    if (broadcastState === "sending" || broadcastRecording.phase !== "idle" || broadcastVoicePending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("audio.unsupported"));
      return;
    }

    const attempt = ++broadcastRecordingAttemptRef.current;
    setBroadcastVoicePending(true);
    try {
      const capture = await createNoiseReducedAudioCapture();
      if (attempt !== broadcastRecordingAttemptRef.current) { capture.cleanup(); return; }
      const mimeType = preferredAudioMimeType();
      broadcastAudioCaptureRef.current = capture;
      const recorder = mimeType ? new MediaRecorder(capture.stream, { mimeType }) : new MediaRecorder(capture.stream);
      broadcastRecorderRef.current = recorder;
      broadcastChunksRef.current = [];
      broadcastRecordingStartedAtRef.current = Date.now();
      setBroadcastMoreOpen(false);
      setBroadcastRecording({ phase: "recording", duration: 0, file: null });
      setBroadcastVoicePending(false);

      recorder.ondataavailable = (recordEvent) => {
        if (recordEvent.data.size) broadcastChunksRef.current.push(recordEvent.data);
      };
      recorder.onstop = () => {
        const duration = Math.max(1, Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - broadcastRecordingStartedAtRef.current) / 1000));
        const resolvedType = recorder.mimeType || mimeType || "audio/webm";
        const extension = audioFileExtension(resolvedType);
        const blob = new Blob(broadcastChunksRef.current, { type: resolvedType });
        const file = new File([blob], `broadcast-${Date.now()}.${extension}`, { type: resolvedType });
        stopBroadcastRecordingResources();
        setBroadcastRecording({ phase: "recorded", duration, file });
      };
      recorder.start(250);
      broadcastRecordingTimerRef.current = window.setInterval(() => {
        if (capture.analyser) {
          const values = new Uint8Array(capture.analyser.frequencyBinCount);
          capture.analyser.getByteFrequencyData(values);
          setBroadcastVoiceBars(Array.from({length:24},(_,index)=>Math.max(.12,(values[index % values.length] ?? 0)/255)));
        }
        const duration = Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - broadcastRecordingStartedAtRef.current) / 1000);
        setBroadcastRecording((current) => ({ ...current, duration }));
        if (duration >= AUDIO_MAX_DURATION_SECONDS && recorder.state === "recording") recorder.stop();
      }, 200);
    } catch {
      if (attempt !== broadcastRecordingAttemptRef.current) return;
      setBroadcastVoicePending(false);
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
        {preference?.enabled ? t("common.enabled") : t("common.disabled")}
        {key !== "bark" ? ` · ${t("common.minutes", { count: preference?.offline_threshold_minutes ?? 30 })}` : null}
      </span>
    );
  };

  return (
    <ManagementWorkspace
      avatar={<SpaceAvatar className="management-space-avatar" name={currentSpace?.name ?? "FRIENDEN"} uri={currentSpace?.official_user?.avatar_uri} />}
      identity={currentSpace?.name ?? "FRIENDEN"}
      title={t("admin.dashboardTitle")}
      items={adminTabs}
      activeId={activeTab}
      onSelect={(id) => setActiveTab(id as AdminTab)}
      onLogout={logout}
      fill={activeTab === "permissions"}
      status={<HeaderSyncIndicator syncing={dashboardState === "loading" || memberState === "loading" || squareState === "loading"} />}
    >
        <div className={`admin-app-content ${activeTab === "permissions" ? "is-permissions" : ""}`}>

          {activeTab === "members" ? <section className="admin-tab-page admin-members-tab">
            <div className="admin-members-toolbar">
              <label className="admin-member-search"><span aria-hidden="true" className="material-symbols-outlined">search</span><input aria-label={t("admin.searchMembers")} placeholder={t("admin.searchMembers")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <PageTabs label={t("management.memberFilter")} value={filter} onChange={setFilter} items={[
                { value: "all", label: `${t("common.all")} · ${dashboard?.stats.members_count ?? 0}` },
                { value: "online", label: `${t("presence.online")} · ${dashboard?.stats.online_count ?? 0}` },
              ]} />
            </div>
            <div aria-hidden="true" className="admin-member-columns"><span>{t("management.memberName")}</span><span>{t("admin.friends")}</span><span>{t("admin.statements")}</span><span>{t("management.memberStatus")}</span><span /></div>
            <div className="admin-member-list">
              {members.map((user) => <button className="admin-member-row" key={user.user_id} onClick={() => setSelectedMember(user)} type="button">
                <span className="admin-member-avatar-wrap"><UserAvatar className="admin-member-avatar" name={user.name} uri={user.avatar_uri} />{user.is_alive && !user.is_deleted ? <i /> : null}</span>
                <span className="admin-member-main"><span><strong>{user.name}</strong><b>LV.{user.growth_level ?? 1}</b>{user.verified ? <em>{t("admin.verified")}</em> : null}</span><small>{user.is_deleted ? t("admin.historicalResidual") : `${user.friend_count ?? 0} ${t("admin.friends")} · ${user.statement_count ?? 0} ${t("admin.statements")}`}</small></span>
                <span className="admin-member-number" aria-label={`${t("admin.friends")} ${user.friend_count ?? 0}`}>{user.friend_count ?? 0}</span>
                <span className="admin-member-number" aria-label={`${t("admin.statements")} ${user.statement_count ?? 0}`}>{user.statement_count ?? 0}</span>
                <span className={`admin-member-presence ${user.is_alive && !user.is_deleted ? "is-online" : ""}`}>{t(user.is_alive && !user.is_deleted ? "presence.online" : "presence.offline")}</span>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>)}
              {!members.length && memberState === "ready" ? <FeedbackState tone="empty" icon={query.trim() ? "search_off" : "group"} title={t(query.trim() || filter === "online" ? "management.noMatchingMembers" : "admin.noMembers")} description={query.trim() ? t("common.tryAnotherKeyword") : ""} /> : null}
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
              {!squareStatements.length && squareState === "ready" ? <FeedbackState tone="empty" icon="forum" title={t("square.empty")} /> : null}
            </div>
          </section> : null}

          {activeTab === "permissions" ? <section className="admin-tab-page admin-permissions-tab">
            <PermissionWorkspace scope="space" />
          </section> : null}

          {activeTab === "official" && currentSpace ? <section className="management-form-page">
            <section className="admin-menu-section"><h2>{t("admin.officialAccount")}</h2><div className="admin-menu-list"><button onClick={openBroadcast} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">campaign</span></span><span><strong>{t("admin.broadcast")}</strong><small>{t("admin.broadcastDescription", { count: dashboard?.stats.members_count ?? 0 })}</small></span><span className="material-symbols-outlined">chevron_right</span></button><button disabled={officialLoginBusy} onClick={() => void loginAsOfficial()} type="button"><span className="admin-policy-icon"><span className="material-symbols-outlined">login</span></span><span><strong>{t("admin.enterAccount")}</strong><small>{currentSpace.official_user?.name}</small></span><span className="material-symbols-outlined">chevron_right</span></button></div></section>
          </section> : null}
          {activeTab === "operators" ? <section className="management-form-page">
        <div className="admin-operator-list"><section className="admin-policy-intro"><strong>{t("admin.operatorCount", { count: operators.length })}</strong><p>{t("admin.operatorHint")}</p></section>{operators.map((operator) => <article className="admin-operator-card" key={operator.operator_id}><UserAvatar className="mini-avatar" name={operator.user.name} uri={operator.user.avatar_uri} /><span><strong>{operator.user.name}</strong><small>{t("profile.operator")}</small></span><button disabled={operatorBusyUserId === operator.user.user_id} onClick={() => { const member = members.find((item) => item.user_id === operator.user.user_id); if (member) void setOperator(member, false); }} type="button">{t("admin.removeOperator")}</button></article>)}</div>
          </section> : null}

          {activeTab === "activities" ? <section className="management-form-page">
        <div className="admin-activity-list">
          <section className="admin-policy-intro"><strong>{t("admin.activityArrangementTitle")}</strong><p>{t("admin.activityArrangementHint")}</p></section>
          {activities.map((activity) => {
            const durationDays = activity.duration_seconds ? Math.ceil(activity.duration_seconds / 86400) : null;
            const localizedTitle = getActiveLocale().startsWith("zh") ? activity.title : activity.title_en || activity.title;
            const localizedSummary = getActiveLocale().startsWith("zh") ? activity.summary : activity.summary_en || activity.summary;
            return <article className={`admin-activity-card is-${activity.status}`} key={activity.key}>
              <header><span><small>{activity.mandatory ? t("admin.activityAutomatic") : t("admin.activityManual")}</small><strong>{localizedTitle}</strong></span><b>{t(`admin.activityStatus.${activity.status}` as TranslationKey)}</b></header>
              <p>{localizedSummary}</p>
              <dl><div><dt>{t("admin.activityDuration")}</dt><dd>{durationDays === null ? t("admin.activityNoTimeLimit") : t("admin.activityDays", { count: durationDays })}</dd></div>{activity.ends_at ? <div><dt>{t("admin.activityEndsAt")}</dt><dd>{new Date(activity.ends_at * 1000).toLocaleString(getActiveLocale())}</dd></div> : null}</dl>
              {!activity.claimed && !activity.mandatory ? <button disabled={Boolean(activityClaimingKey)} onClick={() => void claimActivity(activity)} type="button">{activityClaimingKey === activity.key ? t("common.processing") : t("admin.claimActivity")}</button> : null}
              {activity.mandatory ? <footer><span className="material-symbols-outlined">verified_user</span>{t("admin.activityMandatoryHint")}</footer> : null}
            </article>;
          })}
          {activitiesState === "loading" ? <FeedbackState tone="loading" title={t("common.loading")} /> : null}
          {activitiesState === "error" ? <FeedbackState tone="error" title={t("admin.activityLoadFailed")} /> : null}
        </div>
          </section> : null}

          {activeTab === "mutes" ? <section className="management-form-page">
        <div className="admin-square-mute-list">
          {squareMutes.map((mute) => <article className="admin-square-mute-card" key={mute.mute_id}>
            <header><UserAvatar className="admin-square-mute-avatar" name={mute.user.name} uri={mute.user.avatar_uri} /><span><strong>{mute.user.name}</strong><small>{mute.permanent ? t("admin.mutePermanent") : t("admin.muteUntil", { time: new Date((mute.muted_until ?? 0) * 1000).toLocaleString(getActiveLocale()) })}</small>{mute.created_by ? <small>{t("admin.muteCreatedBy", { name: mute.created_by.name })}</small> : null}</span></header>
            <p>{mute.reason}</p>
            <footer><span>{mute.created_by ? t("admin.mutedBy", { name: mute.created_by.name }) : ""}</span><div><button onClick={() => editSquareMute(mute)} type="button">{t("admin.adjustMute")}</button><button className="is-danger" onClick={() => setUnmuteTarget(mute)} type="button">{t("admin.unmute")}</button></div></footer>
          </article>)}
          {squareMutesState === "loading" ? <FeedbackState tone="loading" title={t("common.loading")} /> : null}
          {squareMutesState === "ready" && !squareMutes.length ? <FeedbackState tone="empty" icon="verified_user" description={t("admin.noSquareMutesHint")} title={t("admin.noSquareMutes")} /> : null}
        </div>
          </section> : null}

          {activeTab === "features" ? <section className="management-form-page">
        <div className="admin-policy-drawer">
          <p className="management-note">{t("admin.featureAccessHint")}</p>
          <SettingGroup>
            <SettingRow description={t("admin.chatFeatureHint")} title={t("nav.chats")} trailing={<SettingSwitch checked={settingsChatEnabled} label={t("nav.chats")} onChange={() => { if (settingsChatEnabled && !settingsSquareEnabled) return; setSettingsChatEnabled((value) => !value); if (settingsChatEnabled) setSettingsSpaceGroupEnabled(false); }} />} />
            <SettingRow disabled={!settingsChatEnabled} description={t("admin.spaceGroupHint")} title={t("admin.spaceGroup")} trailing={<SettingSwitch checked={settingsChatEnabled && settingsSpaceGroupEnabled} disabled={!settingsChatEnabled} label={t("admin.spaceGroup")} onChange={() => setSettingsSpaceGroupEnabled((value) => !value)} />} />
          </SettingGroup>
          <SettingGroup>
            <SettingRow disabled={currentSpace?.verification_tier === "email"} description={currentSpace?.verification_tier === "email" ? t("admin.squareNeedsPhone") : t("admin.squareFeatureHint")} title={t("nav.square")} trailing={<SettingSwitch checked={settingsSquareEnabled} disabled={currentSpace?.verification_tier === "email"} label={t("nav.square")} onChange={() => { if (settingsSquareEnabled && !settingsChatEnabled) return; if (settingsSquareEnabled) setSettingsSubmissionEnabled(false); if (!settingsSquareEnabled && !settingsSquareFreePostEnabled && !settingsSubmissionEnabled) setSettingsSquareFreePostEnabled(true); setSettingsSquareEnabled((value) => !value); }} />} />
            <SettingRow disabled={!settingsSquareEnabled} description={t("admin.squareFreePostHint")} title={t("admin.squareFreePost")} trailing={<SettingSwitch checked={settingsSquareEnabled && settingsSquareFreePostEnabled} disabled={!settingsSquareEnabled || (settingsSquareFreePostEnabled && !settingsSubmissionEnabled)} label={t("admin.squareFreePost")} onChange={() => setSettingsSquareFreePostEnabled((value) => !value)} />} />
            <SettingRow disabled={!settingsSquareEnabled} description={t("admin.submissionFeatureHint")} title={t("nav.submissions")} trailing={<SettingSwitch checked={settingsSquareEnabled && settingsSubmissionEnabled} disabled={!settingsSquareEnabled || (settingsSubmissionEnabled && !settingsSquareFreePostEnabled)} label={t("nav.submissions")} onChange={() => setSettingsSubmissionEnabled((value) => !value)} />} />
            <SettingRow disabled={!settingsSquareEnabled} description={t("admin.exploreFeatureHint")} title={t("square.feedAll")} trailing={<SettingSwitch checked={settingsSquareEnabled && settingsExploreEnabled} disabled={!settingsSquareEnabled} label={t("square.feedAll")} onChange={() => setSettingsExploreEnabled((value) => !value)} />} />
          </SettingGroup>
          {(currentSpace?.qq_binding_granted || currentSpace?.oauth_developer_granted) ? <SettingGroup>
            {currentSpace?.qq_binding_granted ? <SettingRow description={t("admin.qqBindingFeatureHint")} title={t("admin.qqBindingFeature")} trailing={<SettingSwitch checked={settingsQqBindingEnabled} label={t("admin.qqBindingFeature")} onChange={() => setSettingsQqBindingEnabled((value) => !value)} />} /> : null}
            {currentSpace?.oauth_developer_granted ? <SettingRow title={t("management.devCapability")} description={t("management.devCapabilityHint")} trailing={<SettingSwitch checked={settingsOauthDeveloperEnabled} label={t("management.devCapability")} onChange={setSettingsOauthDeveloperEnabled} />} /> : null}
          </SettingGroup> : null}
          <p className="admin-policy-footnote">{t("admin.moduleSafetyHint")}</p>
        </div>
            <footer className="management-form-actions"><button className="button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">{settingsSaving ? t("common.processing") : t("common.save")}</button></footer>
          </section> : null}

          {activeTab === "access" ? <section className="management-form-page">
        <div className="admin-policy-drawer">
          <p className="management-note">{t("admin.unverifiedAccessHint")}</p>
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
            <footer className="management-form-actions"><button className="button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">{settingsSaving ? t("common.saving") : t("common.save")}</button></footer>
          </section> : null}

          {activeTab === "basics" ? <section className="management-form-page">
            <div className="management-space-identity">
              <SpaceAvatar className="management-space-avatar" name={currentSpace?.name ?? "FRIENDEN"} uri={currentSpace?.official_user?.avatar_uri} />
              <span><strong>{currentSpace?.name}</strong><a href={entryHref}>{PUBLIC_HOST}/{currentSpace?.slug}</a></span>
              <button aria-label={t("admin.copyMemberEntry")} title={t("admin.copyMemberEntry")} onClick={() => void copyEntryLink()} type="button"><span aria-hidden="true" className="material-symbols-outlined">content_copy</span></button>
            </div>
            <div className="management-setting-fields">
              <div className="management-field"><label htmlFor="admin-space-name">{t("admin.spaceName")}</label><input id="admin-space-name" className="input" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} /></div>
              <div className="management-field"><div><label htmlFor="admin-space-capacity">{t("admin.memberLimit")}</label><small id="admin-space-capacity-hint">{t("admin.memberTierLimit", { count: currentSpace?.tier_member_limit ?? 5 })}</small></div><input id="admin-space-capacity" aria-describedby="admin-space-capacity-hint" className="input mono" inputMode="numeric" max={currentSpace?.tier_member_limit ?? 5} placeholder={String(currentSpace?.tier_member_limit ?? 5)} value={settingsMemberLimit} onChange={(event) => setSettingsMemberLimit(event.target.value.replace(/[^\d]/g, ""))} /></div>
            </div>
            <footer className="management-form-actions"><button className="button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">{settingsSaving ? t("common.saving") : t("common.save")}</button></footer>
          </section> : null}

          {activeTab === "levels" ? <section className="management-form-page">
            <div className="management-level-fields">{settingsLevelNames.map((levelName, index) => <label key={index}><span>Lv.{index + 1}</span><input aria-label={`Lv.${index + 1}`} className="input" maxLength={8} value={levelName} onChange={(event) => setSettingsLevelNames((current) => current.map((name, levelIndex) => levelIndex === index ? event.target.value : name))} /></label>)}</div>
            <footer className="management-form-actions"><button className="button" disabled={settingsSaving} onClick={() => void saveSettings()} type="button">{settingsSaving ? t("common.saving") : t("common.save")}</button></footer>
          </section> : null}

          {activeTab === "verification" ? <section className="management-form-page">
        <div className="admin-policy-drawer admin-verification-drawer">
          <section className="management-verification-status">
            <span>{t(`admin.tier.${currentSpace?.verification_tier ?? "email"}` as TranslationKey)}</span>
            <small>{t("admin.memberTierLimit", { count: currentSpace?.tier_member_limit ?? 5 })}</small>
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
          </section> : null}

        </div>


      <SideDrawer historyKey="admin-member-detail" onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} title={t("admin.memberDetail")}>
        {selectedMember ? <div className="admin-member-drawer">
          <section className="admin-member-profile"><UserAvatar className="admin-member-profile-avatar" name={selectedMember.name} uri={selectedMember.avatar_uri} /><span><strong>{selectedMember.name}</strong><small>{selectedMember.is_alive ? t("presence.online") : t("presence.offline")}</small></span><b>LV.{selectedMember.growth_level ?? 1}</b></section>
          <section className="admin-member-facts"><div><span>{t("admin.verified")}</span><strong>{selectedMember.verified ? t("common.yes") : t("common.no")}</strong></div><div><span>{t("admin.friends")}</span><strong>{selectedMember.friend_count ?? 0}</strong></div><div><span>{t("admin.statements")}</span><strong>{selectedMember.statement_count ?? 0}</strong></div></section>
          <section className="admin-member-detail-section"><h3>{t("admin.notificationAndContacts")}</h3><div className="admin-member-channel-list"><div><span>{t("channel.email")}</span>{notificationCell(selectedMember, "email", ADMIN_NOTIFICATION_CHANNEL.email)}</div><div><span>{t("channel.sms")}</span>{notificationCell(selectedMember, "sms", ADMIN_NOTIFICATION_CHANNEL.sms)}</div><div><span>{t("channel.instant")}</span>{notificationCell(selectedMember, "bark", ADMIN_NOTIFICATION_CHANNEL.bark)}</div></div></section>
          {!selectedMember.is_deleted ? <section className="admin-member-detail-section admin-member-chat-mute"><h3>{t("admin.globalChatMute")}</h3><p>{t("admin.globalChatMuteHint")}</p><ChatMuteControls busy={globalChatMuteBusy} mute={selectedMember.chat_mute} onMute={(duration) => void setGlobalChatMute(duration)} onUnmute={() => void removeGlobalChatMute()} /></section> : null}
          <button className="ghost-button" disabled={operatorBusyUserId === selectedMember.user_id || (!selectedMember.operator && (operators.length >= 5 || !selectedMember.contacts.email.verified || !selectedMember.contacts.sms.verified))} onClick={() => void setOperator(selectedMember, !selectedMember.operator)} type="button">{selectedMember.operator ? t("admin.removeOperator") : t("admin.assignOperator")}</button>
          <button className="admin-member-danger" onClick={() => { setRemoveUser(selectedMember); setSelectedMember(null); }} type="button">{selectedMember.is_deleted ? t("common.clean") : t("admin.remove")}</button>
        </div> : null}
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
            <form ref={broadcastComposerRef} className={`composer admin-broadcast-composer ${mobileComposerLayout ? "is-mobile-quiet" : "is-desktop-writing-desk"}${broadcastRecording.phase !== "idle" ? " is-recording-mode" : ""}`} onSubmit={(event) => void sendBroadcast(event)}>
              {!mobileComposerLayout || broadcastRecording.phase === "idle" ? (
                <ChatComposerLayout mobile={mobileComposerLayout} toolCount={4}
                  mobileInput={voiceInputReady ? <HoldToTalkInput disabled={broadcastState === "sending"} onBusyChange={setHoldBusy} onSend={(file,duration)=>sendBroadcastMedia([{file,kind:"audio",duration}])}/> : undefined}
                  input={<MentionComposerInput ref={broadcastInputRef}
                    className="textarea composer-input composer-rich-input"
                    members={[]} value={broadcastContent}
                    onFocus={() => setBroadcastMoreOpen(false)}
                    onChange={(value) => {if (broadcastState !== "sending") setBroadcastContent(value.slice(0,512));}}
                    onMentionQueryChange={() => undefined} onSelectFirstMention={() => false}
                    onSubmit={() => broadcastComposerRef.current?.requestSubmit()}
                    placeholder={t("chat.inputPlaceholder")}
                  />}
                  tools={<>
                    <span className="desktop-tool-anchor">
                      <button aria-label={t("audio.record")} aria-expanded={!mobileComposerLayout && desktopVoiceOpen} aria-pressed={mobileComposerLayout ? voiceInputReady : desktopVoiceOpen} className={voiceInputReady || desktopVoiceOpen ? "is-active" : ""} disabled={broadcastState === "sending" || holdBusy} onClick={() => {broadcastInputRef.current?.blur();setBroadcastMoreOpen(false);if(mobileComposerLayout)setVoiceInputReady(value=>!value);else setDesktopVoiceOpen(value=>!value);}} type="button"><ComposerSvgIcon kind="mic"/></button>
                      {!mobileComposerLayout && desktopVoiceOpen ? <DesktopVoiceStudio onClose={()=>setDesktopVoiceOpen(false)} phase={broadcastState === "sending" ? "sending" : broadcastVoicePending ? "requesting" : broadcastRecording.phase} open={broadcastVoicePending || broadcastRecording.phase !== "idle"} bars={broadcastVoiceBars} duration={broadcastRecording.duration} previewPlaying={broadcastPreviewPlaying} onStart={()=>void startBroadcastRecording()} onStop={stopBroadcastRecording} onCancel={cancelBroadcastRecording} onPreview={()=>{const audio=broadcastPreviewRef.current;if(!audio)return;if(audio.paused)void audio.play().catch(()=>setError(t("audio.startFailed")));else audio.pause();}} onSend={()=>{if(broadcastRecording.file){broadcastPreviewRef.current?.pause();void sendBroadcastMedia([{file:broadcastRecording.file,kind:"audio",duration:broadcastRecording.duration}]);}}}>
                        <audio ref={broadcastPreviewRef} hidden src={broadcastPreviewUri} preload="metadata" onEnded={()=>setBroadcastPreviewPlaying(false)} onPause={()=>setBroadcastPreviewPlaying(false)} onPlay={()=>setBroadcastPreviewPlaying(true)}/>
                      </DesktopVoiceStudio> : null}
                    </span>
                    <button aria-label={t("emoji.choose")} aria-pressed={broadcastMoreOpen} disabled={broadcastState === "sending" || holdBusy} onClick={() => {broadcastInputRef.current?.blur();setVoiceInputReady(false);setBroadcastMoreOpen((value) => !value);}} type="button"><ComposerSvgIcon kind="emoji"/></button>
                    <button aria-label={t("media.gallery")} disabled={broadcastState === "sending" || holdBusy} onClick={() => broadcastGalleryInputRef.current?.click()} type="button"><ComposerSvgIcon kind="album"/></button>
                    <button aria-label={t("media.file")} disabled={broadcastState === "sending" || holdBusy} onClick={() => broadcastFileInputRef.current?.click()} type="button"><ComposerSvgIcon kind="file"/></button>
                  </>}
                />
              ) : (
                <div className="composer-row composer-row-recording">
                  <button
                    aria-label={t("audio.deleteRecording")}
                    className="composer-recording-delete"
                    disabled={broadcastState === "sending"}
                    onClick={cancelBroadcastRecording}
                    type="button"
                  >
                    <span className="admin-composer-svg"><ComposerSvgIcon kind="delete" /></span>
                  </button>
                  <div className="composer-recording-bar">
                    <button
                      aria-label={t("audio.stopRecording")}
                      className="composer-recording-stop"
                      disabled={broadcastRecording.phase !== "recording"}
                      onClick={stopBroadcastRecording}
                      type="button"
                    >
                      <span className="admin-composer-svg"><ComposerSvgIcon kind="stop" /></span>
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
              {broadcastRecording.phase === "idle" && broadcastMoreOpen ? <ComposerEmojiPicker admin busy={broadcastState === "sending"} inset mobile={mobileComposerLayout} onSelect={(emoji) => broadcastInputRef.current?.insertTextWithoutFocus(emoji)} onSticker={async sticker=>{
                if(broadcastState === "sending")return;
                setBroadcastState("sending");setBroadcastProgress(.08);setError(null);
                try {finishBroadcast([await sendBroadcastPayload(9,JSON.stringify({asset_id:sticker.sticker_asset_id}),`${broadcastIdRef.current}:sticker:${sticker.sticker_asset_id}`)]);}
                catch(error){setBroadcastState("idle");setBroadcastProgress(0);setError(error instanceof ApiError?error.message:t("admin.broadcastFailed"));}
              }}/> : null}
              <button hidden type="submit" disabled={broadcastState === "sending" || !broadcastContent.trim()}/>
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
      <ConfirmDialog busy={muteBusy} confirmDisabled={!muteReason.trim()} confirmLabel={t("common.save")} description={t("square.muteAuthorHint")} onClose={() => setMuteEditTarget(null)} onConfirm={() => void saveSquareMute()} open={Boolean(muteEditTarget)} title={t("admin.adjustMute")} warning>
        <div className="square-mute-form"><div className="square-mute-duration">{(["1d", "3d", "7d", "30d", "permanent"] as const).map((duration) => <button aria-pressed={muteDuration === duration} className={muteDuration === duration ? "is-selected" : ""} key={duration} onClick={() => setMuteDuration(duration)} type="button">{t(`square.muteDuration.${duration}` as TranslationKey)}</button>)}</div><label><span>{t("square.muteReason")}</span><textarea maxLength={240} onChange={(event) => setMuteReason(event.target.value)} placeholder={t("square.muteReasonPlaceholder")} value={muteReason} /></label></div>
      </ConfirmDialog>
      <ConfirmDialog busy={muteBusy} confirmLabel={t("admin.unmute")} description={unmuteTarget ? t("admin.unmuteHint", { name: unmuteTarget.user.name }) : ""} onClose={() => setUnmuteTarget(null)} onConfirm={() => void removeSquareMute()} open={Boolean(unmuteTarget)} title={t("admin.unmuteTitle")} warning />
    </ManagementWorkspace>
  );
}
