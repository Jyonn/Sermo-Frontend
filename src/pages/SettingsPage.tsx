import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AppViewState, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences } from "../types";

const channels: Array<[NotificationChannel, number, string]> = [
  ["email", 1, "Email"],
  ["sms", 2, "SMS"],
  ["bark", 3, "Bark"],
];

const emptyPrefs: NotificationPreferences = {
  email: { enabled: false, threshold: 30 },
  sms: { enabled: false, threshold: 15 },
  bark: { enabled: false, threshold: 5 },
};

function mapPrefs(rows: NotificationPreferenceDTO[]): NotificationPreferences {
  const next = { ...emptyPrefs };
  rows.forEach((row) => {
    const channel = row.channel === 1 ? "email" : row.channel === 2 ? "sms" : "bark";
    next[channel] = {
      enabled: row.enabled,
      threshold: row.offline_threshold_minutes,
    };
  });
  return next;
}

export default function SettingsPage() {
  const location = useLocation();
  const { session } = useAuth();
  const pathname = location.pathname;
  const tab = pathname.split("/").pop() ?? "account";
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(emptyPrefs);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [password, setPassword] = useState("");
  const [contactTarget, setContactTarget] = useState("");
  const [contactCode, setContactCode] = useState("");
  const [contactChannel, setContactChannel] = useState<NotificationChannel>("email");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<Record<NotificationChannel, "idle" | "pending" | "verified">>({
    email: "idle",
    sms: "idle",
    bark: "idle",
  });
  const [accountSheet, setAccountSheet] = useState<"code" | "verify" | null>(null);
  const [prefSheetChannel, setPrefSheetChannel] = useState<NotificationChannel | null>(null);
  const [contactSheetChannel, setContactSheetChannel] = useState<NotificationChannel | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    api
      .getNotificationPrefs(controller.signal)
      .then((rows) => {
        setPrefs(mapPrefs(rows));
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "加载设置失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, []);

  const accountLevelLabel = useMemo(() => (session?.user ? "Basic" : "未登录"), [session]);

  const syncPref = async (channel: NotificationChannel, patch: { enabled?: 0 | 1; offline_threshold_minutes?: number }) => {
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
        },
      }));
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "更新通知偏好失败";
      setError(message);
    }
  };

  const sendEmailCode = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      await api.sendVerifyEmailCode(email.trim().toLowerCase());
      setSuccessMessage("邮箱验证码已发送。");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "发送验证码失败");
    }
  };

  const verifyEmail = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      await api.verifyEmail({
        email: email.trim().toLowerCase(),
        code: emailCode.trim(),
        password: password.trim(),
      });
      setSuccessMessage("邮箱验证成功，账号已升级。");
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "邮箱验证失败");
    }
  };

  const sendContactCode = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const channel = contactChannel === "email" ? 1 : contactChannel === "sms" ? 2 : 3;
      await api.sendContactCode({ channel, target: contactTarget.trim() });
      setSuccessMessage("联系方式验证码已发送。");
      setContactStatus((current) => ({ ...current, [contactChannel]: "pending" }));
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "发送联系方式验证码失败");
    }
  };

  const bindContact = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const channel = contactChannel === "email" ? 1 : contactChannel === "sms" ? 2 : 3;
      await api.bindContact({ channel, target: contactTarget.trim(), code: contactCode.trim() });
      setSuccessMessage("联系方式绑定成功。");
      setContactStatus((current) => ({ ...current, [contactChannel]: "verified" }));
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "绑定联系方式失败");
    }
  };

  return (
    <AppChrome title="设置" mobileNav="menu" hideTopbar>
      <section className="page-stack">
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
        </div>

        {successMessage ? <div className="inline-note success-note">{successMessage}</div> : null}

        {tab === "account" ? (
          <section className="list-section">
            <div className="simple-list">
              <div className="simple-row form-row">
                <div className="row-main">
                  <strong>当前状态</strong>
                  <div className="row-subtle">{accountLevelLabel}</div>
                </div>
                <span className="count-badge">{session?.user?.user_id ? "已登录" : "访客"}</span>
              </div>
            </div>
            <div className="simple-form">
              <label className="field-label">验证邮箱</label>
              <input className="input" placeholder="you@sermo.space" value={email} onChange={(event) => setEmail(event.target.value)} />
              <label className="field-label">验证码</label>
              <input className="input" value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
              <label className="field-label">设置密码</label>
              <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <div className="button-row">
                <button className="ghost-button" onClick={() => void sendEmailCode()} type="button">
                  发送验证码
                </button>
                <button className="button" onClick={() => void verifyEmail()} type="button">
                  验证并升级
                </button>
              </div>
              <div className="mobile-inline-actions">
                <button className="ghost-button" onClick={() => setAccountSheet("code")} type="button">
                  发送验证码
                </button>
                <button className="button" onClick={() => setAccountSheet("verify")} type="button">
                  输入验证码
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "notifications" ? (
          <section className="list-section">
            {viewState === "loading" ? <FeedbackState title="通知设置加载中" description="正在同步各渠道设置。" tone="loading" /> : null}
            <div className="simple-list">
              {channels.map(([channel, _value, label]) => {
                const pref = prefs[channel];
                return (
                  <div key={channel} className="simple-row form-row">
                    <div className="row-main">
                      <strong>{label}</strong>
                      <div className="row-subtle">{pref.enabled ? `${pref.threshold} 分钟后提醒` : "已关闭"}</div>
                    </div>
                    <button className="ghost-button row-button desktop-pane" onClick={() => setPrefSheetChannel(channel)} type="button">
                      调整
                    </button>
                    <button className="icon-button row-trailing-button mobile-only-action" onClick={() => setPrefSheetChannel(channel)} type="button">
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
              {channels.map(([channel, _value, label]) => (
                <div key={channel} className="simple-row form-row">
                  <div className="row-main">
                    <strong>{label}</strong>
                    <div className="row-subtle">
                      {contactStatus[channel] === "verified" ? "已绑定" : contactStatus[channel] === "pending" ? "待验证" : "未绑定"}
                    </div>
                  </div>
                  <button className="ghost-button row-button desktop-pane" onClick={() => { setContactChannel(channel); setContactSheetChannel(channel); }} type="button">
                    管理
                  </button>
                  <button
                    className="icon-button row-trailing-button mobile-only-action"
                    onClick={() => {
                      setContactChannel(channel);
                      setContactSheetChannel(channel);
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

      <BottomSheet open={accountSheet === "code"} title="发送验证码" description="先确认邮箱" onClose={() => setAccountSheet(null)}>
        <div className="simple-form">
          <label className="field-label">验证邮箱</label>
          <input className="input" placeholder="you@sermo.space" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="button" onClick={() => void sendEmailCode()} type="button">
            发送验证码
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={accountSheet === "verify"} title="验证账号" description="输入验证码并升级" onClose={() => setAccountSheet(null)}>
        <div className="simple-form">
          <label className="field-label">验证码</label>
          <input className="input" value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
          <label className="field-label">设置密码</label>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="button" onClick={() => void verifyEmail()} type="button">
            验证并升级
          </button>
        </div>
      </BottomSheet>

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
              </div>
              <button
                aria-label={`toggle-${prefSheetChannel}`}
                className={`switch ${prefs[prefSheetChannel].enabled ? "active" : ""}`}
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
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(contactSheetChannel)}
        title={contactSheetChannel ? `绑定 ${contactSheetChannel.toUpperCase()}` : "绑定联系方式"}
        description="发送验证码后完成绑定"
        onClose={() => setContactSheetChannel(null)}
      >
        {contactSheetChannel ? (
          <div className="simple-form">
            <label className="field-label">目标地址</label>
            <input className="input" value={contactTarget} onChange={(event) => setContactTarget(event.target.value)} />
            <label className="field-label">验证码</label>
            <input className="input" value={contactCode} onChange={(event) => setContactCode(event.target.value)} />
            <div className="button-row">
              <button className="ghost-button" onClick={() => void sendContactCode()} type="button">
                发送验证码
              </button>
              <button className="button" onClick={() => void bindContact()} type="button">
                确认绑定
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
