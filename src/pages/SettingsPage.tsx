import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AppViewState, NotificationChannel, NotificationPreferenceDTO, NotificationPreferences } from "../types";

const channels: Array<[NotificationChannel, number, string, string]> = [
  ["email", 1, "Email", "邮件提醒，适合正式通知"],
  ["sms", 2, "SMS", "短信提醒，成本更高但到达更直接"],
  ["bark", 3, "Bark", "针对即时推送场景"],
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

  const accountLevelLabel = useMemo(() => (session?.user ? "Basic / Verified 由后端验证状态决定" : "未登录"), [session]);

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
    } catch (apiError) {
      setError(apiError instanceof ApiError ? apiError.message : "绑定联系方式失败");
    }
  };

  return (
    <AppChrome mobileNav="settings">
      <section className="settings-shell">
        <aside className="panel settings-sidebar">
          <p className="eyebrow">Settings</p>
          <h2 className="panel-title">设置中心</h2>
          <div className="settings-list" style={{ marginTop: 18 }}>
            <Link className={`settings-nav-item ${tab === "account" ? "active" : ""}`} to="/app/settings/account">
              <span>
                <strong>账号升级</strong>
                <div className="detail-text">Basic / Verified 身份、邮箱验证</div>
              </span>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className={`settings-nav-item ${tab === "notifications" ? "active" : ""}`} to="/app/settings/notifications">
              <span>
                <strong>通知偏好</strong>
                <div className="detail-text">渠道级开关与离线阈值</div>
              </span>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className={`settings-nav-item ${tab === "contacts" ? "active" : ""}`} to="/app/settings/contacts">
              <span>
                <strong>联系方式绑定</strong>
                <div className="detail-text">Email / SMS / Bark</div>
              </span>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </aside>

        <div className="settings-list">
          {error ? <div className="alert">{error}</div> : null}
          {successMessage ? <div className="inline-note">{successMessage}</div> : null}

          {tab === "account" ? (
            <section className="settings-card upgrade-card">
              <div className="upgrade-hero">
                <p className="eyebrow" style={{ color: "rgba(255,255,255,.76)" }}>
                  Current Identity
                </p>
                <h3 className="settings-headline" style={{ color: "white" }}>
                  {session?.user?.name ?? "Sermo User"}
                </h3>
                <p style={{ margin: "8px 0 0", maxWidth: "32rem", lineHeight: 1.6 }}>
                  当前登录 user_id: {session?.user?.user_id ?? "N/A"}。升级流程已经接到 `/users/me/email-code` 与 `/users/me/verify-email`。
                </p>
              </div>
              <div className="upgrade-body">
                <div className="detail-list">
                  <div className="detail-card">
                    <div className="detail-row">
                      <div>
                        <strong>当前等级</strong>
                        <div className="detail-text">{accountLevelLabel}</div>
                      </div>
                      <span className="small-badge">{session?.user?.user_id ? "AUTHED" : "GUEST"}</span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div>
                      <label className="field-label">验证邮箱</label>
                      <input className="input" placeholder="you@sermo.space" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="field-label">验证码</label>
                      <input className="input" value={emailCode} onChange={(event) => setEmailCode(event.target.value)} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="field-label">设置密码</label>
                      <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    </div>
                    <div className="button-row" style={{ marginTop: 14 }}>
                      <button className="ghost-button" onClick={() => void sendEmailCode()} type="button">
                        发送验证码
                      </button>
                      <button className="button" onClick={() => void verifyEmail()} type="button">
                        验证并升级
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "notifications" ? (
            <section className="settings-card">
              <div className="settings-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <p className="eyebrow">Notifications</p>
                <h3 className="settings-headline">通知偏好</h3>
                <p className="card-subtitle">每个渠道独立配置启用状态和离线阈值；现在直接写入真实后端。</p>
              </div>
              {viewState === "loading" ? <div className="empty-state" style={{ marginTop: 18 }}>通知偏好加载中...</div> : null}
              <div className="pref-grid" style={{ paddingTop: 18 }}>
                {channels.map(([channel, _value, label, desc]) => {
                  const pref = prefs[channel];
                  return (
                    <div key={channel} className="detail-card">
                      <div className="channel-row">
                        <div>
                          <strong>{label}</strong>
                          <div className="detail-text">{desc}</div>
                        </div>
                        <button
                          aria-label={`toggle-${channel}`}
                          className={`switch ${pref.enabled ? "active" : ""}`}
                          onClick={() => void syncPref(channel, { enabled: pref.enabled ? 0 : 1 })}
                          type="button"
                        />
                      </div>
                      <div className="threshold-row" style={{ marginTop: 14 }}>
                        <div>
                          <strong>离线阈值</strong>
                          <div className="detail-text">超过该分钟数仍未在线时触发</div>
                        </div>
                        <div className="stepper">
                          <button onClick={() => void syncPref(channel, { offline_threshold_minutes: Math.max(1, pref.threshold - 1) })} type="button">
                            −
                          </button>
                          <input className="stepper-input mono" readOnly value={pref.threshold} />
                          <button onClick={() => void syncPref(channel, { offline_threshold_minutes: pref.threshold + 1 })} type="button">
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {tab === "contacts" ? (
            <section className="settings-card">
              <div className="settings-header" style={{ padding: 0, borderBottom: "1px solid rgba(232,235,242,.9)" }}>
                <p className="eyebrow">Contacts</p>
                <h3 className="settings-headline">联系方式绑定</h3>
                <p className="card-subtitle">后端当前不返回已绑定目标值，所以这里以操作流为主，展示真实发送和绑定动作。</p>
              </div>

              <div className="detail-card" style={{ marginTop: 18 }}>
                <div>
                  <label className="field-label">渠道</label>
                  <select className="select" value={contactChannel} onChange={(event) => setContactChannel(event.target.value as NotificationChannel)}>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="bark">Bark</option>
                  </select>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label className="field-label">目标地址</label>
                  <input className="input" value={contactTarget} onChange={(event) => setContactTarget(event.target.value)} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <label className="field-label">验证码</label>
                  <input className="input" value={contactCode} onChange={(event) => setContactCode(event.target.value)} />
                </div>
                <div className="button-row" style={{ marginTop: 14 }}>
                  <button className="ghost-button" onClick={() => void sendContactCode()} type="button">
                    发送验证码
                  </button>
                  <button className="button" onClick={() => void bindContact()} type="button">
                    绑定联系方式
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </AppChrome>
  );
}
