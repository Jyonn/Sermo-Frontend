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
import { GestureDecoySetupPanel, GestureSetupPanel } from "../components/GestureLock";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { useAuth } from "../lib/auth";
import { normalizeContactTarget } from "../lib/contactTarget";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import { getWebReminderPreferences, mapWebReminderPreferences, setWebReminderPreferences, type WebReminderPreferences } from "../lib/webReminderPreferences";
import { getGestureLockAfterMinutes, getGestureLockScope } from "../lib/gestureLock";
import { VerificationBanner } from "../components/VerificationBanner";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { TabPageHeader } from "../components/TabPageHeader";
import { PwaInstallSheet } from "../components/PwaInstallSheet";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import { isStandalonePwa } from "../lib/pwaInstall";
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from "../lib/webPush";
import type { AppViewState, GestureLockPreferenceDTO, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences, SpaceDTO, SwitchAccountDTO, UserMeDTO } from "../types";

const channelRows: Array<[NotificationChannel, number, string]> = [
  ["email", 1, "邮件"],
  ["sms", 2, "短信"],
  ["bark", 3, "即时"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
  sms: { enabled: false, threshold: 15, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
  bark: { enabled: false, threshold: 5, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
};

const defaultHiddenDirectMessageTitle = "新私聊消息";
const defaultHiddenDirectMessagePlaceholder = "你收到了一条新的私聊消息。";
const defaultHiddenGroupMessageTitle = "新群聊消息";
const defaultHiddenGroupMessagePlaceholder = "你收到了一条新的群聊消息。";
const defaultFriendOnlineMessageTitle = "好友上线";
const defaultFriendOnlineMessagePlaceholder = "你的好友上线了。";
const barkAppStoreUrl = "https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%8E%A8%E9%80%81/id1403753865";
const defaultPasswordReminderDescription = "设置密码后，才能管理通知和提醒。";

type NotificationMessageKind = "direct" | "group" | "online";
type PreferenceEditor =
  | { type: "threshold"; channel: NotificationChannel }
  | { type: "message"; channel: NotificationChannel; kind: NotificationMessageKind; field: "title" | "content" };

interface MenuCacheSnapshot {
  space: SpaceDTO;
  me: UserMeDTO;
  prefs: NotificationPreferences;
  gesturePreference: GestureLockPreferenceDTO | null;
  webReminderPrefs: WebReminderPreferences;
}

function mapPrefs(rows: NotificationPreferenceDTO[]): NotificationPreferences {
  const next = { ...emptyPrefs };
  rows.forEach((row) => {
    const channel = row.channel === 1 ? "email" : row.channel === 2 ? "sms" : "bark";
    next[channel] = {
      enabled: row.enabled,
      threshold: row.offline_threshold_minutes,
      hideMessageContent: row.hide_message_content,
      hiddenDirectMessageTitle: row.hidden_direct_message_title ?? "",
      hiddenDirectMessageText: row.hidden_direct_message_text ?? "",
      hiddenGroupMessageTitle: row.hidden_group_message_title ?? "",
      hiddenGroupMessageText: row.hidden_group_message_text ?? "",
      friendOnlineMessageTitle: row.friend_online_message_title ?? "",
      friendOnlineMessageText: row.friend_online_message_text ?? "",
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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [me, setMe] = useState<UserMeDTO | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(emptyPrefs);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [basicDrawerOpen, setBasicDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [switchAccounts, setSwitchAccounts] = useState<SwitchAccountDTO[]>([]);
  const [accountSwitcherLoading, setAccountSwitcherLoading] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState<number | null>(null);
  const [privateAccountSaving, setPrivateAccountSaving] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [gestureSheetOpen, setGestureSheetOpen] = useState(false);
  const [gestureDecoySheetOpen, setGestureDecoySheetOpen] = useState(false);
  const [gesturePreference, setGesturePreference] = useState<GestureLockPreferenceDTO | null>(null);
  const [channelsDrawerOpen, setChannelsDrawerOpen] = useState(false);
  const [webReminderDrawerOpen, setWebReminderDrawerOpen] = useState(false);
  const [webReminderPrefs, setWebReminderPrefs] = useState<WebReminderPreferences>(() => getWebReminderPreferences());
  const [webPushState, setWebPushState] = useState<WebPushState>("checking");
  const [webPushSaving, setWebPushSaving] = useState(false);
  const [pwaInstallSheetOpen, setPwaInstallSheetOpen] = useState(false);
  const [barkGuideOpen, setBarkGuideOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);
  const [passwordReminderDescription, setPasswordReminderDescription] = useState(defaultPasswordReminderDescription);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [accountDeleteStep, setAccountDeleteStep] = useState<"intro" | "verify" | "final" | null>(null);
  const [accountDeleteInput, setAccountDeleteInput] = useState("");
  const [accountDeleteSaving, setAccountDeleteSaving] = useState(false);
  const [prefDrawerChannel, setPrefDrawerChannel] = useState<NotificationChannel | null>(null);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefCustomDrawerOpen, setPrefCustomDrawerOpen] = useState(false);
  const [prefEditor, setPrefEditor] = useState<PreferenceEditor | null>(null);
  const [prefEditorValue, setPrefEditorValue] = useState("");
  const [prefEditorSaving, setPrefEditorSaving] = useState(false);
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
  const authVerifyRef = useRef<HTMLDivElement | null>(null);
  const authSheetBodyRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const cacheScope = buildTabCacheScope(session?.user.space_id, currentUserId);
  const hasPassword = Boolean(me?.has_password ?? session?.user.has_password);
  const gestureScope = useMemo(() => getGestureLockScope(session), [session]);
  const emailVerified = Boolean(me ? me.email_verified_at : session?.user.email_verified_at);
  const phoneVerified = Boolean(me ? me.phone_verified_at : session?.user.phone_verified_at);
  const isAppleEnvironment = useMemo(() => detectAppleEnvironment(), []);
  const visibleChannelRows = useMemo(
    () => channelRows.filter(([channel]) => channel !== "bark" || isAppleEnvironment),
    [isAppleEnvironment]
  );
  const barkBound = channelVerified(me, "bark");
  const shouldShowBarkGuideBanner = isAppleEnvironment && !barkBound;
  const standalonePwa = isStandalonePwa();
  const webReminderSummary = [
    webReminderPrefs.soundEnabled ? "提示音已开" : "提示音已关",
    webReminderPrefs.titleEnabled ? "标题已开" : "标题已关",
  ].join(" · ");

  const showPasswordReminder = (description = defaultPasswordReminderDescription) => {
    setPasswordReminderDescription(description);
    setPasswordReminderOpen(true);
  };

  const openAccountSwitcher = async () => {
    setAccountSwitcherOpen(true);
    setAccountSwitcherLoading(true);
    try {
      setSwitchAccounts(await api.getSwitchAccounts());
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "账号列表加载失败", "error");
    } finally {
      setAccountSwitcherLoading(false);
    }
  };

  const switchAccount = async (account: SwitchAccountDTO) => {
    setSwitchingUserId(account.user.user_id);
    try {
      const payload = await api.createAccountSwitchTicket(account.user.user_id);
      window.location.assign(
        buildSpaceHrefForCurrentHost(
          payload.space.slug,
          "/account-switch",
          "",
          `ticket=${encodeURIComponent(payload.token)}`
        )
      );
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "账号切换失败", "error");
      setSwitchingUserId(null);
    }
  };

  const togglePrivateAccount = async () => {
    if (!me || privateAccountSaving) return;
    if (!emailVerified || !phoneVerified) {
      showToast("绑定并认证邮箱和手机后可设置", "error");
      return;
    }
    setPrivateAccountSaving(true);
    try {
      const updated = await api.updatePrivateAccount(!me.is_private_account);
      setMe(updated);
      patchSessionUser({ is_private_account: updated.is_private_account });
      showToast(updated.is_private_account ? "已设为私密账号" : "已允许账号发现");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "设置失败", "error");
    } finally {
      setPrivateAccountSaving(false);
    }
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
    setWebReminderDrawerOpen(true);
  };

  useEffect(() => {
    if (!webReminderDrawerOpen) return;
    let active = true;
    setWebPushState("checking");
    void getWebPushState()
      .then((state) => {
        if (active) setWebPushState(state);
      })
      .catch(() => {
        if (active) setWebPushState("off");
      });
    return () => {
      active = false;
    };
  }, [webReminderDrawerOpen]);

  const toggleWebPush = async () => {
    if (webPushSaving || webPushState === "checking") return;
    setWebPushSaving(true);
    try {
      if (webPushState === "on") {
        await disableWebPush();
      } else {
        await enableWebPush();
      }
      setWebPushState(await getWebPushState());
    } catch (pushError) {
      setWebPushState(await getWebPushState().catch((): WebPushState => "off"));
      setError(pushError instanceof Error ? pushError.message : "系统通知设置失败");
    } finally {
      setWebPushSaving(false);
    }
  };

  const webPushDescription = {
    checking: "正在检查",
    unsupported: "当前浏览器不支持",
    "needs-install": "添加到主屏幕后开启",
    denied: "请在系统设置中允许",
    off: "未开启",
    on: "已开启",
  }[webPushState];

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    const cached = readTabCache<MenuCacheSnapshot>(cacheScope, "menu");
    if (cached) {
      setSpace(cached.data.space);
      setMe(cached.data.me);
      setPrefs(cached.data.prefs);
      setGesturePreference(cached.data.gesturePreference);
      setWebReminderPrefs(cached.data.webReminderPrefs);
      setWebReminderPreferences(cached.data.webReminderPrefs);
      setViewState("ready");
    } else {
      setViewState("loading");
    }
    setSyncing(true);
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
        writeTabCache(cacheScope, "menu", {
          space: spaceInfo,
          me: meInfo,
          prefs: mapPrefs(prefRows),
          gesturePreference: gestureInfo,
          webReminderPrefs: nextWebReminderPrefs,
        });
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
          is_private_account: meInfo.is_private_account,
          language: meInfo.language,
          last_heartbeat: meInfo.last_heartbeat,
        });
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached) {
          const message = apiError instanceof ApiError ? apiError.message : "菜单加载失败";
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope, currentUserId]);

  useEffect(() => {
    if (viewState !== "ready" || !space || !me) return;
    writeTabCache(cacheScope, "menu", { space, me, prefs, gesturePreference, webReminderPrefs });
  }, [cacheScope, gesturePreference, me, prefs, space, viewState, webReminderPrefs]);

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
      showPasswordReminder();
      return;
    }
    if (channel === "bark") {
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
    setPrefSaving(false);
    setPrefCustomDrawerOpen(false);
    setPrefEditor(null);
  };

  const openPrefDrawer = (channel: NotificationChannel) => {
    setPrefDrawerChannel(channel);
    setPrefCustomDrawerOpen(false);
  };

  const preferenceFromResponse = (updated: NotificationPreferenceDTO): NotificationPreferences[NotificationChannel] => ({
    enabled: updated.enabled,
    threshold: updated.offline_threshold_minutes,
    hideMessageContent: updated.hide_message_content,
    hiddenDirectMessageTitle: updated.hidden_direct_message_title ?? "",
    hiddenDirectMessageText: updated.hidden_direct_message_text ?? "",
    hiddenGroupMessageTitle: updated.hidden_group_message_title ?? "",
    hiddenGroupMessageText: updated.hidden_group_message_text ?? "",
    friendOnlineMessageTitle: updated.friend_online_message_title ?? "",
    friendOnlineMessageText: updated.friend_online_message_text ?? "",
    openChatOnTap: updated.open_chat_on_tap ?? true,
  });

  const savePreferencePatch = async (
    channel: NotificationChannel,
    patch: Omit<Parameters<typeof api.updateNotificationPref>[0], "channel">
  ) => {
    setPrefSaving(true);
    setError(null);
    try {
      const updated = await api.updateNotificationPref({ ...patch, channel: channelCode(channel) });
      setPrefs((current) => ({ ...current, [channel]: preferenceFromResponse(updated) }));
      return true;
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "更新通知设置失败");
      return false;
    } finally {
      setPrefSaving(false);
    }
  };

  const messagePreferenceValue = (
    pref: NotificationPreferences[NotificationChannel],
    kind: NotificationMessageKind,
    field: "title" | "content"
  ) => {
    if (kind === "direct") return field === "title" ? pref.hiddenDirectMessageTitle : pref.hiddenDirectMessageText;
    if (kind === "group") return field === "title" ? pref.hiddenGroupMessageTitle : pref.hiddenGroupMessageText;
    return field === "title" ? pref.friendOnlineMessageTitle : pref.friendOnlineMessageText;
  };

  const openThresholdEditor = (channel: NotificationChannel) => {
    setPrefEditor({ type: "threshold", channel });
    setPrefEditorValue(String(prefs[channel].threshold));
  };

  const openMessageEditor = (channel: NotificationChannel, kind: NotificationMessageKind, field: "title" | "content") => {
    setPrefEditor({ type: "message", channel, kind, field });
    setPrefEditorValue(messagePreferenceValue(prefs[channel], kind, field));
  };

  const savePreferenceEditor = async () => {
    if (!prefEditor || prefEditorSaving) return;
    setPrefEditorSaving(true);
    let patch: Omit<Parameters<typeof api.updateNotificationPref>[0], "channel">;
    if (prefEditor.type === "threshold") {
      patch = { offline_threshold_minutes: Math.min(60, Math.max(1, Number(prefEditorValue))) };
    } else {
      const value = prefEditorValue.trim();
      const key = `${prefEditor.kind}:${prefEditor.field}`;
      patch = {
        ...(key === "direct:title" ? { hidden_direct_message_title: value } : {}),
        ...(key === "direct:content" ? { hidden_direct_message_text: value } : {}),
        ...(key === "group:title" ? { hidden_group_message_title: value } : {}),
        ...(key === "group:content" ? { hidden_group_message_text: value } : {}),
        ...(key === "online:title" ? { friend_online_message_title: value } : {}),
        ...(key === "online:content" ? { friend_online_message_text: value } : {}),
      };
    }
    const saved = await savePreferencePatch(prefEditor.channel, patch);
    if (saved) setPrefEditor(null);
    setPrefEditorSaving(false);
  };

  const sendAuthCode = async () => {
    if (!authSheetChannel) return;
    try {
      setAuthActionState("sending");
      const normalizedTarget = normalizeContactTarget(authSheetChannel, authTarget);
      setAuthTarget(normalizedTarget);
      const payload = await api.sendContactCode({ channel: channelCode(authSheetChannel), target: normalizedTarget });
      setAuthPending(true);
      setAuthCooldown(60);
      setAuthExpiresIn(payload.expires_in);
      showToast("验证码已发送");
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setSecurityDrawerOpen(true);
      }
      showToast(apiError instanceof ApiError ? apiError.message : "发送验证码失败", "error");
    } finally {
      setAuthActionState("idle");
    }
  };

  const bindAuthChannel = async () => {
    if (!authSheetChannel) return;
    try {
      setAuthActionState("binding");
      const normalizedTarget = normalizeContactTarget(authSheetChannel, authTarget);
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
      closeAuthSheet();
      showToast(authSheetChannel === "email" ? "邮箱认证成功" : "绑定成功");
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.identifier === "PASSWORD_NOT_SET") {
        closeAuthSheet();
        setSecurityDrawerOpen(true);
      }
      showToast(
        apiError instanceof ApiError ? apiError.message : authSheetChannel === "email" ? "邮箱认证失败" : "绑定失败",
        "error"
      );
    } finally {
      setAuthActionState("idle");
    }
  };

  const savePassword = async () => {
    if (!passwordNext.trim()) return;

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
      setSecurityDrawerOpen(false);
      showToast(hasPassword ? "密码已更新" : "密码已设置");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : hasPassword ? "密码更新失败" : "密码设置失败", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const leave = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const savePresetAvatar = async (presetId: number) => {
    try {
      setAvatarSaving(true);
      const payload = await api.setPresetAvatar(presetId);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      showToast("头像已更新");
    } catch (apiError) {
      showToast(apiError instanceof ApiError ? apiError.message : "头像更新失败", "error");
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

    try {
      setAvatarSaving(true);
      const payload = await uploadCustomAvatar(file);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setMe((current) => (current ? { ...current, avatar_type: payload.avatar_type, avatar_uri: payload.avatar_uri } : current));
      setAvatarDialogOpen(false);
      showToast("头像上传成功");
    } catch (uploadError) {
      showToast(
        uploadError instanceof AvatarUploadError || uploadError instanceof ApiError
          ? uploadError.message
          : "头像上传失败",
        "error"
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
      setBasicEditSaving(true);
      const editingField = basicEditField;
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
      showToast(editingField === "name" ? "昵称已更新" : "欢迎语已更新");
    } catch (apiError) {
      showToast(
        apiError instanceof ApiError ? apiError.message : basicEditField === "name" ? "昵称更新失败" : "欢迎语更新失败",
        "error"
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
      showToast("链接已复制");
    } catch {
      showToast("复制失败", "error");
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

  const activePref = prefDrawerChannel ? prefs[prefDrawerChannel] : null;
  const editorMessageDefaults = (kind: NotificationMessageKind) => {
    if (kind === "direct") return { title: defaultHiddenDirectMessageTitle, content: defaultHiddenDirectMessagePlaceholder };
    if (kind === "group") return { title: defaultHiddenGroupMessageTitle, content: defaultHiddenGroupMessagePlaceholder };
    return { title: defaultFriendOnlineMessageTitle, content: defaultFriendOnlineMessagePlaceholder };
  };
  const editorPreview = (() => {
    if (!prefEditor || prefEditor.type !== "message") return null;
    const pref = prefs[prefEditor.channel];
    const defaults = editorMessageDefaults(prefEditor.kind);
    const titleValue = prefEditor.field === "title" ? prefEditorValue : messagePreferenceValue(pref, prefEditor.kind, "title");
    const contentValue = prefEditor.field === "content" ? prefEditorValue : messagePreferenceValue(pref, prefEditor.kind, "content");
    return {
      title: titleValue.trim() || defaults.title,
      content: contentValue.trim() || defaults.content,
    };
  })();

  const openFriendInviteDrawer = () => {
    if (!canUseFriendInvite) {
      setError("完成邮箱认证后才能使用好友二维码。");
      return;
    }
    setInviteDrawerOpen(true);
  };

  return (
    <AppChrome title="菜单" hideTopbar shellClassName="desktop-tab-shell">
      <section className="page-stack">
        <TabPageHeader
          title={
            <span className="menu-switch-title">
              <span>菜单</span>
              <span className="menu-switch-separator">·</span>
              <button
                aria-label="切换账号"
                className="menu-account-switch-trigger"
                onClick={() => void openAccountSwitcher()}
                type="button"
              >
                <span className="menu-account-switch-icon" aria-hidden="true">⇄</span>
                <span>{space?.name ?? "当前空间"}</span>
              </button>
            </span>
          }
          syncing={syncing}
        />
        <div className="menu-profile-card">
          <button className="profile-avatar-button menu-profile-avatar" onClick={() => setAvatarDialogOpen(true)} type="button">
            <UserAvatar className="avatar-large" name={session?.user.name ?? "言浪用户"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
          </button>
          <div className="row-main menu-profile-copy">
            <div className="menu-profile-heading">
              <strong>{session?.user.name ?? "言浪用户"}</strong>
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
            {!standalonePwa ? (
              <button className="simple-row menu-link-row" onClick={() => setPwaInstallSheetOpen(true)} type="button">
                <div className="row-main">
                  <strong className="menu-install-title">
                    <span>安装 {space?.name ?? "当前空间"}</span>
                    <UserAvatar className="menu-install-avatar" name={space?.official_user?.name ?? space?.name ?? "空间"} uri={space?.official_user?.avatar_uri} />
                    <span>到桌面</span>
                  </strong>
                  <div className="row-subtle">快捷打开并接收通知</div>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ) : null}
            <button className="simple-row menu-link-row" onClick={openChannelsEntry} type="button">
              <div className="row-main">
                <strong>通知和提醒</strong>
                <div className="row-subtle">{isAppleEnvironment ? "网页、邮件、短信、即时提醒" : "网页、邮件、短信提醒"}</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
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

      <PwaInstallSheet
        onClose={() => setPwaInstallSheetOpen(false)}
        open={pwaInstallSheetOpen}
        spaceName={space?.name ?? "当前空间"}
      />

      <SideDrawer description="昵称、头像与欢迎语" open={basicDrawerOpen} onClose={() => setBasicDrawerOpen(false)} title="基础信息">
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={() => setAvatarDialogOpen(true)} type="button">
              <div className="row-main menu-key-cell">
                <strong>头像</strong>
              </div>
              <div className="menu-detail-value">
                <UserAvatar className="mini-avatar" name={session?.user.name ?? "言浪用户"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button className="simple-row menu-link-row" onClick={() => openBasicEditDialog("name")} type="button">
              <div className="row-main menu-key-cell">
                <strong>昵称</strong>
              </div>
              <div className="menu-detail-value menu-detail-text">{session?.user.name ?? "言浪用户"}</div>
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
            {gestureEnabled ? (
              <button
                className="simple-row menu-link-row"
                onClick={() => setGestureDecoySheetOpen(true)}
                type="button"
              >
                <div className="row-main">
                  <strong>伪成功解锁</strong>
                  <div className="row-subtle">{gesturePreference?.decoy_enabled ? "已设置" : "未设置"}</div>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            ) : null}
            {!me?.official ? (
              <div className="simple-row menu-link-row menu-toggle-row">
                <div className="row-main">
                  <strong>私密账号</strong>
                  <div className="row-subtle">
                    {emailVerified && phoneVerified
                      ? me?.is_private_account
                        ? "不会出现在其他账号的切换列表"
                        : "可被相同联系方式的账号发现"
                      : "绑定邮箱和手机后可设置"}
                  </div>
                </div>
                <button
                  aria-label="切换私密账号"
                  className={`switch ${me?.is_private_account ? "active" : ""}`}
                  disabled={privateAccountSaving || !emailVerified || !phoneVerified}
                  onClick={() => void togglePrivateAccount()}
                  type="button"
                />
              </div>
            ) : null}
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

      <BottomSheet
        open={accountSwitcherOpen}
        title="切换账号"
        onClose={() => {
          if (switchingUserId !== null) return;
          setAccountSwitcherOpen(false);
        }}
      >
        <div className="simple-list account-switch-list">
          {accountSwitcherLoading ? (
            <FeedbackState title="正在查找账号" description="" tone="loading" />
          ) : switchAccounts.length ? (
            switchAccounts.map((account) => (
              <button
                key={`${account.space.space_id}-${account.user.user_id}`}
                className="simple-row person-row"
                disabled={switchingUserId !== null}
                onClick={() => void switchAccount(account)}
                type="button"
              >
                <UserAvatar className="mini-avatar" name={account.user.name} uri={account.user.avatar_uri} />
                <div className="row-main">
                  <strong>{account.user.name}</strong>
                  <div className="row-subtle">
                    {account.space.name}{account.user.official ? " · 管理账号" : ""}
                  </div>
                </div>
                {switchingUserId === account.user.user_id ? (
                  <HeaderSyncIndicator syncing />
                ) : (
                  <span className="material-symbols-outlined">chevron_right</span>
                )}
              </button>
            ))
          ) : (
            <FeedbackState title="没有可切换的账号" description="已设为私密的账号不会显示。" />
          )}
        </div>
      </BottomSheet>

      <SideDrawer description="管理网页、邮件、短信和即时提醒" open={channelsDrawerOpen} onClose={() => setChannelsDrawerOpen(false)} title="通知和提醒">
        <div className="detail-list">
          <div className="simple-list">
            <button className="simple-row menu-link-row" onClick={openWebReminderDrawer} type="button">
              <div className="row-main menu-key-cell">
                <strong>网页</strong>
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
                  onClick={() => verified ? openPrefDrawer(channel) : openAuthSheet(channel)}
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
                  <span className="material-symbols-outlined">chevron_right</span>
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
                <strong>系统通知</strong>
                <div className="row-subtle">{webPushDescription}</div>
              </div>
              <button
                aria-label="toggle-web-push"
                className={`switch ${webPushState === "on" ? "active" : ""}`}
                disabled={webPushSaving || webPushState === "checking" || webPushState === "unsupported" || webPushState === "denied"}
                onClick={() => void toggleWebPush()}
                type="button"
              />
            </div>
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
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        title="好友二维码"
        titleAccessory={<HeaderSyncIndicator syncing={friendInviteLoading} />}
      >
        <div className="detail-list menu-share-drawer">
          {!friendInviteLoading && friendInviteQrUri ? (
            <div className="menu-share-card">
              <div className="menu-share-qr-shell">
                <div className="menu-share-qr-frame">
                  <img alt="好友邀请二维码" className="menu-share-qr-image" src={friendInviteQrUri} />
                  <div className="menu-share-qr-avatar">
                    <UserAvatar className="avatar-large" name={session?.user.name ?? "言浪用户"} uri={me?.avatar_uri ?? session?.user.avatar_uri} />
                  </div>
                </div>
              </div>

              <div className="menu-share-meta">
                <strong>{session?.user.name ?? "言浪用户"} 的好友邀请</strong>
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
        description={prefDrawerChannel ? `${channelLabel(prefDrawerChannel)}通知偏好` : ""}
        open={Boolean(prefDrawerChannel)}
        onClose={closePrefDrawers}
        title={prefDrawerChannel ? `${channelLabel(prefDrawerChannel)}设置` : "通知设置"}
      >
        {prefDrawerChannel && activePref ? (
          <div className="menu-pref-list">
            <div className="menu-pref-row">
              <div className="row-main">
                <strong>启用提醒</strong>
                {prefDrawerChannel === "sms" ? <div className="row-subtle">暂不支持</div> : null}
              </div>
              <button
                aria-label={`toggle-${prefDrawerChannel}`}
                className={`switch ${prefDrawerChannel !== "sms" && activePref.enabled ? "active" : ""}`}
                disabled={prefSaving || prefDrawerChannel === "sms"}
                onClick={() => void savePreferencePatch(prefDrawerChannel, { enabled: activePref.enabled ? 0 : 1 })}
                type="button"
              />
            </div>
            <button className="menu-pref-row menu-pref-row-button" onClick={() => openThresholdEditor(prefDrawerChannel)} type="button">
              <div className="row-main">
                <strong>离线阈值</strong>
              </div>
              <div className="menu-pref-row-value">
                <span>{activePref.threshold} 分钟</span>
                <span className="material-symbols-outlined">chevron_right</span>
              </div>
            </button>
            {prefDrawerChannel === "email" || prefDrawerChannel === "bark" ? (
              <>
                <div className="menu-pref-row">
                  <div className="row-main">
                    <strong>隐藏消息内容</strong>
                    <div className="row-subtle">仅提示新消息</div>
                  </div>
                  <button
                    aria-label={`toggle-hide-content-${prefDrawerChannel}`}
                    className={`switch ${activePref.hideMessageContent ? "active" : ""}`}
                    disabled={prefSaving}
                    onClick={() => void savePreferencePatch(prefDrawerChannel, { hide_message_content: activePref.hideMessageContent ? 0 : 1 })}
                    type="button"
                  />
                </div>
                {activePref.hideMessageContent ? (
                  <button className="menu-pref-row menu-pref-row-button" onClick={() => setPrefCustomDrawerOpen(true)} type="button">
                    <div className="row-main">
                      <strong>自定义消息提示</strong>
                      <div className="row-subtle">按消息类型设置</div>
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
        description={prefDrawerChannel === "email" ? "邮件正文" : "标题与内容"}
        open={Boolean(prefDrawerChannel && prefCustomDrawerOpen && activePref?.hideMessageContent)}
        onClose={() => setPrefCustomDrawerOpen(false)}
        title="自定义消息提示"
      >
        {prefDrawerChannel && activePref ? (
          <div className="menu-pref-custom-drawer">
            {prefDrawerChannel === "bark" ? (
              <div className="menu-pref-list">
                <div className="menu-pref-row">
                  <div className="row-main"><strong>点击打开聊天</strong><div className="row-subtle">通知携带聊天链接</div></div>
                  <button
                    aria-label="toggle-bark-open-chat"
                    className={`switch ${activePref.openChatOnTap ? "active" : ""}`}
                    disabled={prefSaving}
                    onClick={() => void savePreferencePatch("bark", { open_chat_on_tap: activePref.openChatOnTap ? 0 : 1 })}
                    type="button"
                  />
                </div>
              </div>
            ) : null}
            {(["direct", "group", "online"] as NotificationMessageKind[]).map((kind) => {
              const label = kind === "direct" ? "私聊提示" : kind === "group" ? "群聊提示" : "上线提示";
              const content = messagePreferenceValue(activePref, kind, "content");
              const title = messagePreferenceValue(activePref, kind, "title");
              return (
                <section className="notification-template-block" key={kind}>
                  <div className="section-label">{label}</div>
                  <div className="simple-list">
                    {prefDrawerChannel === "bark" ? (
                      <button className="simple-row menu-link-row" onClick={() => openMessageEditor(prefDrawerChannel, kind, "title")} type="button">
                        <div className="row-main"><strong>标题自定义</strong><div className="row-subtle">{title || "使用默认标题"}</div></div>
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    ) : null}
                    <button className="simple-row menu-link-row" onClick={() => openMessageEditor(prefDrawerChannel, kind, "content")} type="button">
                      <div className="row-main"><strong>内容自定义</strong><div className="row-subtle">{content || "使用默认内容"}</div></div>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </SideDrawer>

      <SideDrawer
        description="消息直接送达 iPhone"
        open={barkGuideOpen}
        onClose={closeBarkGuide}
        title="绑定 Bark"
      >
        <div className="bark-guide">
          <div className="bark-guide-app">
            <BarkGuideIcon />
            <div>
              <strong>Bark</strong>
              <span>接收言浪即时提醒</span>
            </div>
            <span className="bark-guide-duration">约 1 分钟</span>
          </div>

          <ol className="bark-guide-steps">
            <li className="bark-guide-step">
              <span className="bark-guide-index">1</span>
              <div className="bark-guide-step-content">
                <strong>下载 Bark</strong>
                <p>安装后允许通知。</p>
                <a className="bark-store-link" href={barkAppStoreUrl} rel="noreferrer" target="_blank">
                  前往 App Store
                  <span className="material-symbols-outlined">chevron_right</span>
                </a>
              </div>
            </li>
            <li className="bark-guide-step">
              <span className="bark-guide-index">2</span>
              <div className="bark-guide-step-content">
                <strong>复制推送链接</strong>
                <p>在 Bark 首页轻点「复制」。</p>
                <code className="bark-guide-link-example">https://api.day.app/••••••</code>
              </div>
            </li>
            <li className="bark-guide-step is-action">
              <span className="bark-guide-index">3</span>
              <div className="bark-guide-step-content bark-guide-bind">
                <strong>{authPending ? "输入验证码" : "粘贴链接"}</strong>
                <p>{authPending ? "验证码已发送到 Bark。" : "整段粘贴即可，我们会自动识别。"}</p>
                <div className="simple-form contact-sheet-form">
                  <label className="field-label" htmlFor="bark-endpoint">推送链接</label>
                  <input
                    id="bark-endpoint"
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
            </li>
          </ol>
        </div>
      </SideDrawer>

      <BottomSheet
        bodyClassName="contact-sheet-body"
        className="contact-bottom-sheet"
        open={Boolean(authSheetChannel && authSheetChannel !== "bark")}
        title={authSheetChannel === "email" ? "认证邮箱" : authSheetChannel === "bark" ? "绑定即时提醒" : authSheetChannel ? `绑定${channelLabel(authSheetChannel)}` : "通知认证"}
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
      <BottomSheet
        bodyClassName="menu-security-sheet-body"
        className="contact-bottom-sheet"
        open={gestureDecoySheetOpen}
        title="伪成功解锁"
        description="请设计伪手势。"
        onClose={() => setGestureDecoySheetOpen(false)}
      >
        <GestureDecoySetupPanel
          scope={gestureScope}
          preference={gesturePreference}
          onChanged={setGesturePreference}
        />
      </BottomSheet>

      <AvatarPresetDialog
        currentAvatarUri={me?.avatar_uri ?? session?.user.avatar_uri}
        displayName={session?.user.name ?? "言浪用户"}
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
      {prefEditor ? (
        <div
          className="dialog-backdrop notification-editor-backdrop"
          onClick={() => {
            if (!prefEditorSaving) setPrefEditor(null);
          }}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="notification-editor-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="notification-editor-heading">
              <div>
                <h2>{prefEditor.type === "threshold" ? "离线阈值" : prefEditor.field === "title" ? "自定义标题" : "自定义内容"}</h2>
                <p>{prefEditor.type === "threshold" ? "离线多久后发送提醒" : "留空将使用默认文案"}</p>
              </div>
              <button className="icon-button" disabled={prefEditorSaving} onClick={() => setPrefEditor(null)} type="button" aria-label="关闭">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {prefEditor.type === "threshold" ? (
              <div className="notification-threshold-editor">
                <strong>{prefEditorValue} 分钟</strong>
                <input
                  aria-label="离线阈值"
                  max={60}
                  min={1}
                  onChange={(event) => setPrefEditorValue(event.target.value)}
                  type="range"
                  value={prefEditorValue}
                />
                <div><span>1 分钟</span><span>60 分钟</span></div>
              </div>
            ) : (
              <>
                {prefEditor.field === "title" ? (
                  <input
                    autoFocus
                    className="input"
                    maxLength={80}
                    onChange={(event) => setPrefEditorValue(event.target.value)}
                    placeholder={editorMessageDefaults(prefEditor.kind).title}
                    value={prefEditorValue}
                  />
                ) : (
                  <textarea
                    autoFocus
                    className="textarea notification-editor-textarea"
                    maxLength={255}
                    onChange={(event) => setPrefEditorValue(event.target.value)}
                    placeholder={editorMessageDefaults(prefEditor.kind).content}
                    rows={3}
                    value={prefEditorValue}
                  />
                )}
                {editorPreview ? (
                  <div className={`notification-push-preview is-${prefEditor.channel}`}>
                    {prefEditor.channel === "bark" ? <img alt="" src={barkAppIconUrl} /> : <span className="notification-mail-preview-icon">邮</span>}
                    <div>
                      <strong>{prefEditor.channel === "bark" ? `【言浪】${editorPreview.title}` : "邮件正文预览"}</strong>
                      <p>{editorPreview.content}</p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
            <div className="notification-editor-actions">
              <button className="ghost-button" disabled={prefEditorSaving} onClick={() => setPrefEditor(null)} type="button">取消</button>
              <button className="button" disabled={prefEditorSaving} onClick={() => void savePreferenceEditor()} type="button">
                {prefEditorSaving ? "保存中" : "保存"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
