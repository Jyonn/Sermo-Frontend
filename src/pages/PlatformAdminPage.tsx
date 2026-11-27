import QRCode from "qrcode";
import {ResourceWorkspace} from '../components/ResourceWorkspace';
import { useSearchParams } from "react-router-dom";
import { OAuthApplicationWorkspace } from "../components/OAuthApplicationWorkspace";
import { managementSection, platformManagementSections, type PlatformManagementSection } from "../lib/managementNavigation";
import { ManagementFilter, ManagementSearch, ManagementToolbar, ManagementWorkspace } from "../components/ManagementWorkspace";
import { FeedbackState } from "../components/FeedbackState";
import { useI18n, type TranslationKey } from "../lib/language";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { PermissionWorkspace } from "../components/PermissionWorkspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { usePlatformAdminAuth } from "../lib/platformAdminAuth";
import { copyText, formatRelativeTime } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { AppViewState, ChatDTO, ChatMessageDTO, PlatformAdminMemberDTO, PlatformAdminSpaceDTO, PlatformAuditDTO, PlatformDashboardDTO, PlatformEmailDeliveryDTO, PlatformEmailReviewDetailDTO, PlatformEmailReviewRecordDTO, PlatformEmailReviewStateDTO, PlatformMessageDeliveryAuditDTO, PlatformMessageDeliveryDTO } from "../types";
import { PlatformMemberPanel } from "../components/PlatformMemberPanel";
import { PlatformAuditConversation } from "../components/PlatformAuditConversation";
import { emailPreviewDocument } from "../lib/emailPreview";
import { PlatformSpaceFeatures } from "../components/PlatformSpaceFeatures";
import { PlatformActivityWorkspace } from "../components/PlatformActivityWorkspace";
import { spaceFeatureGrants, type SpaceFeatureKey } from "../lib/spaceFeatureGrants";
import "../styles/platform-inspection.css";

type Section = PlatformManagementSection;
const nav: Array<{ id: Section; icon: string; group: string; groupIcon: string }> = [
  { id: "overview", icon: "space_dashboard", group: "overview", groupIcon: "space_dashboard" },
  { id: "spaces", icon: "domain", group: "governance", groupIcon: "domain" },
  { id: "reviews", icon: "verified_user", group: "governance", groupIcon: "domain" },
  { id: "activities", icon: "event_repeat", group: "services", groupIcon: "extension" },
  { id: "oauth", icon: "apps", group: "services", groupIcon: "extension" },
  { id: "resources", icon: "perm_media", group: "services", groupIcon: "extension" },
  { id: "emails", icon: "mail", group: "services", groupIcon: "extension" },
  { id: "emailReview", icon: "mark_email_read", group: "services", groupIcon: "extension" },
  { id: "audit", icon: "policy", group: "observability", groupIcon: "monitor_heart" },
  { id: "debug", icon: "bug_report", group: "observability", groupIcon: "monitor_heart" },
  { id: "permissions", icon: "account_tree", group: "security", groupIcon: "shield_lock" },
  { id: "security", icon: "shield_lock", group: "security", groupIcon: "shield_lock" },
];

function time(value?: number | null) {
  return value ? formatRelativeTime(value) : "未发生";
}

