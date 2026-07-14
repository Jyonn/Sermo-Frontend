import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedbackState } from "../components/FeedbackState";
import { InputDialog } from "../components/InputDialog";
import { RequestStatusModal } from "../components/RequestStatusModal";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { useAuth } from "../lib/auth";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost } from "../lib/spaceEntry";
import { VerificationBanner } from "../components/VerificationBanner";
import type { AppViewState, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences, SpaceDTO, UserMeDTO } from "../types";

const channelRows: Array<[NotificationChannel, number, string]> = [
  ["email", 1, "Email"],
  ["sms", 2, "SMS"],
  ["bark", 3, "Bark"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "" },
  sms: { enabled: false, threshold: 15, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "" },
  bark: { enabled: false, threshold: 5, hideMessageContent: false, hiddenDirectMessageText: "", hiddenGroupMessageText: "" },
};

const defaultHiddenDirectMessagePlaceholder = "你收到了一条新的私聊消息。";
const defaultHiddenGroupMessagePlaceholder = "你收到了一条新的群聊消息。";

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
    left.hiddenGroupMessageText === right.hiddenGroupMessageText
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

function QrCodeIcon() {
  return (
    <svg aria-hidden="true" className="menu-qr-icon" fill="none" viewBox="0 0 24 24">
      <path d="M4.5 4.5h5v5h-5zM14.5 4.5h5v5h-5zM4.5 14.5h5v5h-5z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15h1.5v1.5H18V18h1.5M15 18h1.5v1.5M18 13.5V15h1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
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
  const [channelsDrawerOpen, setChannelsDrawerOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
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

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    Promise.all([api.getSpaceMe(controller.signal), api.getUserMe(controller.signal)])
      .then(async ([spaceInfo, meInfo]) => {
        const prefRows = meInfo.has_password ? await api.getNotificationPrefs(controller.signal) : [];
        setSpace(spaceInfo);
        setMe(meInfo);
        setPrefs(mapPrefs(prefRows));
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
      setPasswordReminderOpen(true);
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
    setAuthSheetChannel(null);
    setAuthTarget("");
    setAuthCode("");
    setAuthPending(false);
    setAuthCooldown(0);
    setAuthExpiresIn(0);
    setAuthActionState("idle");
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
      });
      const nextPref = {
        enabled: updated.enabled,
        threshold: updated.offline_threshold_minutes,
        hideMessageContent: updated.hide_message_content,
        hiddenDirectMessageText: updated.hidden_direct_message_text ?? "",
        hiddenGroupMessageText: updated.hidden_group_message_text ?? "",
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
    setBasicEditField(field);
    setBasicEditValue(field === "name" ? session?.user.name ?? "" : me?.welcome_message ?? session?.user?.welcome_message ?? "");
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
      setPasswordReminderOpen(true);
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
              {space?.name ? <span className="menu-space-slug">@{space.name}</span> : null}
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
              setPasswordReminderOpen(true);
              return;
            }
            navigate("/app/settings/contacts?channel=email");
          }}
          verified={Boolean(session?.user?.verified)}
        />

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
                <div className="row-subtle">Email、SMS、Bark 认证与绑定</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {channelRows.map(([channel, _value, label]) =>
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
          </div>
        </div>
      </SideDrawer>

      <SideDrawer description="管理各通知渠道的认证状态" open={channelsDrawerOpen} onClose={() => setChannelsDrawerOpen(false)} title="通知渠道">
        <div className="detail-list">
          <div className="simple-list">
            {channelRows.map(([channel, _value, label]) => {
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

      <BottomSheet
        bodyClassName="contact-sheet-body"
        className="contact-bottom-sheet"
        open={Boolean(authSheetChannel)}
        title={authSheetChannel === "email" ? "认证邮箱" : authSheetChannel ? `绑定 ${channelLabel(authSheetChannel)}` : "通知渠道认证"}
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
              placeholder={authSheetChannel === "email" ? "you@sermo.space" : authSheetChannel === "sms" ? "输入手机号" : "输入 Bark 地址"}
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
        description="设置密码后，才能绑定通知渠道或管理通知提醒。"
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
