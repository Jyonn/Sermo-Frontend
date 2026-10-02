import { useState } from "react";
import "../styles/blocked-words-lab.css";

type Rule = { id: number; word: string; owner: string; date: string };
type Proposal = { id: number; word: string; owner: string; date: string; status: "pending" | "approved" | "rejected" | "withdrawn" };

const initialRules: Rule[] = [
  { id: 1, word: "剧透", owner: "Fly", date: "10月2日" },
  { id: 2, word: "广告链接", owner: "小久", date: "9月28日" },
  { id: 3, word: "刷屏", owner: "我", date: "9月20日" },
];
const initialProposals: Proposal[] = [
  { id: 11, word: "人身攻击", owner: "小久", date: "今天 14:36", status: "pending" },
  { id: 12, word: "未经证实", owner: "我", date: "昨天 21:10", status: "pending" },
  { id: 13, word: "无意义复制", owner: "Fly", date: "9月25日", status: "approved" },
];
const variants = [
  { key: "list", number: "01", name: "静序清单", detail: "最接近现有详情页，规则与申请分层" },
  { key: "board", number: "02", name: "分区工作台", detail: "左侧规则，右侧审批，适合群主" },
  { key: "people", number: "03", name: "共治档案", detail: "以归属人组织内容，单聊尤其清楚" },
  { key: "timeline", number: "04", name: "治理时间线", detail: "强调来龙去脉与状态变化" },
] as const;

type Variant = typeof variants[number]["key"];