function PlatformAdminLogin() {
  const { setSession } = usePlatformAdminAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "mfa">("email");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (step === "email") {
        const result = await api.sendPlatformAdminCode(email);
        setMasked(result.masked_email);
        if (result.mfa_required) {
          setStep("mfa");
        } else {
          setStep("code");
          showToast("验证码已发送");
        }
      } else {
        const result = await api.loginPlatformAdmin({ email, code, mfa_code: mfa || undefined });
        setSession({ accessToken: result.auth, email, mfaEnabled: result.mfa_enabled });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.identifier.includes("MFA_REQUIRED")) {
        setStep("mfa");
      } else {
        showToast(cause instanceof Error ? cause.message : "操作未完成", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return <main className="platform-login">
    <section className="platform-login-card">
      <div className="platform-brand"><img alt="" className="platform-brand-mark" src="/icons/frienden-512.png?v=2"/><div><small>FRIENDEN CONTROL</small><strong>平台审计台</strong></div></div>
      <div className="platform-login-copy"><span>受保护入口</span><h1>先确认是你</h1><p>{step === "email" ? "使用平台管理员邮箱继续。" : step === "code" ? `验证码已发送至 ${masked}` : `输入 ${masked} 绑定的验证器动态口令。`}</p></div>
      {step === "email" ? <input autoComplete="email" className="platform-field" onChange={(event) => setEmail(event.target.value)} placeholder="管理员邮箱" type="email" value={email} /> : null}
      {step === "code" ? <VerificationCodeInput ariaLabel="邮箱验证码" autoFocus value={code} onChange={setCode} /> : null}
      {step === "mfa" ? <div className="platform-mfa-login-field">
        {useRecoveryCode
          ? <input autoComplete="off" className="platform-field is-code" onChange={(event) => setMfa(event.target.value)} placeholder="输入恢复码" value={mfa} />
          : <VerificationCodeInput ariaLabel="动态口令" autoFocus value={mfa} onChange={setMfa} />}
        <button className="platform-text-button" onClick={() => { setUseRecoveryCode((current) => !current); setMfa(""); }} type="button">{useRecoveryCode ? "使用动态口令" : "使用恢复码"}</button>
      </div> : null}
      <button className="platform-primary" disabled={busy || (step === "email" ? !email : step === "code" ? code.length !== 6 : useRecoveryCode ? !mfa.trim() : mfa.length !== 6)} onClick={() => void submit()} type="button">{busy ? "正在验证" : step === "email" ? "发送验证码" : "进入审计台"}<span className="material-symbols-outlined">arrow_forward</span></button>
      {step !== "email" ? <button className="platform-text-button" onClick={() => { setStep("email"); setCode(""); setMfa(""); setUseRecoveryCode(false); }} type="button">更换邮箱</button> : null}
      <footer><span className="material-symbols-outlined">lock</span>所有敏感访问均记录审计日志</footer>
    </section>
  </main>;
}

function Metric({ icon, label, value, onOpen }: { icon: string; label: string; value: number; onOpen: () => void }) {
  const { locale } = useI18n();
  return <button className="platform-metric" onClick={onOpen} type="button">
    <span><span aria-hidden="true" className="material-symbols-outlined">{icon}</span>{label}</span>
    <strong>{value.toLocaleString(locale)}</strong>
    <span aria-hidden="true" className="management-metric-arrow material-symbols-outlined">arrow_forward</span>
  </button>;
}

function AuditList({ items }: { items: PlatformAuditDTO[] }) {
  return <div className="platform-audit-list">{items.map((item) => <article key={item.audit_id}><span className="platform-audit-dot" /><div><strong>{item.summary || item.action}</strong><small>{item.action} · {time(item.created_at)}{item.ip_address ? ` · ${item.ip_address}` : ""}</small></div></article>)}</div>;
}

const emailStatusLabels: Record<PlatformEmailDeliveryDTO["status"], TranslationKey> = {
  pending: "management.deliveryPending",
  processing: "management.deliveryProcessing",
  sent: "management.deliverySent",
  failed: "management.deliveryFailed",
  skipped: "management.deliverySkipped",
};
const emailEventLabel: Record<number, string> = { 1: "私聊消息", 2: "群聊消息", 3: "群聊邀请", 4: "系统通知", 5: "发言获赞", 6: "发言评论", 7: "评论获赞", 8: "评论回复", 9: "发言处理", 10: "评论提及" };

function EmailDeliveryList({ items }: { items: PlatformEmailDeliveryDTO[] }) {
  const { t, locale } = useI18n();
  return <div className="platform-email-list">{items.map((item) => <article className={`platform-email-row is-${item.status}`} key={item.delivery_id}>
    <span className="platform-email-icon material-symbols-outlined">mail</span>
    <div className="platform-email-copy"><div><strong>{item.user.name}</strong><span className={`platform-email-status is-${item.status}`}>{t(emailStatusLabels[item.status])}</span></div>{item.recipient && <p>{item.recipient}</p>}<small>{emailEventLabel[item.event_type] || item.event_kind || `#${item.event_id}`} · {item.space.name} @{item.space.slug}</small>{item.detail && item.status === "failed" ? <code>{item.detail}</code> : null}</div>
    <time dateTime={new Date((item.attempted_at || item.created_at) * 1000).toISOString()}><strong>{item.attempted_at ? new Date(item.attempted_at * 1000).toLocaleString(locale) : t("management.deliveryUnknownTime")}</strong><small>{time(item.attempted_at || item.created_at)}</small></time>
  </article>)}</div>;
}

function EmailReviewPanel({ busy, onOpen, onRefresh, onToggle, value }: {
  busy: boolean;
  onOpen: (record: PlatformEmailReviewRecordDTO) => void;
  onRefresh: () => void;
  onToggle: () => void;
  value: PlatformEmailReviewStateDTO | null;
}) {
  const { t, locale } = useI18n();
  const count = value?.captured_count ?? 0;
  const limit = value?.limit ?? 20;
  const active = Boolean(value?.enabled);
  const completed = Boolean(value?.completed_at && count >= limit);
  return <section className={`platform-email-review${active ? " is-active" : ""}`}>
    <header>
      <div><p>{t("management.emailReviewHint", { limit })}</p></div>
      <div className="platform-email-review-actions">
        <button aria-label={t("management.emailReviewRefresh")} title={t("management.emailReviewRefresh")} className="platform-email-review-refresh" disabled={busy} onClick={onRefresh} type="button"><span aria-hidden="true" className="material-symbols-outlined">refresh</span></button>
        <button className={active ? "is-stop" : "is-start"} disabled={busy || !value} onClick={onToggle} type="button">{t(busy ? "common.processing" : active ? "management.emailReviewStop" : count ? "management.emailReviewRestart" : "management.emailReviewStart")}</button>
      </div>
    </header>
    {value && <div className="platform-email-review-meter">
      <div><strong>{count}<small> / {limit}</small></strong><span>{t(active ? "management.emailReviewCapturing" : completed ? "management.emailReviewCompleted" : count ? "management.emailReviewStopped" : "management.emailReviewIdle", { remaining: value.remaining ?? limit })}</span></div>
      <progress aria-label={t("management.emailReview")} value={count} max={limit} />
      {value.started_at ? <time>{t("management.emailReviewStarted", { date: new Date(value.started_at * 1000).toLocaleString(locale) })}</time> : <small>{t("management.emailReviewReplace")}</small>}
    </div>}
    {value?.items.length ? <div className="platform-email-review-list">{value.items.map((item) => <button className={`is-${item.status}`} key={item.record_id} onClick={() => onOpen(item)} type="button">
      <span className="platform-email-review-sequence">{String(item.sequence).padStart(2, "0")}</span>
      <span className="platform-email-review-summary"><strong>{item.title || t("management.emailUntitled")}</strong><small>{[item.recipient, item.mail_format, item.locale].filter(Boolean).join(" · ")}</small>{item.detail ? <code>{item.detail}</code> : null}</span>
      <span className={`platform-email-status is-${item.status}`}>{t(emailStatusLabels[item.status])}</span>
      <time>{time(item.completed_at ?? item.created_at)}</time>
      <span className="material-symbols-outlined">chevron_right</span>
    </button>)}</div> : value
      ? <FeedbackState tone="empty" icon="mark_email_unread" title={t(active ? "management.emailReviewWaiting" : "management.emailReviewBlank")} />
      : <FeedbackState tone={busy ? "loading" : "error"} title={t(busy ? "common.loading" : "management.pageLoadFailed")} />}
  </section>;
}

function EmailReviewDetail({ value }: { value: PlatformEmailReviewDetailDTO | null }) {
  const { t } = useI18n();
  if (!value) return <div className="platform-delivery-loading"><i /><strong>正在读取邮件正文</strong><span>正文访问会写入审计日志</span></div>;
  return <div className="platform-email-review-detail">
    <section className="platform-email-review-detail-head"><span>REVIEW #{String(value.sequence).padStart(2, "0")}</span><h2>{value.title || "无标题邮件"}</h2><div><span className={`platform-email-status is-${value.status}`}>{t(emailStatusLabels[value.status])}</span><time>{new Date(value.created_at * 1000).toLocaleString()}</time></div></section>
    <section className="platform-email-review-facts"><div><span>收件人</span><strong>{value.recipient_name || "未提供称呼"}</strong><small>{value.recipient}</small></div><div><span>渲染参数</span><strong>{value.mail_format || "默认格式"}</strong><small>{value.locale || "默认语言"}</small></div><div><span>服务请求</span><strong>{value.request_id || "无请求 ID"}</strong><small>{value.status === "processing" ? "等待服务响应" : t(emailStatusLabels[value.status])}</small></div></section>
    <section className="platform-email-review-body"><header><span className="material-symbols-outlined">draft</span><strong>{t("management.emailPreview")}</strong></header><iframe className="platform-email-rendered-preview" sandbox="" referrerPolicy="no-referrer" title={t("management.emailPreview")} srcDoc={emailPreviewDocument(value.mail_format, value.body_text || "")} />{value.footer_note ? <footer>{value.footer_note}</footer> : null}</section>
    <details className="platform-email-review-response"><summary>{t("management.emailSource")}</summary><pre>{value.body_text}</pre></details>
    {value.action_url ? <a className="platform-email-review-link" href={value.action_url} rel="noreferrer" target="_blank"><span className="material-symbols-outlined">open_in_new</span><span><strong>邮件跳转链接</strong><small>{value.action_url}</small></span></a> : null}
    {value.detail ? <section className="platform-email-review-error"><strong>发送失败详情</strong><code>{value.detail}</code></section> : null}
    {value.provider_response != null ? <details className="platform-email-review-response"><summary>查看邮件服务原始响应</summary><pre>{JSON.stringify(value.provider_response, null, 2)}</pre></details> : null}
  </div>;
}

function SpaceRow({ space, onClick }: { space: PlatformAdminSpaceDTO; onClick: () => void }) {
  const { t } = useI18n();
  return <button className="platform-space-row" onClick={onClick} type="button">
    <UserAvatar className="platform-space-avatar" name={space.name} uri={space.official_user?.avatar_uri} />
    <div><strong>{space.name}</strong><small>@{space.slug} · {space.member_count}/{space.member_limit}</small></div>
    <span className={`platform-tier is-${space.verification_tier}`}>{t(`admin.tier.${space.verification_tier}`)}</span>
    <span aria-hidden="true" className="material-symbols-outlined">chevron_right</span>
  </button>;
}

const deliveryMeta: Record<PlatformMessageDeliveryDTO["channel"], { icon: string; label: string }> = {
  web: { icon: "notifications_active", label: "系统通知" }, email: { icon: "mail", label: "邮件" }, sms: { icon: "sms", label: "短信" }, bark: { icon: "bolt", label: "即时" }, unknown: { icon: "help", label: "未知渠道" },
};
const statusLabel: Record<PlatformMessageDeliveryDTO["status"], string> = { sent: "已送达推送服务", pending: "等待发送", failed: "发送失败", skipped: "已跳过", unknown: "状态未知" };

function DeliveryStage({delivery}:{delivery:PlatformMessageDeliveryDTO}){
  const {t}=useI18n();
  const time=delivery.notification_submitted_at||delivery.client_received_at;
  const label=delivery.channel==='web'?(delivery.notification_submitted_at?t('webPush.deliverySubmitted'):delivery.client_error?t('webPush.deliveryFailed'):delivery.client_received_at?t('webPush.deliveryReceived'):statusLabel[delivery.status]):statusLabel[delivery.status];
  return <em title={[time?new Date(time*1000).toLocaleString():'',delivery.client_error].filter(Boolean).join(' · ')}>{label}</em>;
}

function DeliveryAudit({ value }: { value: PlatformMessageDeliveryAuditDTO | null }) {
  const {t}=useI18n();
  if (!value) return <div className="platform-delivery-loading"><i /><strong>正在还原投递链路</strong><span>正在关联事件、收件人与渠道记录</span></div>;
  const { totals } = value;
  return <div className="platform-delivery-audit">
    <section className="platform-delivery-hero"><div><span>MESSAGE #{value.message.message_id}</span><h2>{value.message.preview || "多媒体消息"}</h2><p>{value.message.sender.name} · {new Date(value.message.created_at * 1000).toLocaleString()}</p></div><div className={totals.failed ? "has-failure" : ""}><strong>{totals.sent}/{totals.deliveries}</strong><span>{t('webPush.serviceAccepted')}</span></div></section>
    <section className="platform-delivery-summary"><span><strong>{totals.recipients}</strong>收件人</span><span><strong>{totals.pending}</strong>等待</span><span><strong>{totals.failed}</strong>失败</span><span><strong>{totals.skipped}</strong>跳过</span></section>
    {value.recipients.length ? <div className="platform-recipient-list">{value.recipients.map((recipient) => <section className="platform-recipient" key={recipient.event_id}><header><UserAvatar className="platform-delivery-avatar" name={recipient.user.name} uri={recipient.user.avatar_uri} /><div><strong>{recipient.user.name}</strong><span>事件 #{recipient.event_id} · {new Date(recipient.event_created_at * 1000).toLocaleTimeString()}</span></div></header>{recipient.deliveries.length ? <div className="platform-delivery-lanes">{recipient.deliveries.map((delivery) => { const meta = deliveryMeta[delivery.channel]; const delay = delivery.attempted_at ? Math.max(0, delivery.attempted_at - recipient.event_created_at) : null; return <article className={`platform-delivery-lane is-${delivery.client_error&&!delivery.notification_submitted_at?'failed':delivery.status}`} key={`${delivery.channel}-${delivery.delivery_id}`}><span className="material-symbols-outlined">{meta.icon}</span><div><strong>{meta.label}<DeliveryStage delivery={delivery}/></strong><p>{delivery.attempted_at ? `${new Date(delivery.attempted_at * 1000).toLocaleString()} · +${delay?.toFixed(2)}s` : "尚未尝试"}</p>{delivery.client_error?<code>{delivery.client_error}</code>:null}{delivery.detail ? <code>{delivery.detail}</code> : null}{delivery.subscription ? <small>{delivery.subscription.origin} · {delivery.subscription.digest} · {delivery.subscription.user_agent || "设备信息未记录"}</small> : null}</div><i /></article>; })}</div> : <div className="platform-delivery-empty">没有生成渠道投递记录</div>}</section>)}</div> : <div className="platform-delivery-zero"><span className="material-symbols-outlined">notifications_off</span><strong>这条消息没有通知事件</strong><p>可能没有其他接收人、属于系统消息，或发送时通知已被屏蔽。</p></div>}
  </div>;
}

function PlatformAdminConsole() {
  const { t, locale } = useI18n();
  const { session, logout, setSession } = usePlatformAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = managementSection(searchParams.get("section"), platformManagementSections, "overview");
  const setSection = (value: Section) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("section", value); return next; });
  const [dashboard, setDashboard] = useState<PlatformDashboardDTO | null>(null);
  const [spaces, setSpaces] = useState<PlatformAdminSpaceDTO[]>([]);
  const [audit, setAudit] = useState<PlatformAuditDTO[]>([]);
  const [debugReports, setDebugReports] = useState<Awaited<ReturnType<typeof api.getPlatformDebugReports>>["items"]>([]);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugDetail, setDebugDetail] = useState<string | null>(null);
  const debugRequest = useRef(0);
  const [emailDeliveries, setEmailDeliveries] = useState<PlatformEmailDeliveryDTO[]>([]);
  const [emailCursor, setEmailCursor] = useState<number | null>(null);
  const [emailHasMore, setEmailHasMore] = useState(false);
  const [emailLoaded, setEmailLoaded] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [emailFilter, setEmailFilter] = useState<"all" | PlatformEmailDeliveryDTO["status"]>("all");
  const [emailReview, setEmailReview] = useState<PlatformEmailReviewStateDTO | null>(null);
  const [emailReviewBusy, setEmailReviewBusy] = useState(false);
  const [selectedEmailReview, setSelectedEmailReview] = useState<PlatformEmailReviewRecordDTO | null>(null);
  const [emailReviewDetail, setEmailReviewDetail] = useState<PlatformEmailReviewDetailDTO | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<PlatformAdminSpaceDTO | null>(null);
  const [spaceFeatureBusy, setSpaceFeatureBusy] = useState<SpaceFeatureKey | null>(null);
  const [members, setMembers] = useState<PlatformAdminMemberDTO[]>([]);
  const [memberLoad, setMemberLoad] = useState<AppViewState>("idle");
  const memberRequest = useRef<AbortController | null>(null);
  const [selectedMember, setSelectedMember] = useState<PlatformAdminMemberDTO | null>(null);
  const [pendingChat, setPendingChat] = useState<ChatDTO | null>(null);
  const [chatReason, setChatReason] = useState("");
  const [openChat, setOpenChat] = useState<ChatDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [auditReason, setAuditReason] = useState("");
  const [messageCursor, setMessageCursor] = useState<number | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [deliveryAudit, setDeliveryAudit] = useState<PlatformMessageDeliveryAuditDTO | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState<ChatMessageDTO | null>(null);
  const deliveryRequest = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [spaceTier, setSpaceTier] = useState<"all" | PlatformAdminSpaceDTO["verification_tier"]>("all");
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformErrors, setPlatformErrors] = useState<string[]>([]);
  const platformRequest = useRef<AbortController | null>(null);
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ space: PlatformAdminSpaceDTO; approved: boolean } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = async () => {
    platformRequest.current?.abort();
    const controller = new AbortController();
    platformRequest.current = controller;
    setPlatformLoading(true);
    setPlatformErrors([]);
    const [nextDashboard, nextSpaces, nextAudit] = await Promise.allSettled([
      api.getPlatformDashboard(controller.signal), api.getPlatformSpaces("", controller.signal), api.getPlatformAudit(controller.signal),
    ]);
    if (controller.signal.aborted) return;
    const errors: string[] = [];
    if (nextDashboard.status === "fulfilled") setDashboard(nextDashboard.value); else errors.push("overview", "security");
    if (nextSpaces.status === "fulfilled") setSpaces(nextSpaces.value); else errors.push("spaces", "reviews");
    if (nextAudit.status === "fulfilled") setAudit(nextAudit.value); else errors.push("audit");
    setPlatformErrors(errors);
    setPlatformLoading(false);
  };
  useEffect(() => {
    void load();
    return () => {
      platformRequest.current?.abort();
      memberRequest.current?.abort();
      deliveryRequest.current?.abort();
    };
  }, []);
  const loadDebugReports = async () => {
    setDebugLoading(true);
    try {
      setDebugReports((await api.getPlatformDebugReports()).items);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "调试报告加载失败", "error");
    } finally {
      setDebugLoading(false);
    }
  };
  useEffect(() => { if (section === "debug") void loadDebugReports(); }, [section]);
  const openDebugReport = async (reportId: number) => {
    const request = ++debugRequest.current;
    setDebugDetail(t("common.loading"));
    try { const result = await api.getPlatformDebugReport(reportId); if (request === debugRequest.current) setDebugDetail(JSON.stringify(result.report, null, 2)); }
    catch { if (request === debugRequest.current) { setDebugDetail(null); showToast(t("management.reportFailed"), "error"); } }
  };
  const copyDebugReport = async (reportId: number) => {
    try {
      const result = await api.getPlatformDebugReport(reportId);
      const copied = await copyText(JSON.stringify(result.report, null, 2));
      showToast(copied ? "报告已复制" : "复制失败", copied ? "success" : "error");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "读取报告失败", "error");
    }
  };
  const deleteDebugReport = async (reportId: number) => {
    if (!window.confirm("确定删除这份调试报告？")) return;
    try {
      await api.deletePlatformDebugReport(reportId);
      setDebugReports((current) => current.filter((item) => item.report_id !== reportId));
      showToast("报告已删除", "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "删除失败", "error");
    }
  };
  useEffect(() => {
    if (section !== "emails" || emailLoaded || emailLoading) return;
    setEmailLoaded(true);
    setEmailLoading(true);
    setEmailError(false);
    void api.getPlatformEmailDeliveries(undefined, 40).then((deliveries) => {
      setEmailDeliveries(deliveries.items); setEmailCursor(deliveries.next_before); setEmailHasMore(deliveries.has_more);
    }).catch(() => setEmailError(true)).finally(() => setEmailLoading(false));
  }, [emailLoaded, emailLoading, section]);
  useEffect(() => {
    if (section !== "emailReview") return;
    void refreshEmailReview();
  }, [section]);
  useEffect(() => {
    if (section !== "emailReview" || !emailReview?.enabled || emailReviewBusy) return;
    let active = true;
    const timer = window.setInterval(() => {
      void api.getPlatformEmailReview().then((value) => { if (active) setEmailReview(value); }).catch(() => undefined);
    }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [emailReview?.enabled, emailReviewBusy, section]);
  const pendingReviews = useMemo(() => spaces.filter((space) => space.identity_submitted_at && !space.identity_verified_at), [spaces]);
  const spaceKeyword = query.trim().toLowerCase();
  const visibleSpaces = spaces.filter((space) => (spaceTier === "all" || space.verification_tier === spaceTier)
    && `${space.name} ${space.slug} ${space.email}`.toLowerCase().includes(spaceKeyword));
  const auditKeyword = auditQuery.trim().toLowerCase();
  const visibleAudit = audit.filter((item) => `${item.summary} ${item.action} ${item.ip_address ?? ""}`.toLowerCase().includes(auditKeyword));
  const visibleDeliveries = emailDeliveries.filter((item) => emailFilter === "all" || item.status === emailFilter);

  const selectSpace = async (space: PlatformAdminSpaceDTO) => {
    memberRequest.current?.abort();
    const controller = new AbortController();
    memberRequest.current = controller;
    setSelectedSpace(space);
    setMembers([]);
    setMemberLoad("loading");
    try {
      const result = await api.getPlatformMembers(space.space_id, controller.signal);
      if (controller.signal.aborted) return;
      setMembers(result);
      setMemberLoad("ready");
    } catch {
      if (!controller.signal.aborted) setMemberLoad("error");
    }
  };
  const toggleSpaceFeature = async (key: SpaceFeatureKey, granted: boolean) => {
    if (!selectedSpace || spaceFeatureBusy) return;
    const spaceId = selectedSpace.space_id;
    setSpaceFeatureBusy(key);
    try {
      const updated = await api.setPlatformSpaceFeature(spaceId, key, granted);
      setSelectedSpace((current) => current?.space_id === updated.space_id ? updated : current);
      setSpaces((items) => items.map((item) => item.space_id === updated.space_id ? updated : item));
      const feature = spaceFeatureGrants.find((item) => item.key === key)!;
      showToast(t(granted ? "management.featureGranted" : "management.featureRevoked", { name: t(feature.title) }));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("management.featureFailed"), "error");
    } finally { setSpaceFeatureBusy(null); }
  };
  const confirmChat = async () => { if (!pendingChat || !chatReason.trim()) return; try { const reason = chatReason.trim(); const result = await api.getPlatformChatMessages(pendingChat.chat_id, reason, undefined, selectedMember?.user_id); setOpenChat(result.chat); setMessages(result.messages); setAuditReason(reason); setMessageCursor(result.next_before); setHasOlderMessages(result.has_more); setPendingChat(null); setChatReason(""); } catch (cause) { showToast(cause instanceof Error ? cause.message : "会话读取失败", "error"); } };
  const loadOlderMessages = async () => { if (!openChat || !auditReason || !messageCursor || !hasOlderMessages || loadingOlderMessages) return; setLoadingOlderMessages(true); try { const result = await api.getPlatformChatMessages(openChat.chat_id, auditReason, messageCursor, selectedMember?.user_id); setMessages((current) => [...current, ...result.messages.filter((item) => !current.some((existing) => existing.message_id === item.message_id))]); setMessageCursor(result.next_before); setHasOlderMessages(result.has_more); } catch (cause) { showToast(cause instanceof Error ? cause.message : "更早记录读取失败", "error"); } finally { setLoadingOlderMessages(false); } };
  const closeDelivery = () => {
    deliveryRequest.current?.abort();
    setDeliveryMessage(null);
    setDeliveryAudit(null);
  };
  const inspectDelivery = async (message: ChatMessageDTO) => {
    deliveryRequest.current?.abort();
    const request = new AbortController();
    deliveryRequest.current = request;
    setDeliveryMessage(message);
    setDeliveryAudit(null);
    try {
      const result = await api.getPlatformMessageDeliveries(message.message_id, auditReason, request.signal);
      if (!request.signal.aborted) setDeliveryAudit(result);
    } catch (cause) {
      if (request.signal.aborted) return;
      closeDelivery();
      showToast(cause instanceof Error ? cause.message : "投递链路读取失败", "error");
    }
  };
  const loadMoreEmailDeliveries = async () => { if (!emailHasMore || !emailCursor || emailLoading) return; setEmailLoading(true); try { const result = await api.getPlatformEmailDeliveries(emailCursor, 40); setEmailDeliveries((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.delivery_id === item.delivery_id))]); setEmailCursor(result.next_before); setEmailHasMore(result.has_more); } catch (cause) { showToast(cause instanceof Error ? cause.message : "更多邮件记录加载失败", "error"); } finally { setEmailLoading(false); } };
  const refreshEmailReview = async () => { if (emailReviewBusy) return; setEmailReviewBusy(true); try { setEmailReview(await api.getPlatformEmailReview()); } catch (cause) { showToast(cause instanceof Error ? cause.message : "审阅进度刷新失败", "error"); } finally { setEmailReviewBusy(false); } };
  const toggleEmailReview = async () => { if (emailReviewBusy) return; setEmailReviewBusy(true); try { const next = await api.setPlatformEmailReview(!emailReview?.enabled); setEmailReview(next); setSelectedEmailReview(null); setEmailReviewDetail(null); showToast(next.enabled ? "邮件审阅已开启" : next.captured_count >= next.limit ? "已捕获 20 封并自动停止" : "邮件审阅已停止"); } catch (cause) { showToast(cause instanceof Error ? cause.message : "邮件审阅状态更新失败", "error"); } finally { setEmailReviewBusy(false); } };
  const openEmailReview = async (record: PlatformEmailReviewRecordDTO) => { setSelectedEmailReview(record); setEmailReviewDetail(null); try { setEmailReviewDetail(await api.getPlatformEmailReviewDetail(record.record_id)); } catch (cause) { setSelectedEmailReview(null); showToast(cause instanceof Error ? cause.message : "邮件正文读取失败", "error"); } };
  const review = async () => { if (!reviewTarget || (!reviewTarget.approved && !reviewNote.trim())) return; try { await api.reviewPlatformIdentity(reviewTarget.space.space_id, reviewTarget.approved, reviewNote.trim()); showToast(reviewTarget.approved ? "实名认证已通过" : "申请已驳回"); setReviewTarget(null); setReviewNote(""); void load(); } catch (cause) { showToast(cause instanceof Error ? cause.message : "审核失败", "error"); } };
  const setupMfa = async () => { try { const result = await api.beginPlatformMfa(); setMfaSecret(result.secret); setMfaQr(await QRCode.toDataURL(result.otpauth_uri, { width: 320, margin: 1 })); } catch (cause) { showToast(cause instanceof Error ? cause.message : "MFA 配置失败", "error"); } };
  const verifyMfa = async () => { try { const result = await api.verifyPlatformMfa(mfaCode); setRecoveryCodes(result.recovery_codes); setSession(session ? { ...session, mfaEnabled: true } : null); setDashboard((value) => value ? { ...value, mfa_enabled: true } : value); } catch (cause) { showToast(cause instanceof Error ? cause.message : "动态口令无效", "error"); } };

  const sectionFailed = platformErrors.includes(section);
  const retry = <button className="ghost-button" onClick={() => void load()} type="button">{t("common.retry")}</button>;
  const formatCount = (count: number) => count.toLocaleString(locale);

  return <ManagementWorkspace
    className="platform-console"
    title={t("management.platformTitle")}
    identity={session?.email ?? "FRIENDEN"}
    avatar={<img alt="" src="/icons/frienden-512.png?v=2" />}
    activeId={section}
    items={nav.map((item) => ({
      ...item,
      group: { id: item.group, icon: item.groupIcon, label: t(`management.group.${item.group}` as TranslationKey) },
      label: t(`management.${item.id}` as TranslationKey),
      badge: item.id === "reviews" ? pendingReviews.length : item.id === "resources" ? dashboard?.pending_sticker_reviews : undefined,
    }))}
    onSelect={(id) => setSection(id as Section)}
    onLogout={logout}
    fill={section === "permissions"}
    status={<div className="platform-secure-pill"><i />{t("management.secureSession")}</div>}
  >
    <div className={`platform-main ${section === "permissions" ? "is-permissions" : ""}`}>
      {sectionFailed && <FeedbackState tone="error" title={t("management.pageLoadFailed")} action={retry} />}
      {section === "overview" && (
        <div className="management-overview">
          {dashboard ? <>
            <div className="platform-metrics">
              <Metric icon="domain" label={t("management.activeSpaces")} value={dashboard.spaces} onOpen={() => setSection("spaces")} />
              <Metric icon="group" label={t("management.activeMembers")} value={dashboard.members} onOpen={() => setSection("spaces")} />
              <Metric icon="verified_user" label={t("management.pendingIdentity")} value={dashboard.pending_identity_reviews} onOpen={() => setSection("reviews")} />
            </div>
            <section className="platform-panel management-log-panel">
              <ManagementToolbar description={<h2>{t("management.recentAudit")}</h2>}>
                <button className="ghost-button" onClick={() => setSection("audit")} type="button">{t("management.viewAudit")}</button>
              </ManagementToolbar>
              {dashboard.recent_audit.length ? <AuditList items={dashboard.recent_audit} /> : <FeedbackState tone="empty" icon="policy" title={t("management.noAudit")} />}
            </section>
          </> : platformLoading && <FeedbackState tone="loading" title={t("common.loading")} />}
        </div>
      )}

      {section === "spaces" && <section className="management-list-page">
        <ManagementToolbar description={t("management.resultsCount", { total: formatCount(visibleSpaces.length) })}>
          <ManagementSearch label={t("management.searchSpaces")} query={query} onChange={setQuery} />
          <ManagementFilter label={t("management.verificationFilter")} value={spaceTier} options={[
            { value: "all", label: t("management.allTiers") },
            ...(["email", "phone", "identity"] as const).map((value) => ({ value, label: t(`admin.tier.${value}`) })),
          ]} onChange={(value) => setSpaceTier(value as typeof spaceTier)} />
        </ManagementToolbar>
        <div className="platform-space-list" aria-busy={platformLoading}>
          {visibleSpaces.map((space) => <SpaceRow key={space.space_id} onClick={() => void selectSpace(space)} space={space} />)}
        </div>
        {platformLoading && !spaces.length && <FeedbackState tone="loading" title={t("common.loading")} />}
        {!platformLoading && !sectionFailed && !visibleSpaces.length && <FeedbackState tone="empty" icon="search_off" title={t("management.noMatchingSpaces")} />}
      </section>}

      {section === "permissions" && <PermissionWorkspace scope="platform" />}
      {section === "activities" && <PlatformActivityWorkspace />}
      {section === "resources" && <ResourceWorkspace />}
      {section === "oauth" && <OAuthApplicationWorkspace platform />}

      {section === "reviews" && <section className="management-list-page">
        <ManagementToolbar description={t("management.reviewQueueHint")}>
          {!!pendingReviews.length && <strong className="management-count">{t("management.pendingCount", { total: formatCount(pendingReviews.length) })}</strong>}
        </ManagementToolbar>
        <div className="management-record-list">
          {pendingReviews.map((space) => <article className="platform-review-card" key={space.space_id}>
            <div className="management-record-identity">
              <UserAvatar className="platform-space-avatar" name={space.name} uri={space.official_user?.avatar_uri} />
              <div><strong>{space.name}</strong><small>@{space.slug} · {new Date((space.identity_submitted_at ?? 0) * 1000).toLocaleString(locale)}</small></div>
            </div>
            <div className="management-row-actions">
              <button onClick={() => void api.getPlatformIdentityDocument(space.space_id).then((result) => window.open(result.uri, "_blank", "noopener")).catch(() => showToast(t("management.documentLoadFailed"), "error"))} type="button">{t("management.viewDocument")}</button>
              <button className="is-danger" onClick={() => setReviewTarget({ space, approved: false })} type="button">{t("management.reject")}</button>
              <button className="is-approve" onClick={() => setReviewTarget({ space, approved: true })} type="button">{t("management.approve")}</button>
            </div>
          </article>)}
        </div>
        {platformLoading && !pendingReviews.length && <FeedbackState tone="loading" title={t("common.loading")} />}
        {!platformLoading && !sectionFailed && !pendingReviews.length && <FeedbackState tone="empty" icon="task_alt" title={t("management.noReviewQueue")} />}
      </section>}

      {section === "emailReview" && <EmailReviewPanel busy={emailReviewBusy} onOpen={(record) => void openEmailReview(record)} onRefresh={() => void refreshEmailReview()} onToggle={() => void toggleEmailReview()} value={emailReview} />}
      {section === "emails" && <section className="management-list-page platform-email-workspace">
        <ManagementToolbar description={t("management.emailMaskHint")}>
          <ManagementFilter label={t("management.emailStatusFilter")} value={emailFilter} options={[
            { value: "all", label: t("common.all") },
            ...Object.keys(emailStatusLabels).map((value) => ({ value, label: t(emailStatusLabels[value as PlatformEmailDeliveryDTO["status"]]) })),
          ]} onChange={(value) => setEmailFilter(value as typeof emailFilter)} />
        </ManagementToolbar>
        {!!visibleDeliveries.length && <EmailDeliveryList items={visibleDeliveries} />}
        {emailLoading && !emailDeliveries.length && <FeedbackState tone="loading" title={t("common.loading")} />}
        {emailError && <FeedbackState tone="error" title={t("management.pageLoadFailed")} action={<button className="ghost-button" onClick={() => setEmailLoaded(false)} type="button">{t("common.retry")}</button>} />}
        {!emailLoading && !emailError && !visibleDeliveries.length && <FeedbackState tone="empty" icon="mail" title={t(emailFilter === "all" ? "management.noEmails" : "management.noMatchingEmails")} />}
        {emailHasMore && <button className="ghost-button management-load-more" disabled={emailLoading} onClick={() => void loadMoreEmailDeliveries()} type="button">
          {t(emailLoading ? "common.loading" : "management.loadMoreRecords")}
          <span aria-hidden="true" className="material-symbols-outlined">expand_more</span>
        </button>}
      </section>}

      {section === "audit" && <section className="management-list-page">
        <ManagementToolbar description={t("management.auditLimit")}>
          <ManagementSearch label={t("management.searchAudit")} query={auditQuery} onChange={setAuditQuery} />
          <button className="ghost-button" disabled={platformLoading} onClick={() => void load()} type="button">{t("management.refresh")}</button>
        </ManagementToolbar>
        {!!visibleAudit.length && <AuditList items={visibleAudit} />}
        {platformLoading && !visibleAudit.length && <FeedbackState tone="loading" title={t("common.loading")} />}
        {!platformLoading && !sectionFailed && !visibleAudit.length && <FeedbackState tone="empty" icon="policy" title={t(auditKeyword ? "management.noMatchingAudit" : "management.noAudit")} />}
      </section>}

      {section === "debug" && <section className="management-list-page">
        <ManagementToolbar description={t("management.debugRetention")}>
          <button className="ghost-button" disabled={debugLoading} onClick={() => void loadDebugReports()} type="button">{t("management.refresh")}</button>
        </ManagementToolbar>
        {!!debugReports.length && <div className="platform-debug-list">
          {debugReports.map((item) => <article key={item.report_id}>
            <div><strong>{item.user_name} <small>#{item.user_id}</small></strong><span>@{item.space} · {new Date(item.created_at * 1000).toLocaleString(locale)} · {t("management.resultsCount", { total: formatCount(item.entry_count) })}</span></div>
            <div className="management-row-actions">
              <button onClick={() => void openDebugReport(item.report_id)} type="button">{t("management.openReport")}</button>
              <button onClick={() => void copyDebugReport(item.report_id)} type="button">{t("management.copyReport")}</button>
              <button className="is-danger" onClick={() => void deleteDebugReport(item.report_id)} type="button">{t("management.deleteReport")}</button>
            </div>
          </article>)}
        </div>}
        {!debugReports.length && <FeedbackState tone={debugLoading ? "loading" : "empty"} icon="bug_report" title={t(debugLoading ? "common.loading" : "management.noDebugReports")} />}
      </section>}

      {section === "security" && <section className="platform-security-grid">
        <article className="platform-panel">
          <span aria-hidden="true" className="platform-security-icon material-symbols-outlined">passkey</span>
          <h2>{t("management.mfa")}</h2>
          <p>{t("management.mfaHint")}</p>
          {dashboard ? <>
            <div className={`platform-status ${dashboard.mfa_enabled ? "is-on" : ""}`}><i />{t(dashboard.mfa_enabled ? "common.enabled" : "common.disabled")}</div>
            {!dashboard.mfa_enabled && <button className="platform-primary is-compact" onClick={() => void setupMfa()} type="button">{t("management.mfaSetup")}</button>}
          </> : platformLoading && <p role="status">{t("common.loading")}</p>}
        </article>
        <article className="platform-panel">
          <span aria-hidden="true" className="platform-security-icon material-symbols-outlined">history</span>
          <h2>{t("management.sessionPolicy")}</h2>
          <p>{t("management.sessionPolicyHint")}</p>
          <button className="platform-secondary" onClick={logout} type="button">{t("auth.logout")}</button>
        </article>
      </section>}
    </div>
  <SideDrawer showTitle historyKey="platform-debug-report" onClose={() => { debugRequest.current += 1; setDebugDetail(null); }} open={debugDetail !== null} title={t("management.debug")}><pre className="management-report-content">{debugDetail}</pre></SideDrawer>
  <SideDrawer historyKey="platform-space" onClose={() => { memberRequest.current?.abort(); setSelectedSpace(null); }} open={Boolean(selectedSpace)} title={selectedSpace?.name || "空间详情"}>{selectedSpace ? <div className="platform-drawer-stack"><section className="platform-space-summary"><UserAvatar className="platform-profile-avatar" name={selectedSpace.name} uri={selectedSpace.official_user?.avatar_uri} /><div><h2>{selectedSpace.name}</h2><p>@{selectedSpace.slug}</p></div><span className={`platform-tier is-${selectedSpace.verification_tier}`}>{selectedSpace.verification_tier}</span></section><section className="platform-data-grid"><span>成员<strong>{selectedSpace.member_count}</strong></span><span>容量<strong>{selectedSpace.member_limit}</strong></span><span>聊天<strong>{selectedSpace.chat_enabled ? "开启" : "关闭"}</strong></span><span>广场<strong>{selectedSpace.square_enabled ? "开启" : "关闭"}</strong></span></section><PlatformSpaceFeatures space={selectedSpace} busy={spaceFeatureBusy} onToggle={(key, granted) => void toggleSpaceFeature(key, granted)} /><section className="platform-panel"><h3>成员</h3>{members.length ? members.map((member) => <button className="platform-member-row" key={member.user_id} onClick={() => setSelectedMember(member)} type="button"><UserAvatar className="platform-member-avatar" name={member.name} uri={member.avatar_uri} /><div><strong>{member.name}</strong><small>LV{member.growth_level ?? 1} · {member.verified ? "已认证" : "未认证"}</small></div><span className="material-symbols-outlined">chevron_right</span></button>) : <FeedbackState tone={memberLoad === "error" ? "error" : memberLoad === "loading" ? "loading" : "empty"} title={t(memberLoad === "error" ? "admin.membersLoadFailed" : memberLoad === "loading" ? "common.loading" : "management.noSpaceMembers")} action={memberLoad === "error" ? <button className="ghost-button" onClick={() => void selectSpace(selectedSpace)} type="button">{t("common.retry")}</button> : undefined} />}</section></div> : null}</SideDrawer>
  <SideDrawer historyKey="platform-member" onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} title="成员档案">{selectedMember ? <PlatformMemberPanel key={selectedMember.user_id} member={selectedMember} onChat={(chat) => setPendingChat(chat)} /> : null}</SideDrawer>
  <InputDialog confirmLabel="记录理由并查看" onChange={setChatReason} onClose={() => { setPendingChat(null); setChatReason(""); }} onConfirm={() => void confirmChat()} open={Boolean(pendingChat)} placeholder="例如：处理用户举报 #20260812" title="为什么需要查看这段会话？" value={chatReason} />
  <InputDialog confirmLabel={reviewTarget?.approved ? "确认通过" : "确认驳回"} onChange={setReviewNote} onClose={() => { setReviewTarget(null); setReviewNote(""); }} onConfirm={() => void review()} open={Boolean(reviewTarget)} placeholder={reviewTarget?.approved ? "审核备注（可选）" : "请填写明确的驳回原因"} title={reviewTarget?.approved ? `通过 ${reviewTarget.space.name} 的实名认证？` : `驳回 ${reviewTarget?.space.name ?? ""} 的申请？`} value={reviewNote} />
  <SideDrawer fullscreen className="platform-chat-drawer" historyKey="platform-chat" onClose={() => { setOpenChat(null); setMessages([]); setAuditReason(""); setMessageCursor(null); setHasOlderMessages(false); }} open={Boolean(openChat)} title={openChat?.title || "会话审计"}>{openChat ? <PlatformAuditConversation key={openChat.chat_id} chat={openChat} reason={auditReason} memberName={selectedMember?.name} firstPersonUserId={selectedMember?.user_id ?? null} hasMore={hasOlderMessages} loading={loadingOlderMessages} messages={messages} onLoadOlder={loadOlderMessages} onInspectDelivery={(message) => void inspectDelivery(message)} /> : null}</SideDrawer>
  <SideDrawer showTitle className="platform-delivery-drawer" historyKey="platform-message-delivery" onClose={closeDelivery} open={Boolean(deliveryMessage)} title="消息推送链路"><DeliveryAudit value={deliveryAudit} /></SideDrawer>
  <SideDrawer showTitle fullscreen className="platform-email-review-drawer" historyKey="platform-email-review" onClose={() => { setSelectedEmailReview(null); setEmailReviewDetail(null); }} open={Boolean(selectedEmailReview)} title="邮件审阅详情"><EmailReviewDetail value={emailReviewDetail} /></SideDrawer>
  <SideDrawer actionDisabled={mfaCode.length !== 6} actionLabel="验证并启用" historyKey="platform-mfa" onAction={() => void verifyMfa()} onClose={() => { setMfaQr(""); setMfaSecret(""); setMfaCode(""); }} open={Boolean(mfaQr)} title="连接验证器"><div className="platform-mfa"><p>使用任意验证器扫描二维码，然后输入 6 位动态口令。</p><img alt="MFA QR code" src={mfaQr} /><code>{mfaSecret}</code><VerificationCodeInput ariaLabel="动态口令" value={mfaCode} onChange={setMfaCode} /></div></SideDrawer>
  <SideDrawer historyKey="platform-recovery" onClose={() => setRecoveryCodes([])} open={recoveryCodes.length > 0} title="保存恢复码"><div className="platform-recovery"><span className="material-symbols-outlined">key</span><h2>仅展示这一次</h2><p>每个恢复码只能使用一次。请离线保存，不要截图上传云端。</p><div>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="platform-primary" onClick={() => setRecoveryCodes([])} type="button">我已安全保存</button></div></SideDrawer></ManagementWorkspace>;
}

export default function PlatformAdminPage() {
  const { session } = usePlatformAdminAuth();
  return session ? <PlatformAdminConsole /> : <PlatformAdminLogin />;
}
