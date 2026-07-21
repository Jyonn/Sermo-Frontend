import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import barkAppIconUrl from "../assets/bark-app-icon.jpg";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { GestureSetupPanel } from "../components/GestureLock";
import { InputDialog } from "../components/InputDialog";
import { RequestStatusModal } from "../components/RequestStatusModal";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { useAuth } from "../lib/auth";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { getWebReminderPreferences, mapWebReminderPreferences, setWebReminderPreferences, type WebReminderPreferences } from "../lib/webReminderPreferences";
import { getGestureLockAfterMinutes, getGestureLockScope } from "../lib/gestureLock";
import { VerificationBanner } from "../components/VerificationBanner";
import type { AppViewState, GestureLockPreferenceDTO, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences, SpaceDTO, UserMeDTO } from "../types";

const channelRows: Array<[NotificationChannel, number, string]> = [
  ["email", 1, "邮件"],
  ["sms", 2, "短信"],
  ["bark", 3, "即时"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "", openChatOnTap: true },
  sms: { enabled: false, threshold: 15, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "", openChatOnTap: true },
  bark: { enabled: false, threshold: 5, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "", openChatOnTap: true },
};

const defaultHiddenDirectMessagePlaceholder = "你收到了一条新的私聊消息。";
const defaultHiddenGroupMessagePlaceholder = "你收到了一条新的群聊消息。";
const barkAppStoreUrl = "https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%8E%A8%E9%80%81/id1403753865";
const defaultPasswordReminderDescription = "设置密码后，才能绑定通知渠道或管理通知提醒。";

function clonePref(pref: NotificationPreferences[NotificationChannel]) {
  return { ...pref };
}

function samePref(
  left: NotificationPreferences[NotificationChannel] | null,
  right: NotificationPreferences[NotificationChannel] | null
) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.enabled === right.enabled &&
    left.threshold === right.threshold &&
    left.hideMessageContent === right.hideMessageContent &&
    left.hiddenDirectMessageText === right.hiddenDirectMessageText &&
    left.hiddenGroupMessageText === right.hiddenGroupMessageText &&
    left.openChatOnTap === right.openChatOnTap
  );
}

function sameCustomMessages(
  left: NotificationPreferences[NotificationChannel] | null,
  right: NotificationPreferences[NotificationChannel] | null
) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.hiddenDirectMessageText === right.hiddenDirectMessageText &&
    left.hiddenGroupMessageText === right.hiddenGroupMessageText
  );
}

function mapPrefs(rows: NotificationPreferenceDTO[]): NotificationPreferences {
  const next = { ...emptyPrefs };
  rows.forEach((row) => {
    const channel = row.channel === 1 ? "email" : row.channel === 2 ? "sms" : "bark";
    next[channel] = {
      enabled: row.enabled,
      threshold: row.offline_threshold_minutes,
      hideMessageContent: row.hide_message_content,
      hiddenDirectMessageText: row.hidden_direct_message_text ?? "",
      hiddenGroupMessageText: row.hidden_group_message_text ?? "",
      openChatOnTap: row.open_chat_on_tap ?? true,
    };
  });
  return next;
}

function channelLabel(channel: NotificationChannel) {
  return channelRows.find(([key]) => key === channel)?.[2] ?? channel.toUpperCase();
}

function channelCode(channel: NotificationChannel) {
  return channel === "email" ? 1 : channel === "sms" ? 2 : 3;
}

function channelTarget(me: UserMeDTO | null, channel: NotificationChannel) {
  if (!me) return "";
  if (channel === "email") return me.email ?? "";
  if (channel === "sms") return me.phone ?? "";
  return me.bark ?? "";
}

function channelVerified(me: UserMeDTO | null, channel: NotificationChannel) {
  if (!me) return false;
  if (channel === "email") return Boolean(me.email_verified_at);
  if (channel === "sms") return Boolean(me.phone_verified_at);
  return Boolean(me.bark_verified_at);
}

function detectAppleEnvironment() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const userAgentDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || "";
  const value = `${userAgent} ${platform} ${userAgentDataPlatform}`.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(value);
  const isMac = /macintosh|mac os x|macintel|mac/.test(value);
  return isIOS || isMac;
}

function QrCodeIcon() {
  return (
    <svg aria-hidden="true" className="menu-qr-icon" fill="none" viewBox="0 0 24 24">
      <path d="M4.5 4.5h5v5h-5zM14.5 4.5h5v5h-5zM4.5 14.5h5v5h-5z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15h1.5v1.5H18V18h1.5M15 18h1.5v1.5M18 13.5V15h1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function BarkGuideIcon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bark-guide-icon${compact ? " is-compact" : ""}`} aria-hidden="true">
      <img alt="" src={barkAppIconUrl} />
    </div>
  );
}

