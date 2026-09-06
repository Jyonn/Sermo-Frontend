import QRCode from "qrcode";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { PermissionWorkspace } from "../components/PermissionWorkspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { usePlatformAdminAuth } from "../lib/platformAdminAuth";
import { formatRelativeTime } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { ChatDTO, ChatMessageDTO, PlatformAdminMemberDTO, PlatformAdminSpaceDTO, PlatformAuditDTO, PlatformDashboardDTO, PlatformEmailDeliveryDTO, PlatformEmailReviewDetailDTO, PlatformEmailReviewRecordDTO, PlatformEmailReviewStateDTO, PlatformMessageDeliveryAuditDTO, PlatformMessageDeliveryDTO } from "../types";
import { ChatPreview } from "./ChatsPage";

type Section = "overview" | "spaces" | "permissions" | "reviews" | "emails" | "audit" | "security";
const nav: Array<{ id: Section; icon: string; label: string }> = [
  { id: "overview", icon: "space_dashboard", label: "总览" },
  { id: "spaces", icon: "domain", label: "空间" },
  { id: "permissions", icon: "account_tree", label: "权限" },
  { id: "reviews", icon: "verified_user", label: "审核" },
  { id: "emails", icon: "mail", label: "邮件" },
  { id: "audit", icon: "policy", label: "审计" },
  { id: "security", icon: "shield_lock", label: "安全" },
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
      <div className="platform-brand"><img alt="" className="platform-brand-mark" src="/icons/sermo-512.png?v=6"/><div><small>SERMO CONTROL</small><strong>平台审计台</strong></div></div>
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

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className="platform-metric"><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{note}</small></article>;
}

function AuditList({ items }: { items: PlatformAuditDTO[] }) {
  return <div className="platform-audit-list">{items.map((item) => <article key={item.audit_id}><span className="platform-audit-dot" /><div><strong>{item.summary || item.action}</strong><small>{item.action} · {time(item.created_at)}{item.ip_address ? ` · ${item.ip_address}` : ""}</small></div></article>)}</div>;
}

const emailStatusLabel: Record<PlatformEmailDeliveryDTO["status"], string> = { pending: "等待发送", processing: "投递中", sent: "已发送", failed: "发送失败", skipped: "已跳过" };
const emailEventLabel: Record<number, string> = { 1: "私聊消息", 2: "群聊消息", 3: "群聊邀请", 4: "系统通知", 5: "发言获赞", 6: "发言评论", 7: "评论获赞", 8: "评论回复", 9: "发言处理", 10: "评论提及" };

function EmailDeliveryList({ items }: { items: PlatformEmailDeliveryDTO[] }) {
  return <div className="platform-email-list">{items.map((item) => <article className={`platform-email-row is-${item.status}`} key={item.delivery_id}>
    <span className="platform-email-icon material-symbols-outlined">mail</span>
    <div className="platform-email-copy"><div><strong>{item.user.name}</strong><span className={`platform-email-status is-${item.status}`}>{emailStatusLabel[item.status]}</span></div><p>{item.recipient || "未记录邮箱"}</p><small>{emailEventLabel[item.event_type] || item.event_kind || `事件 #${item.event_id}`} · {item.space.name} @{item.space.slug}</small>{item.detail && item.status === "failed" ? <code>{item.detail}</code> : null}</div>
    <time dateTime={item.attempted_at ? new Date(item.attempted_at * 1000).toISOString() : undefined}><strong>{item.attempted_at ? new Date(item.attempted_at * 1000).toLocaleString() : "尚未尝试"}</strong><small>{item.attempted_at ? time(item.attempted_at) : `创建于 ${time(item.created_at)}`}</small></time>
  </article>)}</div>;
}

const emailReviewStatusLabel: Record<PlatformEmailReviewRecordDTO["status"], string> = {
  processing: "发送中",
  sent: "发送成功",
  failed: "发送失败",
};

