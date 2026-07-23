import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { AvatarUploadError, uploadCustomAvatar } from "../lib/avatarUpload";
import { useAuth } from "../lib/auth";
import { buildTabCacheScope, readTabCache, writeTabCache } from "../lib/tabCache";
import type { AppViewState, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences } from "../types";

const channels: Array<[NotificationChannel, number, string]> = [
  ["email", 1, "邮件"],
  ["sms", 2, "短信"],
  ["bark", 3, "即时"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
  sms: { enabled: false, threshold: 15, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
  bark: { enabled: false, threshold: 5, hideMessageContent: false, hiddenDirectMessageTitle: "", hiddenDirectMessageText: "", hiddenGroupMessageTitle: "", hiddenGroupMessageText: "", friendOnlineMessageTitle: "", friendOnlineMessageText: "", openChatOnTap: true },
};

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

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, patchSessionUser } = useAuth();
  const pathname = location.pathname;
  const tab = pathname.split("/").pop() ?? "account";
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(emptyPrefs);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [contactTarget, setContactTarget] = useState("");
  const [contactCode, setContactCode] = useState("");
  const [contactChannel, setContactChannel] = useState<NotificationChannel>("email");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [contactActionState, setContactActionState] = useState<"idle" | "sending-code" | "binding">("idle");
  const [pendingContactState, setPendingContactState] = useState<Record<NotificationChannel, boolean>>({
    email: false,
    sms: false,
    bark: false,
  });
  const [contactCooldowns, setContactCooldowns] = useState<Record<NotificationChannel, number>>({
    email: 0,
    sms: 0,
    bark: 0,
  });
  const [contactExpiresIn, setContactExpiresIn] = useState<Record<NotificationChannel, number>>({
    email: 0,
    sms: 0,
    bark: 0,
  });
  const [prefSheetChannel, setPrefSheetChannel] = useState<NotificationChannel | null>(null);
  const [contactSheetChannel, setContactSheetChannel] = useState<NotificationChannel | null>(null);
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const contactVerifyBlockRef = useRef<HTMLDivElement | null>(null);
  const contactSheetBodyRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const isAppleEnvironment = useMemo(() => detectAppleEnvironment(), []);
  const visibleChannels = useMemo(
    () => channels.filter(([channel]) => channel !== "bark" || isAppleEnvironment),
    [isAppleEnvironment]
  );
  const cacheScope = buildTabCacheScope(session?.user.space_id, session?.user.user_id);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readTabCache<NotificationPreferences>(cacheScope, "settings:notifications");
    if (cached) {
      setPrefs(cached.data);
      setViewState("ready");
    } else {
      setViewState("loading");
    }
    setSyncing(true);
    setError(null);

    api
      .getNotificationPrefs(controller.signal)
      .then((rows) => {
        const nextPrefs = mapPrefs(rows);
        setPrefs(nextPrefs);
        writeTabCache(cacheScope, "settings:notifications", nextPrefs);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        if (!cached) {
          const message = apiError instanceof ApiError ? apiError.message : "加载设置失败";
          setError(message);
          setViewState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, [cacheScope]);

  useEffect(() => {
    if (viewState === "ready") writeTabCache(cacheScope, "settings:notifications", prefs);
  }, [cacheScope, prefs, viewState]);

  useEffect(() => {
    const controller = new AbortController();

    api
      .getWelcomeMessage(controller.signal)
      .then((payload) => {
        setWelcomeMessage(payload.welcome_message ?? "");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载欢迎语失败";
        setError((current) => current ?? message);
      });

    return () => controller.abort();
  }, []);

  const accountLevelLabel = useMemo(() => {
    if (!session?.user) return "未登录";
    return session.user.verified ? "Verified" : "Basic";
  }, [session]);
  const emailVerified = Boolean(session?.user?.email_verified_at);
  const hasPassword = Boolean(session?.user?.has_password);
  const phoneVerified = Boolean(session?.user?.phone_verified_at);
  const barkVerified = Boolean(session?.user?.bark_verified_at);
  const emailTarget = session?.user?.email ?? "";
  const phoneTarget = session?.user?.phone ?? "";
  const barkTarget = session?.user?.bark ?? "";

  const contactMeta = useMemo(
    () => ({
      email: {
        verified: emailVerified,
        target: emailTarget,
        title: "认证邮箱",
        description: emailVerified ? "已完成邮箱认证，账号已升级。" : "认证邮箱后，你的账号会升级为 Verified。",
      },
      sms: {
        verified: phoneVerified,
        target: phoneTarget,
        title: "短信通知",
        description: phoneVerified ? "已绑定短信接收。" : "绑定手机号后可接收短信通知。",
      },
      bark: {
        verified: barkVerified,
        target: barkTarget,
        title: "即时提醒",
        description: barkVerified ? "已绑定即时推送。" : "绑定后可接收即时推送提醒。",
      },
    }),
    [barkTarget, barkVerified, emailTarget, emailVerified, phoneTarget, phoneVerified]
  );

  useEffect(() => {
    if (tab !== "contacts") return;
    const channel = new URLSearchParams(location.search).get("channel");
    if (channel === "email" || channel === "sms" || (channel === "bark" && isAppleEnvironment)) {
      setContactChannel(channel);
      setContactSheetChannel(channel);
      setContactTarget(contactMeta[channel].target);
      setContactCode("");
    }
  }, [contactMeta, isAppleEnvironment, location.search, tab]);

  const openEmailVerificationFlow = () => {
    if (!hasPassword) {
      setPasswordReminderOpen(true);
      return;
    }

    setContactChannel("email");
    setContactSheetChannel("email");
    setContactTarget(contactMeta.email.target);
    setContactCode("");
    if (tab !== "contacts" || location.search !== "?channel=email") {
      navigate("/app/settings/contacts?channel=email");
    }
  };

  useEffect(() => {
    const hasCooldown = Object.values(contactCooldowns).some((value) => value > 0);
    const hasExpires = Object.values(contactExpiresIn).some((value) => value > 0);
    if (!hasCooldown && !hasExpires) return;

    const timer = window.setInterval(() => {
      setContactCooldowns((current) => ({
        email: Math.max(0, current.email - 1),
        sms: Math.max(0, current.sms - 1),
        bark: Math.max(0, current.bark - 1),
      }));
      setContactExpiresIn((current) => ({
        email: Math.max(0, current.email - 1),
        sms: Math.max(0, current.sms - 1),
        bark: Math.max(0, current.bark - 1),
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [contactCooldowns, contactExpiresIn]);

  useEffect(() => {
    if (!contactSheetChannel || !pendingContactState[contactSheetChannel]) return;
    requestAnimationFrame(() => {
      const body = contactSheetBodyRef.current;
      if (body) {
        body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      } else {
        contactVerifyBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  }, [contactSheetChannel, pendingContactState]);

  const syncPref = async (
    channel: NotificationChannel,
    patch: {
      enabled?: 0 | 1;
      offline_threshold_minutes?: number;
      hide_message_content?: 0 | 1;
      hidden_direct_message_text?: string;
      hidden_group_message_text?: string;
      open_chat_on_tap?: 0 | 1;
    }
  ) => {
    setError(null);
    try {
      const mappedChannel = channel === "email" ? 1 : channel === "sms" ? 2 : 3;
      const updated = await api.updateNotificationPref({
        channel: mappedChannel,
        ...patch,
      });
      setPrefs((current) => ({
        ...current,
        [channel]: {
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
        },
      }));
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "更新通知偏好失败";
      setError(message);
    }
  };

  const updatePrefDraft = (
    channel: NotificationChannel,
    patch: Partial<NotificationPreferences[NotificationChannel]>
  ) => {
    setPrefs((current) => ({
      ...current,
      [channel]: {
        ...current[channel],
        ...patch,
      },
    }));
  };

  const syncHiddenMessageTexts = async (channel: NotificationChannel) => {
    const pref = prefs[channel];
    await syncPref(channel, {
      hidden_direct_message_text: pref.hiddenDirectMessageText.trim(),
      hidden_group_message_text: pref.hiddenGroupMessageText.trim(),
    });
  };

  const sendContactCode = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      setContactActionState("sending-code");
      const channel = contactChannel === "email" ? 1 : contactChannel === "sms" ? 2 : 3;
      const normalizedTarget = contactChannel === "email" ? contactTarget.trim().toLowerCase() : contactTarget.trim();
      const payload = await api.sendContactCode({ channel, target: normalizedTarget });
      setPendingContactState((current) => ({ ...current, [contactChannel]: true }));
      setContactCooldowns((current) => ({ ...current, [contactChannel]: 60 }));
      setContactExpiresIn((current) => ({ ...current, [contactChannel]: payload.expires_in }));
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "发送联系方式验证码失败");
    } finally {
      setContactActionState("idle");
    }
  };

  const bindContact = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      setContactActionState("binding");
      const channel = contactChannel === "email" ? 1 : contactChannel === "sms" ? 2 : 3;
      const normalizedTarget = contactChannel === "email" ? contactTarget.trim().toLowerCase() : contactTarget.trim();
      const me = await api.bindContact({ channel, target: normalizedTarget, code: contactCode.trim() });
      patchSessionUser({
        verified: me.verified,
        language: me.language,
        welcome_message: me.welcome_message,
        email: me.email,
        phone: me.phone,
        bark: me.bark,
        last_heartbeat: me.last_heartbeat,
        email_verified_at: me.email_verified_at,
        phone_verified_at: me.phone_verified_at,
        bark_verified_at: me.bark_verified_at,
      });
      if (contactChannel === "email") {
        const rows = await api.getNotificationPrefs();
        setPrefs(mapPrefs(rows));
      }
      setSuccessMessage(contactChannel === "email" ? "邮箱认证成功，账号已升级。" : "联系方式绑定成功。");
      setPendingContactState((current) => ({ ...current, [contactChannel]: false }));
      setContactExpiresIn((current) => ({ ...current, [contactChannel]: 0 }));
      setContactCode("");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "绑定联系方式失败");
    } finally {
      setContactActionState("idle");
    }
  };

  const savePresetAvatar = async (presetId: number) => {
    setError(null);
    try {
      setAvatarSaving(true);
      const payload = await api.setPresetAvatar(presetId);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setSuccessMessage("头像已更新。");
      setAvatarDialogOpen(false);
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "头像更新失败");
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

    setError(null);
    try {
      setAvatarSaving(true);
      const payload = await uploadCustomAvatar(file);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setSuccessMessage("自定义头像已更新。");
      setAvatarDialogOpen(false);
    } catch (uploadError) {
      if (uploadError instanceof AvatarUploadError || uploadError instanceof ApiError) {
        setError(uploadError.message);
      } else {
        setError("头像上传失败");
      }
    } finally {
      setAvatarSaving(false);
    }
  };

  const saveWelcomeMessage = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      setWelcomeSaving(true);
      const payload = await api.updateWelcomeMessage(welcomeMessage.trim());
      setWelcomeMessage(payload.welcome_message ?? "");
      setSuccessMessage("欢迎语已更新。");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "欢迎语保存失败");
    } finally {
      setWelcomeSaving(false);
    }
  };

  return (
    <AppChrome title="设置" hideTopbar>
      <section className="page-stack">
        <div className="settings-back-row">
          <Link className="ghost-button settings-back-button" to="/app/menu">
            <span className="material-symbols-outlined">arrow_back</span>
            返回菜单
          </Link>
        </div>
        <div className="page-tabs">
          <Link className={`tab-chip ${tab === "account" ? "active" : ""}`} to="/app/settings/account">
            账号
          </Link>
          <Link className={`tab-chip ${tab === "notifications" ? "active" : ""}`} to="/app/settings/notifications">
            通知
          </Link>
          <Link className={`tab-chip ${tab === "contacts" ? "active" : ""}`} to="/app/settings/contacts">
            联系方式
          </Link>
          <HeaderSyncIndicator syncing={syncing} />
        </div>

        {successMessage ? <div className="inline-note success-note">{successMessage}</div> : null}

        {tab === "account" ? (
          <section className="list-section">
            <div className="simple-list">
              <div className="simple-row form-row">
                <div className="row-main">
                  <strong>头像</strong>
                  <div className="row-subtle">支持预设头像和自定义图片上传</div>
                </div>
                <div className="settings-avatar-inline">
                  <UserAvatar className="mini-avatar" name={session?.user.name ?? "言浪用户"} uri={session?.user.avatar_uri} />
                  <button className="ghost-button row-button" onClick={() => setAvatarDialogOpen(true)} type="button">
                    更换
                  </button>
                </div>
              </div>
              <div className="simple-row form-row">
                <div className="row-main">
                  <strong>当前身份</strong>
                  <div className="row-subtle">{session?.user?.verified ? "已完成邮箱认证" : "完成邮箱认证后可添加好友、创建群聊"}</div>
                </div>
                <span className={`small-badge ${session?.user?.verified ? "" : "route-chip"}`}>{accountLevelLabel}</span>
              </div>
            </div>
            <div className="simple-form">
              <label className="field-label">欢迎语</label>
              <textarea
                className="textarea"
                placeholder="好友通过后，将自动发送这段欢迎语。"
                rows={4}
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
              />
              <div className="button-row">
                <button className="button" disabled={welcomeSaving} onClick={() => void saveWelcomeMessage()} type="button">
                  {welcomeSaving ? "保存中..." : "保存欢迎语"}
                </button>
              </div>
              {!session?.user?.verified ? (
                <div className="inline-note">
                  认证邮箱后，你的账号会升级为 Verified。
                  <button
                    className="ghost-button inline-link-button"
                    onClick={openEmailVerificationFlow}
                    type="button"
                  >
                    去认证邮箱
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "notifications" ? (
          <section className="list-section">
            <div className="simple-list">
              {visibleChannels.map(([channel, _value, label]) => {
                const pref = prefs[channel];
                const requiresEmailVerification = channel === "email" && !emailVerified;
                return (
                  <div key={channel} className="simple-row form-row">
                    <div className="row-main">
                      <strong>{label}</strong>
                      <div className="row-subtle">
                        {requiresEmailVerification
                          ? "需先认证邮箱"
                          : pref.enabled
                            ? `${pref.threshold} 分钟后提醒${pref.hideMessageContent ? " · 不显示消息内容" : ""}`
                            : "已关闭"}
                      </div>
                    </div>
                    <button
                      className="ghost-button row-button desktop-pane"
                      onClick={() => (requiresEmailVerification ? openEmailVerificationFlow() : setPrefSheetChannel(channel))}
                      type="button"
                    >
                      调整
                    </button>
                    <button
                      className="icon-button row-trailing-button mobile-only-action"
                      onClick={() => (requiresEmailVerification ? openEmailVerificationFlow() : setPrefSheetChannel(channel))}
                      type="button"
                    >
                      <span className="material-symbols-outlined">tune</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "contacts" ? (
          <section className="list-section">
            <div className="simple-list">
              {visibleChannels.map(([channel, _value, label]) => (
                <div key={channel} className="simple-row form-row">
                  <div className="row-main">
                    <strong>{contactMeta[channel].title}</strong>
                    <div className="row-subtle">
                      {contactMeta[channel].verified
                        ? contactMeta[channel].target || contactMeta[channel].description
                        : pendingContactState[channel]
                          ? "验证码已发送，等待确认"
                          : contactMeta[channel].description}
                    </div>
                  </div>
                  <button
                    className="ghost-button row-button desktop-pane"
                    onClick={() => {
                      setContactChannel(channel);
                      setContactTarget(contactMeta[channel].target);
                      setContactCode("");
                      setPendingContactState((current) => ({ ...current, [channel]: false }));
                      setContactSheetChannel(channel);
                    }}
                    type="button"
                  >
                    管理
                  </button>
                  <button
                    className="icon-button row-trailing-button mobile-only-action"
                    onClick={() => {
                      setContactChannel(channel);
                      setContactSheetChannel(channel);
                      setContactTarget(contactMeta[channel].target);
                      setContactCode("");
                      setPendingContactState((current) => ({ ...current, [channel]: false }));
                    }}
                    type="button"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <BottomSheet
        open={Boolean(prefSheetChannel)}
        title={prefSheetChannel ? `${prefSheetChannel.toUpperCase()} 提醒` : "提醒"}
        description="调整提醒方式"
        onClose={() => setPrefSheetChannel(null)}
      >
        {prefSheetChannel ? (
          <div className="simple-form">
            <div className="simple-row form-row">
              <div className="row-main">
                <strong>启用提醒</strong>
                {prefSheetChannel === "sms" ? <div className="row-subtle">暂不支持</div> : null}
              </div>
              <button
                aria-label={`toggle-${prefSheetChannel}`}
                className={`switch ${prefSheetChannel !== "sms" && prefs[prefSheetChannel].enabled ? "active" : ""}`}
                disabled={prefSheetChannel === "sms"}
                onClick={() => void syncPref(prefSheetChannel, { enabled: prefs[prefSheetChannel].enabled ? 0 : 1 })}
                type="button"
              />
            </div>
            <div className="simple-row form-row">
              <div className="row-main">
                <strong>离线阈值</strong>
                <div className="row-subtle">{prefs[prefSheetChannel].threshold} 分钟</div>
              </div>
              <div className="stepper">
                <button
                  onClick={() =>
                    void syncPref(prefSheetChannel, {
                      offline_threshold_minutes: Math.max(1, prefs[prefSheetChannel].threshold - 1),
                    })
                  }
                  type="button"
                >
                  −
                </button>
                <input className="stepper-input mono" readOnly value={prefs[prefSheetChannel].threshold} />
                <button
                  onClick={() =>
                    void syncPref(prefSheetChannel, {
                      offline_threshold_minutes: prefs[prefSheetChannel].threshold + 1,
                    })
                  }
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
            {prefSheetChannel === "email" || prefSheetChannel === "bark" ? (
              <>
                {prefSheetChannel === "bark" ? (
                  <div className="simple-row form-row">
                    <div className="row-main">
                      <strong>点击打开聊天</strong>
                      <div className="row-subtle">点通知进入对应会话。</div>
                    </div>
                    <button
                      aria-label="toggle-bark-open-chat"
                      className={`switch ${prefs[prefSheetChannel].openChatOnTap ? "active" : ""}`}
                      onClick={() =>
                        void syncPref(prefSheetChannel, {
                          open_chat_on_tap: prefs[prefSheetChannel].openChatOnTap ? 0 : 1,
                        })
                      }
                      type="button"
                    />
                  </div>
                ) : null}
                <div className="simple-row form-row">
                  <div className="row-main">
                    <strong>隐藏消息内容</strong>
                    <div className="row-subtle">
                      开启后，只提示你收到新消息，不展示具体内容。
                    </div>
                  </div>
                  <button
                    aria-label={`toggle-hide-content-${prefSheetChannel}`}
                    className={`switch ${prefs[prefSheetChannel].hideMessageContent ? "active" : ""}`}
                    onClick={() =>
                      void syncPref(prefSheetChannel, {
                        hide_message_content: prefs[prefSheetChannel].hideMessageContent ? 0 : 1,
                      })
                    }
                    type="button"
                  />
                </div>
                {prefs[prefSheetChannel].hideMessageContent ? (
                  <div className="simple-form notification-custom-message-fields">
                    <div>
                      <label className="field-label">私聊消息提示</label>
                      <input
                        className="input"
                        maxLength={255}
                        placeholder="留空则使用默认：你收到了一条新的私聊消息。"
                        value={prefs[prefSheetChannel].hiddenDirectMessageText}
                        onBlur={() => void syncHiddenMessageTexts(prefSheetChannel)}
                        onChange={(event) =>
                          updatePrefDraft(prefSheetChannel, {
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
                        placeholder="留空则使用默认：你收到了一条新的群聊消息。"
                        value={prefs[prefSheetChannel].hiddenGroupMessageText}
                        onBlur={() => void syncHiddenMessageTexts(prefSheetChannel)}
                        onChange={(event) =>
                          updatePrefDraft(prefSheetChannel, {
                            hiddenGroupMessageText: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(contactSheetChannel)}
        className="contact-bottom-sheet"
        bodyClassName="contact-sheet-body"
        title={
          contactSheetChannel
            ? contactSheetChannel === "email"
              ? "认证邮箱"
              : `绑定 ${contactSheetChannel.toUpperCase()}`
            : "绑定联系方式"
        }
        description={contactSheetChannel === "email" ? "认证邮箱后，账号会升级为 Verified。" : "发送验证码后完成绑定"}
        onClose={() => {
          if (contactSheetChannel) {
            setPendingContactState((current) => ({ ...current, [contactSheetChannel]: false }));
            setContactExpiresIn((current) => ({ ...current, [contactSheetChannel]: 0 }));
          }
          setContactCode("");
          setContactSheetChannel(null);
          if (location.search) navigate(pathname, { replace: true });
        }}
      >
        {contactSheetChannel ? (
          <div ref={contactSheetBodyRef} className="simple-form contact-sheet-form">
            <div className="field-label-row">
              <label className="field-label">{contactSheetChannel === "email" ? "邮箱地址" : "目标地址"}</label>
              {pendingContactState[contactSheetChannel] && contactExpiresIn[contactSheetChannel] > 0 ? (
                <span className="field-countdown">验证码还有 {contactExpiresIn[contactSheetChannel]} 秒有效</span>
              ) : null}
            </div>
            <input
              className="input"
              placeholder={
                contactSheetChannel === "email"
                  ? "you@sermo.space"
                  : contactSheetChannel === "sms"
                    ? "输入手机号"
                    : "输入即时推送地址"
              }
              value={contactTarget}
              onChange={(event) => {
                setContactTarget(event.target.value);
                setContactCode("");
                setPendingContactState((current) => ({ ...current, [contactSheetChannel]: false }));
                setContactExpiresIn((current) => ({ ...current, [contactSheetChannel]: 0 }));
              }}
            />
            <div className="contact-flow-actions">
              <button
                className="button contact-flow-primary"
                disabled={contactActionState === "sending-code" || !contactTarget.trim() || contactCooldowns[contactSheetChannel] > 0}
                onClick={() => void sendContactCode()}
                type="button"
              >
                {contactActionState === "sending-code"
                  ? "发送中..."
                  : contactCooldowns[contactSheetChannel] > 0
                    ? `${contactCooldowns[contactSheetChannel]} 秒后重试`
                    : "发送验证码"}
              </button>
            </div>
            <div
              ref={contactVerifyBlockRef}
              className={`contact-verify-block ${pendingContactState[contactSheetChannel] ? "is-visible" : ""}`}
            >
              <label className="field-label">验证码</label>
              <input className="input" value={contactCode} onChange={(event) => setContactCode(event.target.value)} />
              <div className="contact-flow-actions">
                <button
                  className="button contact-flow-primary"
                  disabled={contactActionState === "binding" || !contactCode.trim()}
                  onClick={() => void bindContact()}
                  type="button"
                >
                  {contactActionState === "binding"
                    ? "处理中..."
                    : contactSheetChannel === "email"
                      ? "确认认证"
                      : "确认绑定"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AvatarPresetDialog
        currentAvatarUri={session?.user.avatar_uri}
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
      <ConfirmDialog
        open={passwordReminderOpen}
        title="请先设置密码"
        description="设置密码后，才能继续认证邮箱并完成后续绑定。"
        confirmLabel="去设置"
        onClose={() => setPasswordReminderOpen(false)}
        onConfirm={() => {
          setPasswordReminderOpen(false);
          navigate("/app/menu?drawer=security");
        }}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