export default function BlockedWordsLabPage() {
  const [variant, setVariant] = useState<Variant>("list");
  const [mode, setMode] = useState<"group" | "direct">("group");
  const [role, setRole] = useState<"owner" | "member">("owner");
  const [dark, setDark] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [proposals, setProposals] = useState(initialProposals);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const selected = variants.find((item) => item.key === variant)!;
  const visibleRules = rules.filter((item) => (mode === "group" || item.owner === "我" || item.owner === "Fly") && (item.word.includes(query) || item.owner.includes(query)));
  const visibleProposals = proposals.filter((item) => item.word.includes(query) || item.owner.includes(query));
  const canManage = mode === "direct" || role === "owner";
  const ownCount = rules.filter((item) => item.owner === "我").length;
  const limit = mode === "direct" ? 25 : 50;
  const used = mode === "direct" ? ownCount : rules.length;

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const add = () => {
    const word = input.trim();
    if (!word) return;
    if ([...rules, ...proposals.filter((item) => item.status === "pending")].some((item) => item.word === word)) {
      announce("这个词已存在，或正在等待审批");
      return;
    }
    if (used >= limit) {
      announce("已达到词数上限");
      return;
    }
    if (mode === "group" && role === "member" && proposals.filter((item) => item.owner === "我" && item.status === "pending").length >= 3) {
      announce("每人最多同时有 3 条待审批申请");
      return;
    }
    if (canManage) {
      setRules((current) => [{ id: Date.now(), word, owner: "我", date: "刚刚" }, ...current]);
      announce("已加入会话规则");
    } else {
      setProposals((current) => [{ id: Date.now(), word, owner: "我", date: "刚刚", status: "pending" }, ...current]);
      announce("申请已发送给群主");
    }
    setInput("");
  };
  const resolve = (id: number, status: Proposal["status"]) => {
    const proposal = proposals.find((item) => item.id === id);
    if (!proposal) return;
    setProposals((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    if (status === "approved") setRules((current) => [{ id: Date.now(), word: proposal.word, owner: proposal.owner, date: "刚刚" }, ...current]);
    announce(status === "approved" ? "申请已通过" : status === "withdrawn" ? "申请已撤回" : "申请已驳回");
  };
  const remove = (id: number) => {
    setRules((current) => current.filter((item) => item.id !== id));
    setConfirmId(null);
    announce("已从会话规则移除");
  };
  const RuleItem = ({ item }: { item: Rule }) => (
    <article className="bw-rule" key={item.id}>
      <span className="bw-rule-mark material-symbols-outlined" aria-hidden="true">block</span>
      <span className="bw-rule-main"><strong>{item.word}</strong><small>由 {item.owner} 设置 · {item.date}</small></span>
      {(mode === "group" ? role === "owner" : item.owner === "我") ? <button aria-label={`移除${item.word}`} className="bw-icon-button" onClick={() => setConfirmId(item.id)} type="button"><span className="material-symbols-outlined">close</span></button> : <span className="bw-lock material-symbols-outlined" aria-label="仅设置者可移除">lock</span>}
    </article>
  );
  const ProposalItem = ({ item }: { item: Proposal }) => (
    <article className={`bw-proposal is-${item.status}`} key={item.id}>
      <span className="bw-owner-avatar">{item.owner === "我" ? "我" : item.owner.slice(0, 1)}</span>
      <span className="bw-proposal-main"><small>{item.owner} · {item.date}</small><strong>{item.word}</strong><em>{item.status === "pending" ? "等待群主审批" : item.status === "approved" ? "已通过" : item.status === "withdrawn" ? "已撤回" : "已驳回"}</em></span>
      {item.status === "pending" ? <span className="bw-proposal-actions">{role === "owner" ? <><button onClick={() => resolve(item.id, "approved")} type="button">同意</button><button onClick={() => resolve(item.id, "rejected")} type="button">驳回</button></> : item.owner === "我" ? <button onClick={() => resolve(item.id, "withdrawn")} type="button">撤回</button> : null}</span> : null}
    </article>
  );

  return <main className={`bw-lab theme-${dark ? "dark" : "light"} variant-${variant}`}>
    <div className="bw-lab-shell">
      <header className="bw-lab-top">
        <div><span className="bw-eyebrow">SERMO / INTERACTION STUDY</span><h1>让规则看得见</h1><p>屏蔽词是会话共同的边界，也应该有清楚的归属与过程。</p></div>
        <button className="bw-theme-button" onClick={() => setDark(!dark)} type="button"><span className="material-symbols-outlined">{dark ? "light_mode" : "dark_mode"}</span>{dark ? "亮色" : "暗色"}</button>
      </header>
      <nav aria-label="设计方案" className="bw-variants">{variants.map((item) => <button aria-current={variant === item.key ? "page" : undefined} className={variant === item.key ? "active" : ""} key={item.key} onClick={() => setVariant(item.key)} type="button"><small>{item.number}</small><strong>{item.name}</strong><span>{item.detail}</span></button>)}</nav>
      <div className="bw-lab-meta"><span>当前方案 / <strong>{selected.name}</strong></span><div><button className={mode === "group" ? "active" : ""} onClick={() => setMode("group")} type="button">群聊</button><button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")} type="button">单聊</button>{mode === "group" ? <><i /><button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")} type="button">群主视角</button><button className={role === "member" ? "active" : ""} onClick={() => setRole("member")} type="button">成员视角</button></> : null}</div></div>
      <section className="bw-stage">
        <aside className="bw-stage-note"><span className="bw-eyebrow">{selected.number} / 04</span><h2>{selected.name}</h2><p>{selected.detail}</p><div className="bw-note-line"><span>生效机制</span><strong>{mode === "group" ? "群主审批" : "双方共同生效"}</strong></div><div className="bw-note-line"><span>操作演示</span><strong>新增 · 审批 · 移除</strong></div></aside>
        <div className="bw-device">
          <div className="bw-device-top"><button aria-label="返回" type="button"><span className="material-symbols-outlined">arrow_back</span></button><span><strong>屏蔽词</strong><small>{mode === "group" ? "百星俱乐部 · 群聊规则" : "和 Fly 的聊天 · 双方规则"}</small></span><span className="bw-device-dot">•••</span></div>
          <div className="bw-device-scroll">
            {variant === "board" ? <div className="bw-board-banner"><small>THE RULE DESK</small><strong>给对话留一点边界</strong><p>词语一旦生效，所有人发送时都会被检查。</p></div> : null}
            {variant === "timeline" ? <div className="bw-timeline-hero"><small>共同维护 · 清晰可溯</small><strong>{String(used).padStart(2, "0")}<span> / {limit}</span></strong><p>条生效中的会话规则</p></div> : null}
            {variant === "people" ? <div className="bw-people-hero"><div className="bw-people-stack"><span>我</span><span>F</span><span>小</span></div><strong>我们共同定下的词</strong><small>每条规则都能找到它的提出者</small></div> : null}
            {variant === "list" ? <div className="bw-list-hero"><span className="material-symbols-outlined">shield</span><div><strong>让聊天保持舒适</strong><p>{mode === "group" ? "群成员可以提议，由群主决定是否生效。" : "双方各自设置，生效后同时限制双方发送。"}</p></div></div> : null}
            <div className="bw-search"><span className="material-symbols-outlined">search</span><input aria-label="搜索屏蔽词" onChange={(event) => setQuery(event.target.value)} placeholder="搜索词语或设置者" value={query} /></div>
            {variant === "people" ? <div className="bw-owner-groups">{(mode === "group" ? ["我", "Fly", "小久"] : ["我", "Fly"]).map((owner) => <section key={owner}><h3><span className="bw-owner-avatar">{owner === "我" ? "我" : owner.slice(0, 1)}</span>{owner}<small>{visibleRules.filter((item) => item.owner === owner).length} 条</small></h3>{visibleRules.filter((item) => item.owner === owner).map((item) => <RuleItem item={item} key={item.id} />)}</section>)}</div> : <section className="bw-rules"><div className="bw-section-heading"><span><small>{variant === "timeline" ? "CURRENT RULES" : "01 / ACTIVE"}</small><h3>生效中的词</h3></span><em>{used} / {limit}</em></div>{visibleRules.length ? visibleRules.map((item) => <RuleItem item={item} key={item.id} />) : <p className="bw-empty">还没有匹配的规则</p>}</section>}
            {mode === "group" ? <section className="bw-requests"><div className="bw-section-heading"><span><small>{variant === "timeline" ? "DECISION LOG" : "02 / REVIEW"}</small><h3>{variant === "timeline" ? "审批轨迹" : "申请与记录"}</h3></span><em>{visibleProposals.filter((item) => item.status === "pending").length} 待处理</em></div>{visibleProposals.map((item) => <ProposalItem item={item} key={item.id} />)}</section> : null}
          </div>
          <form className="bw-compose" onSubmit={(event) => { event.preventDefault(); add(); }}><label htmlFor="bw-word">{canManage ? "添加会话屏蔽词" : "向群主发起申请"}</label><div><input id="bw-word" maxLength={20} onChange={(event) => setInput(event.target.value)} placeholder="输入一个词或短语" value={input} /><button disabled={!input.trim()} type="submit"><span className="material-symbols-outlined">add</span>{canManage ? "添加" : "申请"}</button></div><small>{mode === "group" ? "最多 50 条 · 所有人包括群主均受约束" : "每人 25 条 · 双方发送时都会检查"}</small></form>
        </div>
      </section>
    </div>
    {confirmId !== null ? <div className="bw-dialog-scrim" role="presentation" onClick={() => setConfirmId(null)}><div aria-labelledby="bw-dialog-title" aria-modal="true" className="bw-dialog" onClick={(event) => event.stopPropagation()} role="dialog"><span className="material-symbols-outlined">delete_outline</span><h2 id="bw-dialog-title">移除这条屏蔽词？</h2><p>移除后，这个词将不再阻止新消息发送。已有消息不受影响。</p><div><button onClick={() => setConfirmId(null)} type="button">保留</button><button onClick={() => remove(confirmId)} type="button">移除规则</button></div></div></div> : null}
    {toast ? <div aria-live="polite" className="bw-toast">{toast}</div> : null}
  </main>;
}