function EmailReviewPanel({ busy, onOpen, onRefresh, onToggle, value }: {
  busy: boolean;
  onOpen: (record: PlatformEmailReviewRecordDTO) => void;
  onRefresh: () => void;
  onToggle: () => void;
  value: PlatformEmailReviewStateDTO | null;
}) {
  const count = value?.captured_count ?? 0;
  const limit = value?.limit ?? 20;
  const active = Boolean(value?.enabled);
  const completed = Boolean(value?.completed_at && count >= limit);
  return <section className={`platform-email-review${active ? " is-active" : ""}`}>
    <header>
      <div><span>MAIL REVIEW</span><h3>邮件审阅采样</h3><p>开启后记录接下来 20 封邮件。成功与失败都会保留，满额后自动停止。</p></div>
      <div className="platform-email-review-actions">
        <button aria-label="刷新审阅进度" className="platform-email-review-refresh" disabled={busy} onClick={onRefresh} type="button"><span className="material-symbols-outlined">refresh</span></button>
        <button className={active ? "is-stop" : "is-start"} disabled={busy} onClick={onToggle} type="button">{busy ? "处理中" : active ? "停止审阅" : count ? "开启新一轮" : "开启审阅"}</button>
      </div>
    </header>
    <div className="platform-email-review-meter">
      <div><strong>{count}<small> / {limit}</small></strong><span>{active ? `正在捕获，剩余 ${value?.remaining ?? limit} 封` : completed ? "已满 20 封，自动停止" : count ? "本轮已停止" : "等待开启"}</span></div>
      <i><b style={{ width: `${Math.min(100, (count / limit) * 100)}%` }} /></i>
      {value?.started_at ? <time>开始于 {new Date(value.started_at * 1000).toLocaleString()}</time> : <time>新一轮会替换当前审阅样本</time>}
    </div>
    {value?.items.length ? <div className="platform-email-review-list">{value.items.map((item) => <button className={`is-${item.status}`} key={item.record_id} onClick={() => onOpen(item)} type="button">
      <span className="platform-email-review-sequence">{String(item.sequence).padStart(2, "0")}</span>
      <span className="platform-email-review-summary"><strong>{item.title || "无标题邮件"}</strong><small>{item.recipient} · {item.mail_format || "默认格式"} · {item.locale || "默认语言"}</small>{item.detail ? <code>{item.detail}</code> : null}</span>
      <span className={`platform-email-status is-${item.status}`}>{emailReviewStatusLabel[item.status]}</span>
      <time>{time(item.completed_at ?? item.created_at)}</time>
      <span className="material-symbols-outlined">chevron_right</span>
    </button>)}</div> : <div className="platform-email-review-empty"><span className="material-symbols-outlined">mark_email_unread</span><div><strong>{active ? "正在等待下一封邮件" : "尚无审阅样本"}</strong><p>{active ? "邮件一旦进入发送流程，就会立即出现在这里。" : "开启后仅捕获接下来的 20 封，不影响邮件正常发送。"}</p></div></div>}
  </section>;
}

function EmailReviewDetail({ value }: { value: PlatformEmailReviewDetailDTO | null }) {
  if (!value) return <div className="platform-delivery-loading"><i /><strong>正在读取邮件正文</strong><span>正文访问会写入审计日志</span></div>;
  return <div className="platform-email-review-detail">
    <section className="platform-email-review-detail-head"><span>REVIEW #{String(value.sequence).padStart(2, "0")}</span><h2>{value.title || "无标题邮件"}</h2><div><span className={`platform-email-status is-${value.status}`}>{emailReviewStatusLabel[value.status]}</span><time>{new Date(value.created_at * 1000).toLocaleString()}</time></div></section>
    <section className="platform-email-review-facts"><div><span>收件人</span><strong>{value.recipient_name || "未提供称呼"}</strong><small>{value.recipient}</small></div><div><span>渲染参数</span><strong>{value.mail_format || "默认格式"}</strong><small>{value.locale || "默认语言"}</small></div><div><span>服务请求</span><strong>{value.request_id || "无请求 ID"}</strong><small>{value.status === "processing" ? "等待服务响应" : emailReviewStatusLabel[value.status]}</small></div></section>
    <section className="platform-email-review-body"><header><span className="material-symbols-outlined">draft</span><strong>邮件正文</strong></header><pre>{value.body_text || "（正文为空）"}</pre>{value.footer_note ? <footer>{value.footer_note}</footer> : null}</section>
    {value.action_url ? <a className="platform-email-review-link" href={value.action_url} rel="noreferrer" target="_blank"><span className="material-symbols-outlined">open_in_new</span><span><strong>邮件跳转链接</strong><small>{value.action_url}</small></span></a> : null}
    {value.detail ? <section className="platform-email-review-error"><strong>发送失败详情</strong><code>{value.detail}</code></section> : null}
    {value.provider_response != null ? <details className="platform-email-review-response"><summary>查看邮件服务原始响应</summary><pre>{JSON.stringify(value.provider_response, null, 2)}</pre></details> : null}
  </div>;
}

