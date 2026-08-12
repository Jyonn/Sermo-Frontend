import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { InputDialog } from "../components/InputDialog";
import { SideDrawer } from "../components/SideDrawer";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { usePlatformAdminAuth } from "../lib/platformAdminAuth";
import { formatRelativeTime } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { ChatDTO, ChatMessageDTO, PlatformAdminMemberDTO, PlatformAdminSpaceDTO, PlatformAuditDTO, PlatformDashboardDTO } from "../types";

type Section = "overview" | "spaces" | "reviews" | "audit" | "security";
const nav: Array<{ id: Section; icon: string; label: string }> = [
  { id: "overview", icon: "space_dashboard", label: "总览" },
  { id: "spaces", icon: "domain", label: "空间" },
  { id: "reviews", icon: "verified_user", label: "审核" },
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
  const [step, setStep] = useState<"email" | "code" | "mfa">("email");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (step === "email") {
        const result = await api.sendPlatformAdminCode(email);
        setMasked(result.masked_email);
        setStep("code");
        showToast("验证码已发送");
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
      <div className="platform-brand"><span className="platform-brand-mark">S</span><div><small>SERMO CONTROL</small><strong>平台审计台</strong></div></div>
      <div className="platform-login-copy"><span>受保护入口</span><h1>先确认是你</h1><p>{step === "email" ? "使用平台管理员邮箱继续。" : step === "code" ? `验证码已发送至 ${masked}` : "输入验证器中的动态口令。"}</p></div>
      {step === "email" ? <input autoComplete="email" className="platform-field" onChange={(event) => setEmail(event.target.value)} placeholder="管理员邮箱" type="email" value={email} /> : null}
      {step === "code" ? <input autoComplete="one-time-code" className="platform-field is-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" value={code} /> : null}
      {step === "mfa" ? <input autoComplete="one-time-code" className="platform-field is-code" onChange={(event) => setMfa(event.target.value)} placeholder="动态口令或恢复码" value={mfa} /> : null}
      <button className="platform-primary" disabled={busy || (step === "email" ? !email : step === "code" ? code.length !== 6 : !mfa)} onClick={() => void submit()} type="button">{busy ? "正在验证" : step === "email" ? "发送验证码" : "进入审计台"}<span className="material-symbols-outlined">arrow_forward</span></button>
      {step !== "email" ? <button className="platform-text-button" onClick={() => { setStep("email"); setCode(""); setMfa(""); }} type="button">更换邮箱</button> : null}
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

function SpaceRow({ space, onClick }: { space: PlatformAdminSpaceDTO; onClick: () => void }) {
  return <button className="platform-space-row" onClick={onClick} type="button"><UserAvatar className="platform-space-avatar" name={space.name} uri={space.official_user?.avatar_uri} /><div><strong>{space.name}</strong><small>@{space.slug} · {space.member_count}/{space.member_limit} 人</small></div><span className={`platform-tier is-${space.verification_tier}`}>{space.verification_tier === "identity" ? "实名" : space.verification_tier === "phone" ? "手机" : "邮箱"}</span><span className="material-symbols-outlined">chevron_right</span></button>;
}

function MemberPanel({ member, onChat }: { member: PlatformAdminMemberDTO; onChat: (chat: ChatDTO) => void }) {
  const [chats, setChats] = useState<ChatDTO[] | null>(null);
  useEffect(() => { const controller = new AbortController(); void api.getPlatformMemberChats(member.user_id, controller.signal).then(setChats).catch(() => undefined); return () => controller.abort(); }, [member.user_id]);
  return <div className="platform-drawer-stack"><section className="platform-profile"><UserAvatar className="platform-profile-avatar" frame={member.avatar_frame_style} name={member.name} uri={member.avatar_uri} vip={member.is_permanent_vip} /><div><h2>{member.name}</h2><p>LV{member.growth_level ?? 1} · {member.verified ? "已认证" : "未认证"}</p></div></section><section className="platform-data-grid"><span>好友<strong>{member.friend_count}</strong></span><span>会话<strong>{member.chat_count}</strong></span><span>发言<strong>{member.statement_count}</strong></span><span>提醒渠道<strong>{member.notifications_enabled}</strong></span></section><section className="platform-panel"><h3>认证与绑定</h3><div className="platform-contact-strip">{Object.entries(member.contacts).map(([key, bound]) => <span className={bound ? "is-on" : ""} key={key}>{key === "phone" ? "手机" : key === "email" ? "邮箱" : "即时"}<i>{bound ? "已绑定" : "未绑定"}</i></span>)}</div></section><section className="platform-panel"><h3>会话列表</h3>{chats === null ? <div className="platform-inline-loading"><i />正在读取摘要</div> : chats.length ? chats.map((chat) => <button className="platform-chat-row" key={chat.chat_id} onClick={() => onChat(chat)} type="button"><UserAvatar className="platform-chat-avatar" groupMembers={chat.group ? chat.members.map((item) => ({ name: item.name, uri: item.avatar_uri })) : undefined} name={chat.title || chat.members[0]?.name || "会话"} /><div><strong>{chat.title || chat.members.map((item) => item.name).join("、")}</strong><small>{chat.last_message?.content || "暂无消息"}</small></div><time>{time(chat.last_chat_at)}</time></button>) : <div className="platform-empty">暂无会话</div>}</section></div>;
}

function AuditConversation({ chat, messages }: { chat: ChatDTO; messages: ChatMessageDTO[] }) {
  const ordered = [...messages].reverse();
  const firstUser = chat.members[0]?.user_id;
  return <div className="platform-conversation"><div className="platform-conversation-notice"><span className="material-symbols-outlined">visibility</span>只读审计视图</div>{ordered.map((message, index) => { const self = message.user.user_id === firstUser; const previous = ordered[index - 1]; const showTime = !previous || message.created_at - previous.created_at > 300; return <div key={message.message_id}>{showTime ? <div className="platform-message-time">{new Date(message.created_at * 1000).toLocaleString()}</div> : null}<div className={`platform-message-row ${self ? "self" : "other"}`}><UserAvatar className="platform-message-avatar" name={message.user.name} uri={message.user.avatar_uri} /><div><small>{message.user.name}</small><div className={`platform-message-bubble is-type-${message.type}`}>{message.type === 1 && message.payload?.uri ? <img alt="审计图片" src={message.payload.thumbnail_uri || message.payload.uri} /> : message.type === 4 ? <span>语音 · {message.payload?.duration_seconds ?? 0} 秒</span> : message.type === 5 ? <span>视频 · {message.payload?.duration_seconds ?? 0} 秒</span> : message.type === 2 ? <span>文件 · {message.payload?.file_name || message.content}</span> : <span>{message.payload?.address || message.content || "[多媒体消息]"}</span>}</div></div></div></div>; })}</div>;
}

function PlatformAdminConsole() {
  const { session, logout, setSession } = usePlatformAdminAuth();
  const [section, setSection] = useState<Section>("overview");
  const [dashboard, setDashboard] = useState<PlatformDashboardDTO | null>(null);
  const [spaces, setSpaces] = useState<PlatformAdminSpaceDTO[]>([]);
  const [audit, setAudit] = useState<PlatformAuditDTO[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<PlatformAdminSpaceDTO | null>(null);
  const [members, setMembers] = useState<PlatformAdminMemberDTO[]>([]);
  const [selectedMember, setSelectedMember] = useState<PlatformAdminMemberDTO | null>(null);
  const [pendingChat, setPendingChat] = useState<ChatDTO | null>(null);
  const [chatReason, setChatReason] = useState("");
  const [openChat, setOpenChat] = useState<ChatDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
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
  const pendingReviews = useMemo(() => spaces.filter((space) => space.identity_submitted_at && !space.identity_verified_at), [spaces]);
  const visibleSpaces = useMemo(() => { const keyword = query.trim().toLowerCase(); return keyword ? spaces.filter((item) => `${item.name} ${item.slug} ${item.email}`.toLowerCase().includes(keyword)) : spaces; }, [query, spaces]);

  const selectSpace = async (space: PlatformAdminSpaceDTO) => { setSelectedSpace(space); setMembers([]); try { setMembers(await api.getPlatformMembers(space.space_id)); } catch (cause) { showToast(cause instanceof Error ? cause.message : "成员读取失败", "error"); } };
  const confirmChat = async () => { if (!pendingChat || !chatReason.trim()) return; try { const result = await api.getPlatformChatMessages(pendingChat.chat_id, chatReason.trim()); setOpenChat(result.chat); setMessages(result.messages); setPendingChat(null); setChatReason(""); } catch (cause) { showToast(cause instanceof Error ? cause.message : "会话读取失败", "error"); } };
  const review = async () => { if (!reviewTarget || (!reviewTarget.approved && !reviewNote.trim())) return; try { await api.reviewPlatformIdentity(reviewTarget.space.space_id, reviewTarget.approved, reviewNote.trim()); showToast(reviewTarget.approved ? "实名认证已通过" : "申请已驳回"); setReviewTarget(null); setReviewNote(""); void load(); } catch (cause) { showToast(cause instanceof Error ? cause.message : "审核失败", "error"); } };
  const setupMfa = async () => { try { const result = await api.beginPlatformMfa(); setMfaSecret(result.secret); setMfaQr(await QRCode.toDataURL(result.otpauth_uri, { width: 320, margin: 1 })); } catch (cause) { showToast(cause instanceof Error ? cause.message : "MFA 配置失败", "error"); } };
  const verifyMfa = async () => { try { const result = await api.verifyPlatformMfa(mfaCode); setRecoveryCodes(result.recovery_codes); setSession(session ? { ...session, mfaEnabled: true } : null); setDashboard((value) => value ? { ...value, mfa_enabled: true } : value); } catch (cause) { showToast(cause instanceof Error ? cause.message : "动态口令无效", "error"); } };

  return <div className="platform-console"><aside className="platform-sidebar"><div className="platform-brand is-console"><span className="platform-brand-mark">S</span><div><small>SERMO</small><strong>平台审计台</strong></div></div><nav>{nav.map((item) => <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><span className="material-symbols-outlined">{item.icon}</span><span>{item.label}</span>{item.id === "reviews" && pendingReviews.length ? <i>{pendingReviews.length}</i> : null}</button>)}</nav><div className="platform-admin-identity"><span>{session?.email.slice(0, 1).toUpperCase()}</span><div><strong>超级管理员</strong><small>{session?.email}</small></div><button onClick={logout} type="button"><span className="material-symbols-outlined">logout</span></button></div></aside><main className="platform-main"><header className="platform-header"><div><span>PLATFORM / {section.toUpperCase()}</span><h1>{nav.find((item) => item.id === section)?.label}</h1></div><div className="platform-secure-pill"><i />安全会话</div></header>
    {section === "overview" ? <><section className="platform-hero"><div><span>平台状态</span><h2>保持克制，也保持可见。</h2><p>审计只为处理风险，不替用户做决定。</p></div><span className="material-symbols-outlined">radar</span></section><div className="platform-metrics"><Metric label="运行空间" note="全平台累计" value={dashboard?.spaces ?? 0} /><Metric label="有效成员" note="不含官方账号" value={dashboard?.members ?? 0} /><Metric label="待实名审核" note="需要人工判断" value={dashboard?.pending_identity_reviews ?? 0} /></div><section className="platform-panel"><div className="platform-section-title"><div><span>RECENT ACCESS</span><h3>最近敏感操作</h3></div><button onClick={() => setSection("audit")} type="button">查看全部</button></div><AuditList items={dashboard?.recent_audit ?? []} /></section></> : null}
    {section === "spaces" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>DIRECTORY</span><h3>空间目录</h3></div><label className="platform-search"><span className="material-symbols-outlined">search</span><input onChange={(event) => setQuery(event.target.value)} placeholder="名称、slug 或邮箱" value={query} /></label></div><div className="platform-space-list">{visibleSpaces.map((space) => <SpaceRow key={space.space_id} onClick={() => void selectSpace(space)} space={space} />)}</div></section> : null}
    {section === "reviews" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>IDENTITY QUEUE</span><h3>实名认证</h3></div><small>{pendingReviews.length} 项待处理</small></div>{pendingReviews.length ? pendingReviews.map((space) => <article className="platform-review-card" key={space.space_id}><div><span>{space.name}</span><strong>@{space.slug}</strong><small>提交于 {new Date((space.identity_submitted_at ?? 0) * 1000).toLocaleString()}</small></div><div><button onClick={() => void api.getPlatformIdentityDocument(space.space_id).then((result) => window.open(result.uri, "_blank", "noopener"))} type="button">查看材料</button><button onClick={() => setReviewTarget({ space, approved: false })} type="button">驳回</button><button className="is-approve" onClick={() => setReviewTarget({ space, approved: true })} type="button">通过</button></div></article>) : <div className="platform-empty is-large"><span className="material-symbols-outlined">task_alt</span><strong>审核队列已清空</strong><p>新的实名认证提交会出现在这里。</p></div>}</section> : null}
    {section === "audit" ? <section className="platform-panel is-fill"><div className="platform-section-title"><div><span>IMMUTABLE TRAIL</span><h3>审计日志</h3></div><small>最近 100 条</small></div><AuditList items={audit} /></section> : null}
    {section === "security" ? <section className="platform-security-grid"><article className="platform-panel"><span className="platform-security-icon material-symbols-outlined">passkey</span><h3>多因素认证</h3><p>在邮箱验证码后增加动态口令。建议始终开启。</p><div className={`platform-status ${dashboard?.mfa_enabled ? "is-on" : ""}`}><i />{dashboard?.mfa_enabled ? "已启用" : "尚未启用"}</div>{!dashboard?.mfa_enabled ? <button className="platform-primary is-compact" onClick={() => void setupMfa()} type="button">开始设置</button> : null}</article><article className="platform-panel"><span className="platform-security-icon material-symbols-outlined">history</span><h3>会话策略</h3><p>令牌仅保存在当前标签会话，8 小时后自动失效。</p><button className="platform-secondary" onClick={logout} type="button">退出当前会话</button></article></section> : null}
  </main><nav className="platform-mobile-nav">{nav.map((item) => <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><span className="material-symbols-outlined">{item.icon}</span><small>{item.label}</small></button>)}</nav>
  <SideDrawer historyKey="platform-space" onClose={() => setSelectedSpace(null)} open={Boolean(selectedSpace)} title={selectedSpace?.name || "空间详情"}>{selectedSpace ? <div className="platform-drawer-stack"><section className="platform-space-summary"><UserAvatar className="platform-profile-avatar" name={selectedSpace.name} uri={selectedSpace.official_user?.avatar_uri} /><div><h2>{selectedSpace.name}</h2><p>@{selectedSpace.slug}</p></div><span className={`platform-tier is-${selectedSpace.verification_tier}`}>{selectedSpace.verification_tier}</span></section><section className="platform-data-grid"><span>成员<strong>{selectedSpace.member_count}</strong></span><span>容量<strong>{selectedSpace.member_limit}</strong></span><span>聊天<strong>{selectedSpace.chat_enabled ? "开启" : "关闭"}</strong></span><span>广场<strong>{selectedSpace.square_enabled ? "开启" : "关闭"}</strong></span></section><section className="platform-panel"><h3>成员</h3>{members.length ? members.map((member) => <button className="platform-member-row" key={member.user_id} onClick={() => setSelectedMember(member)} type="button"><UserAvatar className="platform-member-avatar" name={member.name} uri={member.avatar_uri} /><div><strong>{member.name}</strong><small>LV{member.growth_level ?? 1} · {member.verified ? "已认证" : "未认证"}</small></div><span className="material-symbols-outlined">chevron_right</span></button>) : <div className="platform-inline-loading"><i />正在读取成员</div>}</section></div> : null}</SideDrawer>
  <SideDrawer historyKey="platform-member" onClose={() => setSelectedMember(null)} open={Boolean(selectedMember)} title="成员档案">{selectedMember ? <MemberPanel member={selectedMember} onChat={(chat) => setPendingChat(chat)} /> : null}</SideDrawer>
  <InputDialog confirmLabel="记录理由并查看" onChange={setChatReason} onClose={() => { setPendingChat(null); setChatReason(""); }} onConfirm={() => void confirmChat()} open={Boolean(pendingChat)} placeholder="例如：处理用户举报 #20260812" title="为什么需要查看这段会话？" value={chatReason} />
  <InputDialog confirmLabel={reviewTarget?.approved ? "确认通过" : "确认驳回"} onChange={setReviewNote} onClose={() => { setReviewTarget(null); setReviewNote(""); }} onConfirm={() => void review()} open={Boolean(reviewTarget)} placeholder={reviewTarget?.approved ? "审核备注（可选）" : "请填写明确的驳回原因"} title={reviewTarget?.approved ? `通过 ${reviewTarget.space.name} 的实名认证？` : `驳回 ${reviewTarget?.space.name ?? ""} 的申请？`} value={reviewNote} />
  <SideDrawer className="platform-chat-drawer" historyKey="platform-chat" onClose={() => { setOpenChat(null); setMessages([]); }} open={Boolean(openChat)} title={openChat?.title || "会话审计"}>{openChat ? <AuditConversation chat={openChat} messages={messages} /> : null}</SideDrawer>
  <SideDrawer actionDisabled={mfaCode.length !== 6} actionLabel="验证并启用" historyKey="platform-mfa" onAction={() => void verifyMfa()} onClose={() => { setMfaQr(""); setMfaSecret(""); setMfaCode(""); }} open={Boolean(mfaQr)} title="连接验证器"><div className="platform-mfa"><p>使用任意验证器扫描二维码，然后输入 6 位动态口令。</p><img alt="MFA QR code" src={mfaQr} /><code>{mfaSecret}</code><input className="platform-field is-code" inputMode="numeric" maxLength={6} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" value={mfaCode} /></div></SideDrawer>
  <SideDrawer historyKey="platform-recovery" onClose={() => setRecoveryCodes([])} open={recoveryCodes.length > 0} title="保存恢复码"><div className="platform-recovery"><span className="material-symbols-outlined">key</span><h2>仅展示这一次</h2><p>每个恢复码只能使用一次。请离线保存，不要截图上传云端。</p><div>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="platform-primary" onClick={() => setRecoveryCodes([])} type="button">我已安全保存</button></div></SideDrawer></div>;
}

export default function PlatformAdminPage() {
  const { session } = usePlatformAdminAuth();
  return session ? <PlatformAdminConsole /> : <PlatformAdminLogin />;
}