export default function MenuPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, patchSessionUser } = useAuth();
  const currentUserId = session?.user.user_id;
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [me, setMe] = useState<UserMeDTO | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(emptyPrefs);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [basicDrawerOpen, setBasicDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [gestureSheetOpen, setGestureSheetOpen] = useState(false);
  const [gesturePreference, setGesturePreference] = useState<GestureLockPreferenceDTO | null>(null);
  const [channelsDrawerOpen, setChannelsDrawerOpen] = useState(false);
  const [webReminderDrawerOpen, setWebReminderDrawerOpen] = useState(false);
  const [webReminderPrefs, setWebReminderPrefs] = useState<WebReminderPreferences>(() => getWebReminderPreferences());
  const [barkGuideOpen, setBarkGuideOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);
  const [passwordReminderDescription, setPasswordReminderDescription] = useState(defaultPasswordReminderDescription);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [accountDeleteStep, setAccountDeleteStep] = useState<"intro" | "verify" | "final" | null>(null);
  const [accountDeleteInput, setAccountDeleteInput] = useState("");
  const [accountDeleteSaving, setAccountDeleteSaving] = useState(false);
  const [prefDrawerChannel, setPrefDrawerChannel] = useState<NotificationChannel | null>(null);
  const [prefDraft, setPrefDraft] = useState<NotificationPreferences[NotificationChannel] | null>(null);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefCustomDrawerOpen, setPrefCustomDrawerOpen] = useState(false);
  const [discardPrefConfirmOpen, setDiscardPrefConfirmOpen] = useState(false);
  const [prefCustomSnapshot, setPrefCustomSnapshot] = useState<NotificationPreferences[NotificationChannel] | null>(null);
  const [discardCustomPrefConfirmOpen, setDiscardCustomPrefConfirmOpen] = useState(false);
  const [authSheetChannel, setAuthSheetChannel] = useState<NotificationChannel | null>(null);
  const [basicEditField, setBasicEditField] = useState<"name" | "welcome" | null>(null);
  const [basicEditValue, setBasicEditValue] = useState("");
  const [authTarget, setAuthTarget] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authActionState, setAuthActionState] = useState<"idle" | "sending" | "binding">("idle");
  const [authCooldown, setAuthCooldown] = useState(0);
  const [authExpiresIn, setAuthExpiresIn] = useState(0);
  const [basicEditSaving, setBasicEditSaving] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [friendInviteLink, setFriendInviteLink] = useState("");
  const [friendInviteQrUri, setFriendInviteQrUri] = useState("");
  const [friendInviteLoading, setFriendInviteLoading] = useState(false);
  const [friendInviteExpire, setFriendInviteExpire] = useState<number | null>(null);
  const [friendInviteMode, setFriendInviteMode] = useState<"limited" | "permanent">("limited");
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    phase: "loading" | "success" | "error";
    loadingLabel: string;
    successLabel: string;
    errorLabel: string;
  } | null>(null);
  const authVerifyRef = useRef<HTMLDivElement | null>(null);
  const authSheetBodyRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasPassword = Boolean(me?.has_password ?? session?.user.has_password);
  const gestureScope = useMemo(() => getGestureLockScope(session), [session]);
  const emailVerified = Boolean(me ? me.email_verified_at : session?.user.email_verified_at);
  const isAppleEnvironment = useMemo(() => detectAppleEnvironment(), []);
  const visibleChannelRows = useMemo(
    () => channelRows.filter(([channel]) => channel !== "bark" || isAppleEnvironment),
    [isAppleEnvironment]
  );
  const barkBound = channelVerified(me, "bark");
  const shouldShowBarkGuideBanner = isAppleEnvironment && !barkBound;
  const webReminderSummary = [
    webReminderPrefs.soundEnabled ? "提示音已开" : "提示音已关",
    webReminderPrefs.titleEnabled ? "标题已开" : "标题已关",
  ].join(" · ");

  const showPasswordReminder = (description = defaultPasswordReminderDescription) => {
    setPasswordReminderDescription(description);
    setPasswordReminderOpen(true);
  };

  const gestureEnabled = Boolean(gesturePreference?.enabled && gesturePreference.pattern_hash && gesturePreference.salt);
  const gestureLockAfterMinutes = getGestureLockAfterMinutes(gesturePreference);

  const updateWebReminderPrefs = async (patch: Partial<WebReminderPreferences>) => {
    const previous = webReminderPrefs;
    const next = {
      ...webReminderPrefs,
      ...patch,
    };
    setWebReminderPrefs(next);
    setWebReminderPreferences(next);
    try {
      const updated = await api.updateWebReminderPrefs({
        sound_enabled: next.soundEnabled ? 1 : 0,
        title_enabled: next.titleEnabled ? 1 : 0,
      });
      const saved = mapWebReminderPreferences(updated);
      setWebReminderPrefs(saved);
      setWebReminderPreferences(saved);
    } catch (apiError) {
      setWebReminderPrefs(previous);
      setWebReminderPreferences(previous);
      setError(apiError instanceof ApiError ? apiError.message : "网页提醒保存失败");
    }
  };

  const openWebReminderDrawer = () => {
    setChannelsDrawerOpen(false);
    setWebReminderDrawerOpen(true);
  };

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([
      api.getSpaceMe(controller.signal),
      api.getUserMe(controller.signal),
      api.getWebReminderPrefs(controller.signal).catch(() => null),
      api.getGestureLockPrefs(controller.signal).catch(() => null),
    ])
      .then(async ([spaceInfo, meInfo, webReminderInfo, gestureInfo]) => {
        const prefRows = meInfo.has_password ? await api.getNotificationPrefs(controller.signal) : [];
        const nextWebReminderPrefs = webReminderInfo ? mapWebReminderPreferences(webReminderInfo) : getWebReminderPreferences();
        setSpace(spaceInfo);
        setMe(meInfo);
        setPrefs(mapPrefs(prefRows));
        setGesturePreference(gestureInfo);
        setWebReminderPrefs(nextWebReminderPrefs);
        setWebReminderPreferences(nextWebReminderPrefs);
        patchSessionUser({
          has_password: meInfo.has_password,
          verified: meInfo.verified,
          avatar_type: meInfo.avatar_type,
          avatar_uri: meInfo.avatar_uri,
          welcome_message: meInfo.welcome_message,
          email: meInfo.email,
          phone: meInfo.phone,
          bark: meInfo.bark,
          email_verified_at: meInfo.email_verified_at,
          phone_verified_at: meInfo.phone_verified_at,
          bark_verified_at: meInfo.bark_verified_at,
          language: meInfo.language,
          last_heartbeat: meInfo.last_heartbeat,
        });
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "菜单加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [currentUserId]);

  useEffect(() => {
    const drawer = new URLSearchParams(location.search).get("drawer");
    if (drawer === "security") {
      setSecurityDrawerOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!authSheetChannel) return;
    if (authCooldown <= 0 && authExpiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setAuthCooldown((current) => Math.max(0, current - 1));
      setAuthExpiresIn((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authCooldown, authExpiresIn, authSheetChannel]);

  useEffect(() => {
    if (!authSheetChannel || !authPending) return;
    requestAnimationFrame(() => {
      const body = authSheetBodyRef.current;
      if (body) {
        body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      } else {
        authVerifyRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  }, [authPending, authSheetChannel]);

  useEffect(() => {
    if (!inviteDrawerOpen || !space?.slug) return;
    let cancelled = false;
    setFriendInviteLoading(true);
    setFriendInviteLink("");
    setFriendInviteQrUri("");
    setFriendInviteExpire(null);

    api
      .createFriendInviteToken(friendInviteMode === "permanent")
      .then(async (payload) => {
        if (cancelled) return;
        const link = buildSpaceHrefForCurrentHost(space.slug, "/friend-invite", "", `token=${encodeURIComponent(payload.token)}`);
        const qrUri = await QRCode.toDataURL(link, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 520,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });
        if (cancelled) return;
        setFriendInviteLink(link);
        setFriendInviteQrUri(qrUri);
        setFriendInviteExpire(payload.expire);
      })
      .catch((apiError) => {
        if (cancelled) return;
        setError(apiError instanceof ApiError ? apiError.message : "生成好友邀请链接失败");
        setInviteDrawerOpen(false);
      })
      .finally(() => {
        if (cancelled) return;
        setFriendInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [friendInviteMode, inviteDrawerOpen, space?.slug]);

  const openAuthSheet = (channel: NotificationChannel) => {
    if (!hasPassword) {
      setChannelsDrawerOpen(false);
      showPasswordReminder();
      return;
    }
    if (channel === "bark") {
      setChannelsDrawerOpen(false);
      setBarkGuideOpen(true);
      setAuthSheetChannel("bark");
      setAuthTarget(channelTarget(me, "bark"));
      setAuthCode("");
      setAuthPending(false);
      setAuthCooldown(0);
      setAuthExpiresIn(0);
      return;
    }
    setAuthSheetChannel(channel);
    setAuthTarget(channelTarget(me, channel));
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
  };

  const closeAuthSheet = () => {
    setBarkGuideOpen(false);
    setAuthSheetChannel(null);
    setAuthTarget("");
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
    setAuthActionState("idle");
  };

  const closeBarkGuide = () => {
    if (authActionState !== "idle") return;
    setBarkGuideOpen(false);
    closeAuthSheet();
  };

  const openBarkGuide = () => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    openAuthSheet("bark");
  };

  const closePrefDrawers = () => {
    setPrefDrawerChannel(null);
    setPrefDraft(null);
    setPrefSaving(false);
    setPrefCustomDrawerOpen(false);
    setPrefCustomSnapshot(null);
    setDiscardPrefConfirmOpen(false);
    setDiscardCustomPrefConfirmOpen(false);
  };

  const openPrefDrawer = (channel: NotificationChannel) => {
    setPrefDrawerChannel(channel);
    setPrefDraft(clonePref(prefs[channel]));
    setPrefCustomDrawerOpen(false);
    setPrefCustomSnapshot(null);
    setDiscardPrefConfirmOpen(false);
    setDiscardCustomPrefConfirmOpen(false);
  };

  const updatePrefDraft = (patch: Partial<NotificationPreferences[NotificationChannel]>) => {
    setPrefDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const requestClosePrefDrawer = () => {
    if (prefSaving) return;
    const savedPref = prefDrawerChannel ? prefs[prefDrawerChannel] : null;
    if (samePref(prefDraft, savedPref)) {
      closePrefDrawers();
      return;
    }
    setDiscardPrefConfirmOpen(true);
  };

  const openPrefCustomDrawer = () => {
    if (!prefDraft) return;
    setPrefCustomSnapshot(clonePref(prefDraft));
    setPrefCustomDrawerOpen(true);
    setDiscardCustomPrefConfirmOpen(false);
  };

  const requestClosePrefCustomDrawer = () => {
    if (!prefCustomDrawerOpen) return;
    if (sameCustomMessages(prefDraft, prefCustomSnapshot)) {
      setPrefCustomDrawerOpen(false);
      setPrefCustomSnapshot(null);
      return;
    }
    setDiscardCustomPrefConfirmOpen(true);
  };

  const discardPrefCustomChanges = () => {
    setPrefDraft((current) =>
      current && prefCustomSnapshot
        ? {
            ...current,
            hiddenDirectMessageText: prefCustomSnapshot.hiddenDirectMessageText,
            hiddenGroupMessageText: prefCustomSnapshot.hiddenGroupMessageText,
          }
        : current
    );
    setPrefCustomDrawerOpen(false);
    setPrefCustomSnapshot(null);
    setDiscardCustomPrefConfirmOpen(false);
  };

  const savePrefDraft = async () => {
    if (!prefDrawerChannel || !prefDraft) return;
    setError(null);
    setPrefSaving(true);
    try {
      const updated = await api.updateNotificationPref({
        channel: channelCode(prefDrawerChannel),
        enabled: prefDraft.enabled ? 1 : 0,
        offline_threshold_minutes: prefDraft.threshold,
        hide_message_content: prefDraft.hideMessageContent ? 1 : 0,
        hidden_direct_message_text: prefDraft.hiddenDirectMessageText.trim(),
        hidden_group_message_text: prefDraft.hiddenGroupMessageText.trim(),
        open_chat_on_tap: prefDraft.openChatOnTap ? 1 : 0,
      });
      const nextPref = {
        enabled: updated.enabled,
        threshold: updated.offline_threshold_minutes,
        hideMessageContent: updated.hide_message_content,
        hiddenDirectMessageText: updated.hidden_direct_message_text ?? "",
        hiddenGroupMessageText: updated.hidden_group_message_text ?? "",
        openChatOnTap: updated.open_chat_on_tap ?? true,
      };
      setPrefs((current) => ({
        ...current,
        [prefDrawerChannel]: nextPref,
      }));
      closePrefDrawers();
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "更新通知设置失败";
      setError(message);
    } finally {
      setPrefSaving(false);
    }
  };

  const sendAuthCode = async () => {
    if (!authSheetChannel) return;
    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在发送验证码",
      successLabel: "验证码发送成功",
      errorLabel: "发送失败",
    });
    try {
      setAuthActionState("sending");
      const normalizedTarget = authSheetChannel === "email" ? authTarget.trim().toLowerCase() : authTarget.trim();
      const payload = await api.sendContactCode({ channel: channelCode(authSheetChannel), target: normalizedTarget });
      setAuthPending(true);
      setAuthCooldown(60);
      setAuthExpiresIn(payload.expires_in);
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "success",
            }
          : null
      );
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setChannelsDrawerOpen(false);
        setSecurityDrawerOpen(true);
      }
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "发送验证码失败",
            }
          : null
      );
    } finally {
      setAuthActionState("idle");
    }
  };

  const bindAuthChannel = async () => {
    if (!authSheetChannel) return;
    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: authSheetChannel === "email" ? "正在确认邮箱认证" : "正在确认绑定",
      successLabel: authSheetChannel === "email" ? "邮箱认证成功" : "绑定成功",
      errorLabel: authSheetChannel === "email" ? "邮箱认证失败" : "绑定失败",
    });
    try {
      setAuthActionState("binding");
      const normalizedTarget = authSheetChannel === "email" ? authTarget.trim().toLowerCase() : authTarget.trim();
      const nextMe = await api.bindContact({
        channel: channelCode(authSheetChannel),
        target: normalizedTarget,
        code: authCode.trim(),
      });
      setMe(nextMe);
      patchSessionUser({
        has_password: nextMe.has_password,
        verified: nextMe.verified,
        avatar_type: nextMe.avatar_type,
        avatar_uri: nextMe.avatar_uri,
        welcome_message: nextMe.welcome_message,
        email: nextMe.email,
        phone: nextMe.phone,
        bark: nextMe.bark,
        email_verified_at: nextMe.email_verified_at,
        phone_verified_at: nextMe.phone_verified_at,
        bark_verified_at: nextMe.bark_verified_at,
        language: nextMe.language,
        last_heartbeat: nextMe.last_heartbeat,
      });
      const prefRows = await api.getNotificationPrefs();
      setPrefs(mapPrefs(prefRows));
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "success",
            }
          : null
      );
      closeAuthSheet();
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setChannelsDrawerOpen(false);
        setSecurityDrawerOpen(true);
      }
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : authSheetChannel === "email" ? "邮箱认证失败" : "绑定失败",
            }
          : null
      );
    } finally {
      setAuthActionState("idle");
    }
  };

  const savePassword = async () => {
    if (!passwordNext.trim()) return;

    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: hasPassword ? "正在更新密码" : "正在设置密码",
      successLabel: hasPassword ? "密码更新成功" : "密码设置成功",
      errorLabel: hasPassword ? "密码更新失败" : "密码设置失败",
    });

    try {
      setPasswordSaving(true);
      const payload = await api.updatePassword({
        old_password: hasPassword ? passwordCurrent : undefined,
        new_password: passwordNext.trim(),
      });
      const prefRows = payload.has_password ? await api.getNotificationPrefs() : [];
      setMe((current) => (current ? { ...current, has_password: payload.has_password } : current));
      setPrefs(mapPrefs(prefRows));
      patchSessionUser({ has_password: payload.has_password });
      setPasswordCurrent("");
      setPasswordNext("");
      setPasswordSheetOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
      setSecurityDrawerOpen(false);
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : hasPassword ? "密码更新失败" : "密码设置失败",
            }
          : null
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const leave = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const savePresetAvatar = async (presetId: number) => {
    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在更新头像",
      successLabel: "头像更新成功",
      errorLabel: "头像更新失败",
    });
    try {
      setAvatarSaving(true);
      const payload = await api.setPresetAvatar(presetId);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : "头像更新失败",
            }
          : null
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const requestCustomAvatarUpload = () => {
    if (!hasPassword) {
      showPasswordReminder("设置密码后，才能上传自定义头像。你仍然可以继续使用预设头像。");
      return;
    }
    avatarFileInputRef.current?.click();
  };

  const handleCustomAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setStatusModal({
      open: true,
      phase: "loading",
      loadingLabel: "正在上传头像",
      successLabel: "头像上传成功",
      errorLabel: "头像上传失败",
    });

    try {
      setAvatarSaving(true);
      const payload = await uploadCustomAvatar(file);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (uploadError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel:
                uploadError instanceof AvatarUploadError || uploadError instanceof ApiError
                  ? uploadError.message
                  : "头像上传失败",
            }
          : null
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const openBasicEditDialog = (field: "name" | "welcome") => {
    if (!hasPassword) {
      showPasswordReminder(field === "name" ? "设置密码后，才能修改昵称。" : "设置密码后，才能修改欢迎语。");
      return;
    }
    setBasicEditField(field);
    setBasicEditValue(field === "name" ? session?.user.name ?? "" : me?.welcome_message ?? session?.user?.welcome_message ?? "");
  };

  const confirmAccountDeleteInput = () => {
    const value = accountDeleteInput.trim();
    if (!value) {
      setError(hasPassword ? "请输入当前密码。" : "请输入当前昵称以确认注销。");
      return;
    }
    setAccountDeleteStep("final");
  };

  const deleteAccount = async () => {
    const value = accountDeleteInput.trim();
    try {
      setAccountDeleteSaving(true);
      await api.deleteAccount(hasPassword ? { password: value } : { name_confirmation: value });
      setAccountDeleteStep(null);
      setSecurityDrawerOpen(false);
      await logout();
      navigate("/", { replace: true });
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "注销账户失败");
    } finally {
      setAccountDeleteSaving(false);
    }
  };

  const confirmBasicEdit = async () => {
    if (!basicEditField) return;

    try {
      setStatusModal({
        open: true,
        phase: "loading",
        loadingLabel: basicEditField === "name" ? "正在保存昵称" : "正在保存欢迎语",
        successLabel: basicEditField === "name" ? "昵称更新成功" : "欢迎语更新成功",
        errorLabel: basicEditField === "name" ? "昵称更新失败" : "欢迎语更新失败",
      });
      setBasicEditSaving(true);
      if (basicEditField === "name") {
        const payload = await api.updateUserName(basicEditValue.trim());
        setMe((current) => (current ? { ...current, name: payload.name, name_pinyin: payload.name_pinyin ?? current.name_pinyin } : current));
        patchSessionUser({
          name: payload.name,
        });
      } else {
        const payload = await api.updateWelcomeMessage(basicEditValue.trim());
        const nextMessage = payload.welcome_message ?? "";
        setMe((current) => (current ? { ...current, welcome_message: nextMessage } : current));
        patchSessionUser({
          welcome_message: nextMessage,
        });
      }
      setBasicEditField(null);
      setStatusModal((current) => (current ? { ...current, phase: "success" } : null));
    } catch (apiError) {
      setStatusModal((current) =>
        current
          ? {
              ...current,
              phase: "error",
              errorLabel: apiError instanceof ApiError ? apiError.message : basicEditField === "name" ? "昵称更新失败" : "欢迎语更新失败",
            }
          : null
      );
    } finally {
      setBasicEditSaving(false);
    }
  };

  const welcomeSummary = useMemo(() => {
    const value = (me?.welcome_message ?? session?.user?.welcome_message ?? "").trim();
    return value || "还没有设置欢迎语";
  }, [me?.welcome_message, session?.user?.welcome_message]);

  const openChannelsEntry = () => {
    if (!hasPassword) {
      showPasswordReminder();
      return;
    }
    setChannelsDrawerOpen(true);
  };

  const copyFriendInviteLink = async () => {
    if (!friendInviteLink) return;
    try {
      const copied = await copyText(friendInviteLink);
      if (!copied) throw new Error("copy_failed");
      setStatusModal({
        open: true,
        phase: "success",
        loadingLabel: "正在复制链接",
        successLabel: "链接已复制",
        errorLabel: "复制失败",
      });
    } catch {
      setError("复制好友邀请链接失败。");
    }
  };

  const friendInviteExpireText = useMemo(() => {
    if (!friendInviteExpire) return "";
    return new Date(friendInviteExpire * 1000).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [friendInviteExpire]);

  const friendInviteValidityText = friendInviteMode === "permanent" ? "长期有效" : friendInviteExpireText ? `有效期至 ${friendInviteExpireText}` : "7 天有效";

  const canUseFriendInvite = Boolean(me?.verified ?? session?.user?.verified);

  const savedActivePref = prefDrawerChannel ? prefs[prefDrawerChannel] : null;
  const activePrefDraft = prefDraft ?? savedActivePref;
  const prefDraftDirty = Boolean(prefDrawerChannel && prefDraft && savedActivePref && !samePref(prefDraft, savedActivePref));

  const openFriendInviteDrawer = () => {
    if (!canUseFriendInvite) {
      setError("完成邮箱认证后才能使用好友二维码。");
      return;
    }
    setInviteDrawerOpen(true);
  };

  return (
    <AppChrome title="菜单" hideTopbar>
      <section className="page-stack">
        <div className="minimal-page-header">
          <div className="page-toolbar">
            <h2 className="panel-title">菜单</h2>
          </div>
        </div>
        <div className="menu-profile-card">
          <button className="profile-avatar-button menu-profile-avatar" onClick={() => setAvatarDialogOpen(true)} type="button">
            <UserAvatar className="avatar-large" name={session?.user.name ?? "Sermo"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
          </button>
          <div className="row-main menu-profile-copy">
            <div className="menu-profile-heading">
              <strong>{session?.user.name ?? "Sermo User"}</strong>
            </div>
            <div className="row-subtle">
              {space?.name ?? "当前空间"}
              {space?.slug ? <span className="menu-space-slug">@{space.slug}</span> : null}
            </div>
          </div>
          <button
            aria-disabled={!canUseFriendInvite}
            aria-label={canUseFriendInvite ? "分享好友二维码" : "完成认证后可使用好友二维码"}
            className={`icon-button inline-avatar-icon-button menu-share-qr-button${!canUseFriendInvite ? " is-disabled" : ""}`}
            onClick={openFriendInviteDrawer}
            type="button"
          >
            <QrCodeIcon />
          </button>
        </div>
        {!hasPassword ? (
          <button
            className="verification-banner password-setup-banner"
            onClick={() => setSecurityDrawerOpen(true)}
            type="button"
          >
            <div className="verification-banner-copy">
              <strong>设置密码，保障你的隐私</strong>
              <span>目前您的账户存在风险，他人可以根据您的名称登录查看信息。</span>
            </div>
            <span className="ghost-button verification-banner-action">去设置</span>
          </button>
        ) : null}
        <VerificationBanner
          mode="menu"
          onAction={() => {
            if (!hasPassword) {
              showPasswordReminder();
              return;
            }
            navigate("/app/settings/contacts?channel=email");
          }}
          verified={Boolean(session?.user?.verified)}
        />
        {shouldShowBarkGuideBanner ? (
          <button className="verification-banner bark-setup-banner" onClick={openBarkGuide} type="button">
            <div className="verification-banner-copy">
              <strong className="bark-banner-title">
                <BarkGuideIcon compact />
                <span>绑定Bark，实时联络</span>
              </strong>
              <span>下载Bark并绑定后，好友的消息即时推送，点击即刻回复。</span>
            </div>
            <span className="ghost-button verification-banner-action">去绑定</span>
          </button>
        ) : null}

        {viewState === "loading" ? <FeedbackState title="菜单加载中" description="正在同步你的账户与通知信息。" tone="loading" /> : null}

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setBasicDrawerOpen(true)} type="button">
              <div className="row-main">
                <strong>基础信息</strong>
                <div className="row-subtle">昵称、头像、欢迎语</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => setSecurityDrawerOpen(true)} type="button">
              <div className="row-main">
                <strong>账号与安全</strong>
                <div className="row-subtle">密码与登录安全</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </section>

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={openChannelsEntry} type="button">
              <div className="row-main">
                <strong>通知渠道</strong>
                <div className="row-subtle">{isAppleEnvironment ? "网页、邮件、短信、即时提醒" : "网页、邮件、短信提醒"}</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={openWebReminderDrawer} type="button">
              <div className="row-main">
                <strong>网页提醒</strong>
                <div className="row-subtle">{webReminderSummary}</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {visibleChannelRows.map(([channel, _value, label]) =>
              channelVerified(me, channel) ? (
                <button key={`${channel}-settings`} className="simple-row menu-link-row" onClick={() => openPrefDrawer(channel)} type="button">
                  <div className="row-main">
                    <strong>{label} 设置</strong>
                    <div className="row-subtle">
                      {prefs[channel].enabled
                        ? `${prefs[channel].threshold} 分钟后提醒${prefs[channel].hideMessageContent ? " · 不显示消息内容" : ""}`
                        : "当前已关闭"}
                    </div>
                  </div>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              ) : null
            )}
          </div>
        </section>

        <section className="list-section">
          <div className="simple-list">
            <button className="simple-row menu-link-row danger-row menu-danger-row" onClick={() => setLeaveConfirmOpen(true)} type="button">
              <div className="row-main">
                <strong>退出</strong>
                <div className="row-subtle">离开当前空间</div>
              </div>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </section>

      </section>

      <SideDrawer description="昵称、头像与欢迎语" open={basicDrawerOpen} onClose={() => setBasicDrawerOpen(false)} title="基础信息">
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setAvatarDialogOpen(true)} type="button">
              <div className="row-main menu-key-cell">
                <strong>头像</strong>
              </div>
              <div className="menu-detail-value">
                <UserAvatar className="mini-avatar" name={session?.user.name ?? "Sermo"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => openBasicEditDialog("name")} type="button">
              <div className="row-main menu-key-cell">
                <strong>昵称</strong>
              </div>
              <div className="menu-detail-value menu-detail-text">{session?.user.name ?? "Sermo User"}</div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => openBasicEditDialog("welcome")} type="button">
              <div className="row-main menu-key-cell">
                <strong>欢迎语</strong>
              </div>
              <div className="menu-detail-value menu-detail-text menu-summary-clamp">{welcomeSummary}</div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        description="登录安全与密码管理"
        open={securityDrawerOpen}
        onClose={() => {
          setSecurityDrawerOpen(false);
          if (new URLSearchParams(location.search).get("drawer") === "security") {
            navigate("/app/menu", { replace: true });
          }
        }}
        title="账号与安全"
      >
        <div className="detail-list">
          <div className="simple-list">
            <button
              className="simple-row menu-link-row"
              onClick={() => setPasswordSheetOpen(true)}
              type="button"
            >
              <div className="row-main">
                <strong>{hasPassword ? "更换密码" : "设置密码"}</strong>
                <div className="row-subtle">{hasPassword ? "更新当前登录密码。" : "设置后，别人不能只凭昵称登录你的账号。"}</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button
              className="simple-row menu-link-row"
              onClick={() => setGestureSheetOpen(true)}
              type="button"
            >
              <div className="row-main">
                <strong>手势解锁</strong>
                <div className="row-subtle">
                  {gestureEnabled
                    ? `${gestureLockAfterMinutes} 分钟后上锁`
                    : emailVerified
                      ? "未开启"
                      : "认证邮箱后可开启"}
                </div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button
              className="simple-row menu-link-row danger-row account-delete-row"
              onClick={() => {
                setAccountDeleteInput("");
                setAccountDeleteStep("intro");
              }}
              type="button"
            >
              <div className="row-main">
                <strong>注销账户</strong>
                <div className="row-subtle">删除账号并退出当前空间</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer description="管理网页、邮件、短信和即时提醒。" open={channelsDrawerOpen} onClose={() => setChannelsDrawerOpen(false)} title="通知渠道">
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={openWebReminderDrawer} type="button">
              <div className="row-main menu-key-cell">
                <strong>网页提醒</strong>
              </div>
              <div className="menu-detail-value menu-detail-text">
                <span className="menu-channel-value">{webReminderSummary}</span>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {visibleChannelRows.map(([channel, _value, label]) => {
              const verified = channelVerified(me, channel);
              return (
                <button
                  key={channel}
                  className="simple-row menu-link-row"
                  onClick={() => {
                    if (!verified) openAuthSheet(channel);
                  }}
                  type="button"
                >
                  <div className="row-main menu-key-cell">
                    <strong>{label}</strong>
                  </div>
                  <div className="menu-detail-value menu-detail-text">
                    {verified ? (
                      <span className="menu-channel-value">已绑定</span>
                    ) : !hasPassword ? (
                      <span className="menu-inline-action">先设密码</span>
                    ) : channel === "bark" ? (
                      <span className="menu-inline-action">去绑定</span>
                    ) : (
                      <span className="menu-inline-action">去认证</span>
                    )}
                  </div>
                  {!verified ? <span className="material-symbols-outlined">chevron_right</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        description="只影响当前浏览器的新消息提醒。"
        open={webReminderDrawerOpen}
        onClose={() => setWebReminderDrawerOpen(false)}
        title="网页提醒"
      >
        <div className="detail-list">
          <div className="menu-pref-list">
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>新消息提示音</strong>
                <div className="row-subtle">收到新消息时轻响</div>
              </div>
              <button
                aria-label="toggle-web-sound-reminder"
                className={`switch ${webReminderPrefs.soundEnabled ? "active" : ""}`}
                onClick={() => void updateWebReminderPrefs({ soundEnabled: !webReminderPrefs.soundEnabled })}
                type="button"
              />
            </div>
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>标题提醒</strong>
                <div className="row-subtle">标题显示未读数</div>
              </div>
              <button
                aria-label="toggle-web-title-reminder"
                className={`switch ${webReminderPrefs.titleEnabled ? "active" : ""}`}
                onClick={() => void updateWebReminderPrefs({ titleEnabled: !webReminderPrefs.titleEnabled })}
                type="button"
              />
            </div>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        description="扫一扫或复制链接，就能把这个空间里的好友邀请发给别人。"
        eyebrow="Share"
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        title="好友二维码"
      >
        <div className="detail-list menu-share-drawer">
          {friendInviteLoading ? <FeedbackState title="二维码生成中" description="正在准备专属好友邀请链接。" tone="loading" /> : null}

          {!friendInviteLoading && friendInviteQrUri ? (
            <div className="menu-share-card">
              <div className="menu-share-qr-shell">
                <div className="menu-share-qr-frame">
                  <img alt="好友邀请二维码" className="menu-share-qr-image" src={friendInviteQrUri} />
                  <div className="menu-share-qr-avatar">
                    <UserAvatar className="avatar-large" name={session?.user.name ?? "Sermo"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
                  </div>
                </div>
              </div>

              <div className="menu-share-meta">
                <strong>{session?.user.name ?? "Sermo User"} 的好友邀请</strong>
                <div className="row-subtle">仅限当前空间内使用，{friendInviteValidityText}</div>
              </div>

              <div className="menu-share-link-box">
                <div className="menu-share-link-text">{friendInviteLink}</div>
              </div>

              <div className="menu-share-actions">
                <button className="button" onClick={() => void copyFriendInviteLink()} type="button">
                  复制链接
                </button>
              </div>

              <div className="mode-switch menu-share-mode-switch">
                <button
                  className={`mode-pill ${friendInviteMode === "limited" ? "active" : ""}`}
                  onClick={() => setFriendInviteMode("limited")}
                  type="button"
                >
                  7天有效
                </button>
                <button
                  className={`mode-pill ${friendInviteMode === "permanent" ? "active" : ""}`}
                  onClick={() => setFriendInviteMode("permanent")}
                  type="button"
                >
                  无限期
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer
        description={prefDrawerChannel ? `${channelLabel(prefDrawerChannel)} 通知偏好` : ""}
        open={Boolean(prefDrawerChannel)}
        actionBusy={prefSaving}
        actionDisabled={!prefDraftDirty}
        actionLabel="完成"
        onAction={() => void savePrefDraft()}
        onClose={requestClosePrefDrawer}
        title={prefDrawerChannel ? `${channelLabel(prefDrawerChannel)} 设置` : "通知设置"}
      >
        {prefDrawerChannel && activePrefDraft ? (
          <div className="menu-pref-list">
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>启用提醒</strong>
              </div>
              <button
                aria-label={`toggle-${prefDrawerChannel}`}
                className={`switch ${activePrefDraft.enabled ? "active" : ""}`}
                onClick={() => updatePrefDraft({ enabled: !activePrefDraft.enabled })}
                type="button"
              />
            </div>
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>离线阈值</strong>
              </div>
              <div className="menu-pref-control">
                <div className="menu-stepper">
                  <button
                    onClick={() => updatePrefDraft({ threshold: Math.max(1, activePrefDraft.threshold - 1) })}
                    type="button"
                  >
                    −
                  </button>
                  <span className="menu-stepper-value mono">{activePrefDraft.threshold}</span>
                  <button
                    onClick={() => updatePrefDraft({ threshold: activePrefDraft.threshold + 1 })}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <span className="menu-stepper-unit">分钟</span>
              </div>
            </div>
            {prefDrawerChannel === "email" || prefDrawerChannel === "bark" ? (
              <>
                {prefDrawerChannel === "bark" ? (
                  <div className="menu-pref-row">
                    <div className="row-main">
                      <strong>点击打开聊天</strong>
                      <div className="row-subtle">点通知进入会话</div>
                    </div>
                    <button
                      aria-label="toggle-bark-open-chat"
                      className={`switch ${activePrefDraft.openChatOnTap ? "active" : ""}`}
                      onClick={() => updatePrefDraft({ openChatOnTap: !activePrefDraft.openChatOnTap })}
                      type="button"
                    />
                  </div>
                ) : null}
                <div className="menu-pref-row">
                  <div className="row-main">
                    <strong>隐藏消息内容</strong>
                    <div className="row-subtle">仅提示新消息</div>
                  </div>
                  <button
                    aria-label={`toggle-hide-content-${prefDrawerChannel}`}
                    className={`switch ${activePrefDraft.hideMessageContent ? "active" : ""}`}
                    onClick={() => updatePrefDraft({ hideMessageContent: !activePrefDraft.hideMessageContent })}
                    type="button"
                  />
                </div>
                {activePrefDraft.hideMessageContent ? (
                  <button className="menu-pref-row menu-pref-row-button" onClick={openPrefCustomDrawer} type="button">
                    <div className="row-main">
                      <strong>自定义消息提示</strong>
                      <div className="row-subtle">私聊和群聊文案</div>
                    </div>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </SideDrawer>
      <SideDrawer
        description="隐藏内容时使用"
        open={Boolean(prefDrawerChannel && prefCustomDrawerOpen && activePrefDraft)}
        actionBusy={prefSaving}
        actionDisabled={!prefDraftDirty}
        actionLabel="完成"
        onAction={() => void savePrefDraft()}
        onClose={requestClosePrefCustomDrawer}
        title="自定义消息提示"
      >
        {prefDrawerChannel && activePrefDraft ? (
          <div className="menu-pref-custom-drawer">
            <div className="menu-pref-list">
              <div className="menu-pref-form-card">
                <div className="simple-form notification-custom-message-fields">
                  <div>
                    <label className="field-label">私聊消息提示</label>
                    <input
                      className="input"
                      maxLength={255}
                      placeholder={defaultHiddenDirectMessagePlaceholder}
                      value={activePrefDraft.hiddenDirectMessageText}
                      onChange={(event) =>
                        updatePrefDraft({
                          hiddenDirectMessageText: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label">群聊消息提示</label>
                    <input
                      className="input"
                      maxLength={255}
                      placeholder={defaultHiddenGroupMessagePlaceholder}
                      value={activePrefDraft.hiddenGroupMessageText}
                      onChange={(event) =>
                        updatePrefDraft({
                          hiddenGroupMessageText: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SideDrawer>

      <SideDrawer
        description="三步完成 Bark 即时推送，聊天消息会更快抵达。"
        eyebrow="Instant Push"
        open={barkGuideOpen}
        onClose={closeBarkGuide}
        title="绑定即时提醒"
      >
        <div className="detail-list bark-guide">
          <div className="bark-guide-hero">
            <BarkGuideIcon />
            <div>
              <strong>让 Sermo 直接推到你的 iPhone</strong>
              <span>复制 Bark 的专属链接后，回到这里完成一次验证码确认。</span>
            </div>
          </div>

          <div className="bark-guide-steps">
            <section className="bark-guide-step">
              <span className="flow-index">1</span>
              <div>
                <strong>下载 Bark</strong>
                <p>从 App Store 安装 Bark，允许通知权限。</p>
                <a className="bark-store-link" href={barkAppStoreUrl} rel="noreferrer" target="_blank">
                  打开 App Store
                  <span className="material-symbols-outlined">chevron_right</span>
                </a>
              </div>
            </section>
            <section className="bark-guide-step">
              <span className="flow-index">2</span>
              <div>
                <strong>复制专属消息链接</strong>
                <p>打开 Bark，在首页复制以 https://api.day.app 开头的推送链接。</p>
              </div>
            </section>
            <section className="bark-guide-step active">
              <span className="flow-index">3</span>
              <div className="bark-guide-bind">
                <strong>粘贴并验证</strong>
                <p>我们会向这个 Bark 链接发送验证码，输入后即可绑定。</p>
                <div className="simple-form contact-sheet-form">
                  <input
                    className="input"
                    inputMode="url"
                    placeholder="https://api.day.app/..."
                    value={authTarget}
                    onChange={(event) => {
                      setAuthTarget(event.target.value);
                      setAuthCode("");
                      setAuthPending(false);
                      setAuthExpiresIn(0);
                    }}
                  />
                  <button
                    className="button contact-flow-primary"
                    disabled={authActionState === "sending" || !authTarget.trim() || authCooldown > 0}
                    onClick={() => void sendAuthCode()}
                    type="button"
                  >
                    {authActionState === "sending" ? "发送中..." : authCooldown > 0 ? `${authCooldown} 秒后重试` : "发送验证码"}
                  </button>
                  <div className={`contact-verify-block ${authPending ? "is-visible" : ""}`}>
                    <div className="field-label-row">
                      <label className="field-label">验证码</label>
                      {authPending && authExpiresIn > 0 ? <span className="field-countdown">还有 {authExpiresIn} 秒有效</span> : null}
                    </div>
                    <input className="input" value={authCode} onChange={(event) => setAuthCode(event.target.value)} />
                    <button
                      className="button contact-flow-primary"
                      disabled={authActionState === "binding" || !authCode.trim()}
                      onClick={() => void bindAuthChannel()}
                      type="button"
                    >
                      {authActionState === "binding" ? "处理中..." : "确认绑定即时提醒"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </SideDrawer>

      <BottomSheet
        bodyClassName="contact-sheet-body"
        className="contact-bottom-sheet"
        open={Boolean(authSheetChannel && authSheetChannel !== "bark")}
        title={authSheetChannel === "email" ? "认证邮箱" : authSheetChannel === "bark" ? "绑定即时提醒" : authSheetChannel ? `绑定${channelLabel(authSheetChannel)}` : "通知渠道认证"}
        description={authSheetChannel === "email" ? "认证邮箱后，账号会升级为 Verified。" : "发送验证码后完成绑定"}
        onClose={closeAuthSheet}
      >
        {authSheetChannel ? (
          <div ref={authSheetBodyRef} className="simple-form contact-sheet-form">
            <div className="field-label-row">
              <label className="field-label">{authSheetChannel === "email" ? "邮箱地址" : "目标地址"}</label>
              {authPending && authExpiresIn > 0 ? <span className="field-countdown">验证码还有 {authExpiresIn} 秒有效</span> : null}
            </div>
            <input
              className="input"
              placeholder={authSheetChannel === "email" ? "you@sermo.space" : authSheetChannel === "sms" ? "输入手机号" : "输入即时推送地址"}
              value={authTarget}
              onChange={(event) => {
                setAuthTarget(event.target.value);
                setAuthCode("");
                setAuthPending(false);
                setAuthExpiresIn(0);
              }}
            />
            <div className="contact-flow-actions">
              <button
                className="button contact-flow-primary"
                disabled={authActionState === "sending" || !authTarget.trim() || authCooldown > 0}
                onClick={() => void sendAuthCode()}
                type="button"
              >
                {authActionState === "sending" ? "发送中..." : authCooldown > 0 ? `${authCooldown} 秒后重试` : "发送验证码"}
              </button>
            </div>
            <div ref={authVerifyRef} className={`contact-verify-block ${authPending ? "is-visible" : ""}`}>
              <label className="field-label">验证码</label>
              <input className="input" value={authCode} onChange={(event) => setAuthCode(event.target.value)} />
              <div className="contact-flow-actions">
                <button
                  className="button contact-flow-primary"
                  disabled={authActionState === "binding" || !authCode.trim()}
                  onClick={() => void bindAuthChannel()}
                  type="button"
                >
                  {authActionState === "binding" ? "处理中..." : authSheetChannel === "email" ? "确认认证" : "确认绑定"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <BottomSheet
        bodyClassName="menu-security-sheet-body"
        className="contact-bottom-sheet"
        open={passwordSheetOpen}
        title={hasPassword ? "更换密码" : "设置密码"}
        description={hasPassword ? "输入当前密码后设置新密码。" : "设置后，别人不能只凭昵称登录你的账号。"}
        onClose={() => {
          if (passwordSaving) return;
          setPasswordSheetOpen(false);
        }}
      >
        <div className="simple-form menu-security-form">
          {hasPassword ? (
            <div className="menu-security-field">
              <label className="field-label">当前密码</label>
              <input className="input" type="password" value={passwordCurrent} onChange={(event) => setPasswordCurrent(event.target.value)} />
            </div>
          ) : null}
          <div className="menu-security-field">
            <label className="field-label">{hasPassword ? "新密码" : "设置密码"}</label>
            <input className="input" type="password" value={passwordNext} onChange={(event) => setPasswordNext(event.target.value)} />
          </div>
          <button
            className="button"
            disabled={passwordSaving || !passwordNext.trim() || (hasPassword && !passwordCurrent.trim())}
            onClick={() => void savePassword()}
            type="button"
          >
            {passwordSaving ? "处理中..." : hasPassword ? "确认更换" : "确认设置"}
          </button>
        </div>
      </BottomSheet>
      <BottomSheet
        bodyClassName="menu-security-sheet-body"
        className="contact-bottom-sheet"
        open={gestureSheetOpen}
        title="手势解锁"
        description="请设计您的手势。"
        onClose={() => setGestureSheetOpen(false)}
      >
        <GestureSetupPanel
          scope={gestureScope}
          canEnable={emailVerified}
          preference={gesturePreference}
          onChanged={setGesturePreference}
        />
      </BottomSheet>

      <AvatarPresetDialog
        currentAvatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
        displayName={session?.user.name ?? "Sermo User"}
        onClose={() => setAvatarDialogOpen(false)}
        onRequestCustomUpload={requestCustomAvatarUpload}
        onSave={savePresetAvatar}
        open={avatarDialogOpen}
        saving={avatarSaving}
      />
      <input
        ref={avatarFileInputRef}
        accept="image/*"
        hidden
        onChange={(event) => void handleCustomAvatarChange(event)}
        type="file"
      />
      <InputDialog
        busy={basicEditSaving}
        confirmLabel={basicEditField === "name" ? "保存昵称" : "保存欢迎语"}
        onChange={setBasicEditValue}
        onClose={() => setBasicEditField(null)}
        onConfirm={() => void confirmBasicEdit()}
        open={Boolean(basicEditField)}
        placeholder={basicEditField === "name" ? "输入新的昵称" : "输入新的欢迎语"}
        title={basicEditField === "name" ? "修改昵称" : "修改欢迎语"}
        value={basicEditValue}
      />
      <ConfirmDialog
        danger
        open={accountDeleteStep === "intro"}
        title="确认注销账户？"
        description="注销后，你会离开当前空间，好友关系和群聊成员关系也会被移除。"
        confirmLabel="继续注销"
        onClose={() => setAccountDeleteStep(null)}
        onConfirm={() => {
          setAccountDeleteInput("");
          setAccountDeleteStep("verify");
        }}
      />
      <InputDialog
        busy={accountDeleteSaving}
        confirmLabel="下一步"
        onChange={setAccountDeleteInput}
        onClose={() => setAccountDeleteStep(null)}
        onConfirm={confirmAccountDeleteInput}
        open={accountDeleteStep === "verify"}
        placeholder={hasPassword ? "输入当前密码" : `输入昵称：${session?.user.name ?? ""}`}
        title={hasPassword ? "验证当前密码" : "输入昵称确认"}
        type={hasPassword ? "password" : "text"}
        value={accountDeleteInput}
      />
      <ConfirmDialog
        danger
        busy={accountDeleteSaving}
        open={accountDeleteStep === "final"}
        title="最后确认一次"
        description="这个操作会注销你的账户，并清理你在当前空间中的好友和群聊关系。"
        confirmLabel="确认注销"
        onClose={() => {
          if (!accountDeleteSaving) setAccountDeleteStep(null);
        }}
        onConfirm={() => void deleteAccount()}
      />
      <RequestStatusModal
        errorLabel={statusModal?.errorLabel}
        loadingLabel={statusModal?.loadingLabel}
        onAutoClose={() => setStatusModal(null)}
        open={Boolean(statusModal?.open)}
        phase={statusModal?.phase ?? "loading"}
        successLabel={statusModal?.successLabel}
      />
      <ConfirmDialog
        open={discardPrefConfirmOpen}
        title="放弃这次修改？"
        description="你还没有完成保存，直接返回会丢失这次改动。"
        confirmLabel="直接返回"
        onClose={() => setDiscardPrefConfirmOpen(false)}
        onConfirm={() => {
          setDiscardPrefConfirmOpen(false);
          closePrefDrawers();
        }}
      />
      <ConfirmDialog
        open={discardCustomPrefConfirmOpen}
        title="放弃自定义消息提示？"
        description="你还没有完成保存，直接返回会丢失这次改动。"
        confirmLabel="直接返回"
        onClose={() => setDiscardCustomPrefConfirmOpen(false)}
        onConfirm={discardPrefCustomChanges}
      />
      <ConfirmDialog
        open={passwordReminderOpen}
        title="请先设置密码"
        description={passwordReminderDescription}
        confirmLabel="去设置"
        onClose={() => setPasswordReminderOpen(false)}
        onConfirm={() => {
          setPasswordReminderOpen(false);
          setSecurityDrawerOpen(true);
        }}
      />
      <ConfirmDialog
        danger
        open={leaveConfirmOpen}
        title="确认退出当前空间？"
        description="退出后会返回加入页。之后仍可以再次通过当前空间重新进入。"
        confirmLabel="确认退出"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          void leave();
        }}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