function SpaceRow({ space, onClick }: { space: PlatformAdminSpaceDTO; onClick: () => void }) {
  return <button className="platform-space-row" onClick={onClick} type="button"><UserAvatar className="platform-space-avatar" name={space.name} uri={space.official_user?.avatar_uri} /><div><strong>{space.name}</strong><small>@{space.slug} · {space.member_count}/{space.member_limit} 人</small></div><span className={`platform-tier is-${space.verification_tier}`}>{space.verification_tier === "identity" ? "实名" : space.verification_tier === "phone" ? "手机" : "邮箱"}</span><span className="material-symbols-outlined">chevron_right</span></button>;
}

function MemberPanel({ member, onChat }: { member: PlatformAdminMemberDTO; onChat: (chat: ChatDTO) => void }) {
  const [chats, setChats] = useState<ChatDTO[] | null>(null);
  useEffect(() => { const controller = new AbortController(); void api.getPlatformMemberChats(member.user_id, controller.signal).then(setChats).catch(() => undefined); return () => controller.abort(); }, [member.user_id]);
  return <div className="platform-drawer-stack"><section className="platform-profile"><UserAvatar className="platform-profile-avatar" frame={member.avatar_frame_style} name={member.name} uri={member.avatar_uri} /><div><h2>{member.name}</h2><p>LV{member.growth_level ?? 1} · {member.verified ? "已认证" : "未认证"}</p></div></section><section className="platform-data-grid"><span>好友<strong>{member.friend_count}</strong></span><span>会话<strong>{member.chat_count}</strong></span><span>发言<strong>{member.statement_count}</strong></span><span>提醒渠道<strong>{member.notifications_enabled}</strong></span></section><section className="platform-panel"><h3>认证与绑定</h3><div className="platform-contact-strip">{Object.entries(member.contacts).map(([key, bound]) => <span className={bound ? "is-on" : ""} key={key}>{key === "phone" ? "手机" : key === "email" ? "邮箱" : "即时"}<i>{bound ? "已绑定" : "未绑定"}</i></span>)}</div></section><section className="platform-panel"><h3>会话列表</h3>{chats === null ? <div className="platform-inline-loading"><i />正在读取摘要</div> : chats.length ? chats.map((chat) => <button className="platform-chat-row" key={chat.chat_id} onClick={() => onChat(chat)} type="button"><UserAvatar className="platform-chat-avatar" groupMembers={chat.group ? chat.members.map((item) => ({ name: item.name, uri: item.avatar_uri })) : undefined} name={chat.title || chat.members[0]?.name || "会话"} /><div><strong>{chat.title || chat.members.map((item) => item.name).join("、")}</strong><small>{chat.last_message?.content || "暂无消息"}</small></div><time>{time(chat.last_chat_at)}</time></button>) : <div className="platform-empty">暂无会话</div>}</section></div>;
}

function AuditConversation({ chat, firstPersonUserId, hasMore, loading, messages, onLoadOlder, onMessage }: { chat: ChatDTO; firstPersonUserId: number | null; hasMore: boolean; loading: boolean; messages: ChatMessageDTO[]; onLoadOlder: () => Promise<void>; onMessage: (message: ChatMessageDTO) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const ordered = [...messages].reverse();
  useEffect(() => { const node = scrollRef.current; if (node) node.scrollTop = node.scrollHeight; }, [chat.chat_id]);
  const loadOlder = async () => {
    const node = scrollRef.current;
    if (!node || !hasMore || loadingRef.current) return;
    loadingRef.current = true;
    const previousHeight = node.scrollHeight;
    const previousTop = node.scrollTop;
    try {
      await onLoadOlder();
      requestAnimationFrame(() => { node.scrollTop = previousTop + node.scrollHeight - previousHeight; });
    } finally {
      loadingRef.current = false;
    }
  };
  return <div className="platform-conversation" onScroll={(event) => { if (event.currentTarget.scrollTop < 96) void loadOlder(); }} ref={scrollRef}><div className="platform-conversation-notice"><span className="material-symbols-outlined">visibility</span>点击消息查看投递链路</div>{loading ? <div className="platform-history-loading"><i />读取更早记录</div> : !hasMore ? <div className="platform-history-boundary">已到达会话起点</div> : null}<ChatPreview className="platform-audit-chat-preview" firstPersonUserId={firstPersonUserId} messages={ordered} onMessageClick={onMessage} /></div>;
}

const deliveryMeta: Record<PlatformMessageDeliveryDTO["channel"], { icon: string; label: string }> = {
  web: { icon: "notifications_active", label: "系统通知" }, email: { icon: "mail", label: "邮件" }, sms: { icon: "sms", label: "短信" }, bark: { icon: "bolt", label: "即时" }, unknown: { icon: "help", label: "未知渠道" },
};
const statusLabel: Record<PlatformMessageDeliveryDTO["status"], string> = { sent: "已送达推送服务", pending: "等待发送", failed: "发送失败", skipped: "已跳过", unknown: "状态未知" };

function DeliveryAudit({ value }: { value: PlatformMessageDeliveryAuditDTO | null }) {
  if (!value) return <div className="platform-delivery-loading"><i /><strong>正在还原投递链路</strong><span>正在关联事件、收件人与渠道记录</span></div>;
  const { totals } = value;
  return <div className="platform-delivery-audit">
    <section className="platform-delivery-hero"><div><span>MESSAGE #{value.message.message_id}</span><h2>{value.message.preview || "多媒体消息"}</h2><p>{value.message.sender.name} · {new Date(value.message.created_at * 1000).toLocaleString()}</p></div><div className={totals.failed ? "has-failure" : ""}><strong>{totals.sent}/{totals.deliveries}</strong><span>成功投递</span></div></section>
    <section className="platform-delivery-summary"><span><strong>{totals.recipients}</strong>收件人</span><span><strong>{totals.pending}</strong>等待</span><span><strong>{totals.failed}</strong>失败</span><span><strong>{totals.skipped}</strong>跳过</span></section>
    {value.recipients.length ? <div className="platform-recipient-list">{value.recipients.map((recipient) => <section className="platform-recipient" key={recipient.event_id}><header><UserAvatar className="platform-delivery-avatar" name={recipient.user.name} uri={recipient.user.avatar_uri} /><div><strong>{recipient.user.name}</strong><span>事件 #{recipient.event_id} · {new Date(recipient.event_created_at * 1000).toLocaleTimeString()}</span></div></header>{recipient.deliveries.length ? <div className="platform-delivery-lanes">{recipient.deliveries.map((delivery) => { const meta = deliveryMeta[delivery.channel]; const delay = delivery.attempted_at ? Math.max(0, delivery.attempted_at - recipient.event_created_at) : null; return <article className={`platform-delivery-lane is-${delivery.status}`} key={`${delivery.channel}-${delivery.delivery_id}`}><span className="material-symbols-outlined">{meta.icon}</span><div><strong>{meta.label}<em>{statusLabel[delivery.status]}</em></strong><p>{delivery.attempted_at ? `${new Date(delivery.attempted_at * 1000).toLocaleString()} · +${delay?.toFixed(2)}s` : "尚未尝试"}</p>{delivery.detail ? <code>{delivery.detail}</code> : null}{delivery.subscription ? <small>{delivery.subscription.origin} · {delivery.subscription.digest} · {delivery.subscription.user_agent || "设备信息未记录"}</small> : null}</div><i /></article>; })}</div> : <div className="platform-delivery-empty">没有生成渠道投递记录</div>}</section>)}</div> : <div className="platform-delivery-zero"><span className="material-symbols-outlined">notifications_off</span><strong>这条消息没有通知事件</strong><p>可能没有其他接收人、属于系统消息，或发送时通知已被屏蔽。</p></div>}
  </div>;
}

function PlatformAdminConsole() {
  const { session, logout, setSession } = usePlatformAdminAuth();
  const [section, setSection] = useState<Section>("overview");
  const [dashboard, setDashboard] = useState<PlatformDashboardDTO | null>(null);
  const [spaces, setSpaces] = useState<PlatformAdminSpaceDTO[]>([]);
  const [audit, setAudit] = useState<PlatformAuditDTO[]>([]);
  const [emailDeliveries, setEmailDeliveries] = useState<PlatformEmailDeliveryDTO[]>([]);
  const [emailCursor, setEmailCursor] = useState<number | null>(null);
  const [emailHasMore, setEmailHasMore] = useState(false);
  const [emailLoaded, setEmailLoaded] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailReview, setEmailReview] = useState<PlatformEmailReviewStateDTO | null>(null);
  const [emailReviewBusy, setEmailReviewBusy] = useState(false);
  const [selectedEmailReview, setSelectedEmailReview] = useState<PlatformEmailReviewRecordDTO | null>(null);
  const [emailReviewDetail, setEmailReviewDetail] = useState<PlatformEmailReviewDetailDTO | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<PlatformAdminSpaceDTO | null>(null);
  const [members, setMembers] = useState<PlatformAdminMemberDTO[]>([]);
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
  const [query, setQuery] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ space: PlatformAdminSpaceDTO; approved: boolean } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = async () => {
    const [nextDashboard, nextSpaces, nextAudit] = await Promise.all([api.getPlatformDashboard(), api.getPlatformSpaces(), api.getPlatformAudit()]);
    setDashboard(nextDashboard); setSpaces(nextSpaces); setAudit(nextAudit);
  };
  useEffect(() => { void load().catch((cause) => showToast(cause instanceof Error ? cause.message : "加载失败", "error")); }, []);
  useEffect(() => {
    if (section !== "emails" || emailLoaded || emailLoading) return;
    setEmailLoaded(true);
    setEmailLoading(true);
    void Promise.all([api.getPlatformEmailDeliveries(undefined, 40), api.getPlatformEmailReview()]).then(([deliveries, reviewState]) => {
      setEmailDeliveries(deliveries.items); setEmailCursor(deliveries.next_before); setEmailHasMore(deliveries.has_more); setEmailReview(reviewState);
    }).catch((cause) => showToast(cause instanceof Error ? cause.message : "邮件记录加载失败", "error")).finally(() => setEmailLoading(false));
  }, [emailLoaded, emailLoading, section]);
  useEffect(() => {
    if (section !== "emails" || !emailReview?.enabled) return;
    const timer = window.setInterval(() => {
      void api.getPlatformEmailReview().then(setEmailReview).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [emailReview?.enabled, section]);
  const pendingReviews = useMemo(() => spaces.filter((space) => space.identity_submitted_at && !space.identity_verified_at), [spaces]);
  const visibleSpaces = useMemo(() => { const keyword = query.trim().toLowerCase(); return keyword ? spaces.filter((item) => `${item.name} ${item.slug} ${item.email}`.toLowerCase().includes(keyword)) : spaces; }, [query, spaces]);

  const selectSpace = async (space: PlatformAdminSpaceDTO) => { setSelectedSpace(space); setMembers([]); try { setMembers(await api.getPlatformMembers(space.space_id)); } catch (cause) { showToast(cause instanceof Error ? cause.message : "成员读取失败", "error"); } };
  const confirmChat = async () => { if (!pendingChat || !chatReason.trim()) return; try { const reason = chatReason.trim(); const result = await api.getPlatformChatMessages(pendingChat.chat_id, reason, undefined, selectedMember?.user_id); setOpenChat(result.chat); setMessages(result.messages); setAuditReason(reason); setMessageCursor(result.next_before); setHasOlderMessages(result.has_more); setPendingChat(null); setChatReason(""); } catch (cause) { showToast(cause instanceof Error ? cause.message : "会话读取失败", "error"); } };
  const loadOlderMessages = async () => { if (!openChat || !auditReason || !messageCursor || !hasOlderMessages || loadingOlderMessages) return; setLoadingOlderMessages(true); try { const result = await api.getPlatformChatMessages(openChat.chat_id, auditReason, messageCursor, selectedMember?.user_id); setMessages((current) => [...current, ...result.messages.filter((item) => !current.some((existing) => existing.message_id === item.message_id))]); setMessageCursor(result.next_before); setHasOlderMessages(result.has_more); } catch (cause) { showToast(cause instanceof Error ? cause.message : "更早记录读取失败", "error"); } finally { setLoadingOlderMessages(false); } };
  const inspectDelivery = async (message: ChatMessageDTO) => { setDeliveryMessage(message); setDeliveryAudit(null); try { setDeliveryAudit(await api.getPlatformMessageDeliveries(message.message_id, auditReason)); } catch (cause) { setDeliveryMessage(null); showToast(cause instanceof Error ? cause.message : "投递链路读取失败", "error"); } };
  const loadMoreEmailDeliveries = async () => { if (!emailHasMore || !emailCursor || emailLoading) return; setEmailLoading(true); try { const result = await api.getPlatformEmailDeliveries(emailCursor, 40); setEmailDeliveries((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.delivery_id === item.delivery_id))]); setEmailCursor(result.next_before); setEmailHasMore(result.has_more); } catch (cause) { showToast(cause instanceof Error ? cause.message : "更多邮件记录加载失败", "error"); } finally { setEmailLoading(false); } };
  const refreshEmailReview = async () => { if (emailReviewBusy) return; setEmailReviewBusy(true); try { setEmailReview(await api.getPlatformEmailReview()); } catch (cause) { showToast(cause instanceof Error ? cause.message : "审阅进度刷新失败", "error"); } finally { setEmailReviewBusy(false); } };
  const toggleEmailReview = async () => { if (emailReviewBusy) return; setEmailReviewBusy(true); try { const next = await api.setPlatformEmailReview(!emailReview?.enabled); setEmailReview(next); setSelectedEmailReview(null); setEmailReviewDetail(null); showToast(next.enabled ? "邮件审阅已开启" : next.captured_count >= next.limit ? "已捕获 20 封并自动停止" : "邮件审阅已停止"); } catch (cause) { showToast(cause instanceof Error ? cause.message : "邮件审阅状态更新失败", "error"); } finally { setEmailReviewBusy(false); } };
  const openEmailReview = async (record: PlatformEmailReviewRecordDTO) => { setSelectedEmailReview(record); setEmailReviewDetail(null); try { setEmailReviewDetail(await api.getPlatformEmailReviewDetail(record.record_id)); } catch (cause) { setSelectedEmailReview(null); showToast(cause instanceof Error ? cause.message : "邮件正文读取失败", "error"); } };
  const review = async () => { if (!reviewTarget || (!reviewTarget.approved && !reviewNote.trim())) return; try { await api.reviewPlatformIdentity(reviewTarget.space.space_id, reviewTarget.approved, reviewNote.trim()); showToast(reviewTarget.approved ? "实名认证已通过" : "申请已驳回"); setReviewTarget(null); setReviewNote(""); void load(); } catch (cause) { showToast(cause instanceof Error ? cause.message : "审核失败", "error"); } };
  const setupMfa = async () => { try { const result = await api.beginPlatformMfa(); setMfaSecret(result.secret); setMfaQr(await QRCode.toDataURL(result.otpauth_uri, { width: 320, margin: 1 })); } catch (cause) { showToast(cause instanceof Error ? cause.message : "MFA 配置失败", "error"); } };
  const verifyMfa = async () => { try { const result = await api.verifyPlatformMfa(mfaCode); setRecoveryCodes(result.recovery_codes); setSession(session ? { ...session, mfaEnabled: true } : null); setDashboard((value) => value ? { ...value, mfa_enabled: true } : value); } catch (cause) { showToast(cause instanceof Error ? cause.message : "动态口令无效", "error"); } };

  return <div className="platform-console"><aside className="platform-sidebar"><div className="platform-brand is-console"><img alt="" className="platform-brand-mark" src="/icons/sermo-512.png?v=6"/><div><small>SERMO</small><strong>平台审计台</strong></div></div><nav>{nav.map((item) => <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><span className="material-symbols-outlined">{item.icon}</span><span>{item.label}</span>{item.id === "reviews" && pendingReviews.length ? <i>{pendingReviews.length}</i> : null}</button>)}</nav><div className="platform-admin-identity"><span>{session?.email.slice(0, 1).toUpperCase()}</span><div><strong>超级管理员</strong><small>{session?.email}</small></div><button onClick={logout} type="button"><span className="material-symbols-outlined">logout</span></button></div></aside><main className={`platform-main ${section === "permissions" ? "is-permissions" : ""}`}><header className="platform-header"><div><span>PLATFORM / {section.toUpperCase()}</span><h1>{nav.find((item) => item.id === section)?.label}</h1></div><div className="platform-secure-pill"><i />安全会话</div></header>
    {section === "overview" ? <><section className="platform-hero"><div><span>平台状态</span><h2>保持克制，也保持可见。</h2><p>审计只为处理风险，不替用户做决定。</p></div><span className="material-symbols-outlined">radar</span></section><div className="platform-metrics"><Metric label="运行空间" note="全平台累计" value={dashboard?.spaces ?? 0} /><Metric label="有效成员" note="不含官方账号" value={dashboard?.members ?? 0} /><Metric label="待实名审核" note="需要人工判断" value={dashboard?.pending_identity_reviews ?? 0} /></div><section className="platform-panel"><div className="platform-section-title"><div><span>RECENT ACCESS</span><h3>最近敏感操作</h3></div><button onClick={() => setSection("audit")} type="button">查看全部</button></div><AuditList items={dashboard?.recent_audit ?? []} /></section></> : null}
    {section === "spaces" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>DIRECTORY</span><h3>空间目录</h3></div><label className="platform-search"><span className="material-symbols-outlined">search</span><input onChange={(event) => setQuery(event.target.value)} placeholder="名称、slug 或邮箱" value={query} /></label></div><div className="platform-space-list">{visibleSpaces.map((space) => <SpaceRow key={space.space_id} onClick={() => void selectSpace(space)} space={space} />)}</div></section> : null}
    {section === "permissions" ? <PermissionWorkspace scope="platform" /> : null}
    {section === "reviews" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>IDENTITY QUEUE</span><h3>实名认证</h3></div><small>{pendingReviews.length} 项待处理</small></div>{pendingReviews.length ? pendingReviews.map((space) => <article className="platform-review-card" key={space.space_id}><div><span>{space.name}</span><strong>@{space.slug}</strong><small>提交于 {new Date((space.identity_submitted_at ?? 0) * 1000).toLocaleString()}</small></div><div><button onClick={() => void api.getPlatformIdentityDocument(space.space_id).then((result) => window.open(result.uri, "_blank", "noopener"))} type="button">查看材料</button><button onClick={() => setReviewTarget({ space, approved: false })} type="button">驳回</button><button className="is-approve" onClick={() => setReviewTarget({ space, approved: true })} type="button">通过</button></div></article>) : <div className="platform-empty is-large"><span className="material-symbols-outlined">task_alt</span><strong>审核队列已清空</strong><p>新的实名认证提交会出现在这里。</p></div>}</section> : null}
    {section === "emails" ? <div className="platform-email-workspace"><EmailReviewPanel busy={emailReviewBusy || emailLoading} onOpen={(record) => void openEmailReview(record)} onRefresh={() => void refreshEmailReview()} onToggle={() => void toggleEmailReview()} value={emailReview} /><section className="platform-panel"><div className="platform-section-title"><div><span>DELIVERY HISTORY</span><h3>通知邮件发送记录</h3></div><small>每页 40 条 · 收件地址已脱敏</small></div>{emailDeliveries.length ? <EmailDeliveryList items={emailDeliveries} /> : emailLoading ? <div className="platform-inline-loading"><i />正在读取邮件记录</div> : <div className="platform-empty is-large"><span className="material-symbols-outlined">mail</span><strong>暂无通知邮件</strong><p>后续发送记录会出现在这里。</p></div>}{emailHasMore ? <button className="platform-email-more" disabled={emailLoading} onClick={() => void loadMoreEmailDeliveries()} type="button">{emailLoading ? "正在加载" : "加载更多"}<span className="material-symbols-outlined">expand_more</span></button> : emailDeliveries.length ? <div className="platform-email-end">已显示全部记录</div> : null}</section></div> : null}
    {section === "audit" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>IMMUTABLE TRAIL</span><h3>审计日志</h3></div><small>最近 100 条</small></div><AuditList items={audit} /></section> : null}
    {section === "security" ? <section className="platform-security-grid"><article className="platform-panel"><span className="platform-security-icon material-symbols-outlined">passkey</span><h3>多因素认证</h3><p>在邮箱验证码后增加动态口令。建议始终开启。</p><div className={`platform-status ${dashboard?.mfa_enabled ? "is-on" : ""}`}><i />{dashboard?.mfa_enabled ? "已启用" : "尚未启用"}</div>{!dashboard?.mfa_enabled ? <button className="platform-primary is-compact" onClick={() => void setupMfa()} type="button">开始设置</button> : null}</article><article className="platform-panel"><span className="platform-security-icon material-symbols-outlined">history</span><h3>会话策略</h3><p>令牌仅保存在当前标签会话，8 小时后自动失效。</p><button className="platform-secondary" onClick={logout} type="button">退出当前会话</button></article></section> : null}
  </main><nav className="platform-mobile-nav">{nav.map((item) => <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><span className="material-symbols-outlined">{item.icon}</span><small>{item.label}</small></button>)}</nav>
  <SideDrawer historyKey="platform-space" onClose={() => setSelectedSpace(null)} open={Boolean(selectedSpace)} title={selectedSpace?.name || "空间详情"}>{selectedSpace ? <div className="platform-drawer-stack"><section className="platform-space-summary"><UserAvatar className="platform-profile-avatar" name={selectedSpace.name} uri={selectedSpace.official_user?.avatar_uri} /><div><h2>{selectedSpace.name}</h2><p>@{selectedSpace.slug}</p></div><span className={`platform-tier is-${selectedSpace.verification_tier}`}>{selectedSpace.verification_tier}</span></section><section className="platform-data-grid"><span>成员<strong>{selectedSpace.member_count}</strong></span><span>容量<strong>{selectedSpace.member_limit}</strong></span><span>聊天<strong>{selectedSpace.chat_enabled ? "开启" : "关闭"}</strong></span><span>广场<strong>{selectedSpace.square_enabled ? "开启" : "关闭"}</strong></span></section><section className="platform-panel"><h3>成员</h3>{members.length ? members.map((member) => <button className="platform-member-row" key={member.user_id} onClick={() => setSelectedMember(member)} type="button"><UserAvatar className="platform-member-avatar" name={member.name} uri={member.avatar_uri} /><div><strong>{member.name}</strong><small>LV{member.growth_level ?? 1} · {member.verified ? "已认证" : "未认证"}</small></div><span className="material-symbols-outlined">chevron_right</span></button>) : <div className="platform-inline-loading"><i />正在读取成员</div>}</section></div> : null}</SideDrawer>
  <SideDrawer historyKey="platform-member" onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} title="成员档案">{selectedMember ? <MemberPanel member={selectedMember} onChat={(chat) => setPendingChat(chat)} /> : null}</SideDrawer>
  <InputDialog confirmLabel="记录理由并查看" onChange={setChatReason} onClose={() => { setPendingChat(null); setChatReason(""); }} onConfirm={() => void confirmChat()} open={Boolean(pendingChat)} placeholder="例如：处理用户举报 #20260812" title="为什么需要查看这段会话？" value={chatReason} />
  <InputDialog confirmLabel={reviewTarget?.approved ? "确认通过" : "确认驳回"} onChange={setReviewNote} onClose={() => { setReviewTarget(null); setReviewNote(""); }} onConfirm={() => void review()} open={Boolean(reviewTarget)} placeholder={reviewTarget?.approved ? "审核备注（可选）" : "请填写明确的驳回原因"} title={reviewTarget?.approved ? `通过 ${reviewTarget.space.name} 的实名认证？` : `驳回 ${reviewTarget?.space.name ?? ""} 的申请？`} value={reviewNote} />
  <SideDrawer className="platform-chat-drawer" historyKey="platform-chat" onClose={() => { setOpenChat(null); setMessages([]); setAuditReason(""); setMessageCursor(null); setHasOlderMessages(false); }} open={Boolean(openChat)} title={openChat?.title || "会话审计"}>{openChat ? <AuditConversation chat={openChat} firstPersonUserId={selectedMember?.user_id ?? null} hasMore={hasOlderMessages} loading={loadingOlderMessages} messages={messages} onLoadOlder={loadOlderMessages} onMessage={(message) => void inspectDelivery(message)} /> : null}</SideDrawer>
  <SideDrawer className="platform-delivery-drawer" historyKey="platform-message-delivery" onClose={() => { setDeliveryMessage(null); setDeliveryAudit(null); }} open={Boolean(deliveryMessage)} title="消息推送链路"><DeliveryAudit value={deliveryAudit} /></SideDrawer>
  <SideDrawer className="platform-email-review-drawer" historyKey="platform-email-review" onClose={() => { setSelectedEmailReview(null); setEmailReviewDetail(null); }} open={Boolean(selectedEmailReview)} title="邮件审阅详情"><EmailReviewDetail value={emailReviewDetail} /></SideDrawer>
  <SideDrawer actionDisabled={mfaCode.length !== 6} actionLabel="验证并启用" historyKey="platform-mfa" onAction={() => void verifyMfa()} onClose={() => { setMfaQr(""); setMfaSecret(""); setMfaCode(""); }} open={Boolean(mfaQr)} title="连接验证器"><div className="platform-mfa"><p>使用任意验证器扫描二维码，然后输入 6 位动态口令。</p><img alt="MFA QR code" src={mfaQr} /><code>{mfaSecret}</code><VerificationCodeInput ariaLabel="动态口令" value={mfaCode} onChange={setMfaCode} /></div></SideDrawer>
  <SideDrawer historyKey="platform-recovery" onClose={() => setRecoveryCodes([])} open={recoveryCodes.length > 0} title="保存恢复码"><div className="platform-recovery"><span className="material-symbols-outlined">key</span><h2>仅展示这一次</h2><p>每个恢复码只能使用一次。请离线保存，不要截图上传云端。</p><div>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="platform-primary" onClick={() => setRecoveryCodes([])} type="button">我已安全保存</button></div></SideDrawer></div>;
}

export default function PlatformAdminPage() {
  const { session } = usePlatformAdminAuth();
  return session ? <PlatformAdminConsole /> : <PlatformAdminLogin />;
}
