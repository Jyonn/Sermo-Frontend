import { useRef, useState, type FormEvent } from "react";
import type { ReportKind, ResearchMilestone, ResearchAward, ResearchReward, ResearchProject, ResearchReimbursement, ResearchTask } from "../lib/research";
import { useI18n, type TranslationKey } from "../lib/language";
import { useResearchDraft } from "../lib/researchDraft";
import { reportKinds as kinds, researchDate, researchToday } from "../lib/researchWorkbench";
import { DurationPickerField } from "./DurationPickerField";
import { FormSelectField } from "./FormSelectField";
import { ResearchAwardForm } from "./ResearchAwardForm";
import { ResearchRewardEditor } from "./ResearchRewardEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { SideDrawer } from "./SideDrawer";
import { SettingRow, SettingSwitch, SelectControl } from "./SettingRow";
import { PageTabs } from "./PageTabs";
import { QuietState } from "./BoundaryState";
import { MarkdownInput } from "./ResearchMarkdownInput";
import { Markdown } from "./ResearchMarkdown";
import { DatePickerField } from "./DatePickerField";
import { DateRangeField } from "./DateRangeField";
import { ResearchAssigneesField } from "./ResearchPeople";
import { ResearchReimbursementComposer, ResearchReimbursementItems } from "./ResearchReimbursementComposer";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import "./ResearchWorkflow.css";

export type ResearchMutation = (body: Record<string, unknown>) => Promise<boolean | undefined>;
export const defaultResearchRewards = ["silver", "gold", "diamond"].map(id => ({ id, name: "", description: "" }));

export function ResearchTimeline({ project, editable, mutate }: { project: ResearchProject; editable: boolean; mutate: ResearchMutation }) {
  const { t, language } = useI18n();
  const [selected, setSelected] = useState<ResearchMilestone | null>(null);
  const [mode, setMode] = useState<"read" | "edit" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = project.workflow?.report_periods.daily || researchToday();
  const [date, setDate] = useState(today);
  const form = useRef<HTMLFormElement>(null);
  const entries = [...(project.workflow?.milestones ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = entries.filter(flag => flag.date >= today);
  const past = entries.filter(flag => flag.date < today).reverse();

  function edit(flag: ResearchMilestone | null) {
    setError("");
    setSelected(flag);
    setDate(flag?.date ?? (today < project.start || project.end && today > project.end ? project.start : today));
    setMode("edit");
  }
  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    const data = event ? new FormData(event.currentTarget) : null;
    setBusy(true);
    setError("");
    try {
      const ok = await mutate(mode === "remove"
        ? { action: "milestone", id: selected?.id, delete: true }
        : { action: "milestone", id: selected?.id, date: data?.get("date"), title: data?.get("title"), body: data?.get("body") || "" });
      if (ok) setMode(null);
      else setError(t("research.failed"));
    } finally { setBusy(false); }
  }
  function item(flag: ResearchMilestone) {
    return <button key={flag.id} type="button" className="research-workbench-row research-workbench-milestone"
      onClick={() => { setSelected(flag); setError(""); setMode("read"); }}>
      <time dateTime={flag.date}>{researchDate(flag.date, language)}</time><strong>{flag.title}</strong>
      <span className="material-symbols-outlined research-workbench-arrow" aria-hidden="true">chevron_right</span>
    </button>;
  }
  return <section className="research-workbench-section">
    <header className="research-workbench-section-head">
      <h3>{t("researchFlow.milestone")}</h3>
      {editable && <button type="button" className="research-inline-action" onClick={() => edit(null)}>{t("common.add")}</button>}
    </header>
    {entries.length ? <div className="research-workbench-list">
      {upcoming.map(item)}
      {past.length > 0 && <details className="research-workbench-description" open={upcoming.length === 0 || undefined}>
        <summary>{t("researchWorkbench.pastMilestones")}</summary>{past.map(item)}
      </details>}
    </div> : <p className="research-workbench-empty">{t("researchFlow.milestoneEmpty")}</p>}
    <ConfirmDialog open={Boolean(mode)} className="research-milestone-dialog"
      title={mode === "remove" ? t("researchWorkbench.deleteMilestone") : mode === "edit" ? t("researchFlow.milestone") : selected?.title || t("researchFlow.milestone")}
      description={mode === "edit" || !selected ? "" : researchDate(selected.date, language)}
      confirmLabel={t(mode === "edit" ? "research.save" : mode === "remove" ? "common.delete" : "common.close")}
      showCancelButton={mode !== "read"} danger={mode === "remove"} busy={busy}
      onClose={() => { if (!busy) setMode(null); }}
      onConfirm={() => { if (mode === "edit") form.current?.requestSubmit(); else if (mode === "remove") void save(); else setMode(null); }}>
      {mode === "edit" ? <form key={selected?.id || "new"} ref={form} className="research-form" onSubmit={save}>
        <label>{t("research.name")}<input name="title" defaultValue={selected?.title} required maxLength={160} /></label>
        <DatePickerField label={t("researchFlow.date")} name="date" value={date} onChange={setDate} min={project.start} max={project.end || undefined} required />
        <MarkdownInput initialValue={selected?.body} rows={4} />
      </form> : mode === "read" && selected && <div className="research-form research-milestone-content">
        {selected.body && <Markdown body={selected.body} />}
        {editable && <div className="research-flow-actions">
          <button className="ghost-button" type="button" onClick={() => edit(selected)}>{t("researchFlow.edit")}</button>
          <button className="ghost-button" type="button" onClick={() => setMode("remove")}>{t("common.delete")}</button>
        </div>}
      </div>}
      {error && <p className="research-form-error" role="alert">{error}</p>}
    </ConfirmDialog>
  </section>;
}

export function ResearchTaskEditor({ project, task, busy, error, onSave }: {
  project: ResearchProject; task?: ResearchTask; busy: boolean; error?: string; onSave: ResearchMutation;
}) {
  const { t } = useI18n();
  const activeIds = new Set(project.members.map(member => member.id));
  const [body, setBody] = useState(task?.body ?? "");
  const [validation, setValidation] = useState("");
  const [rules, setRules] = useState(task?.reporting ?? {});
  const [range, setRange] = useState(() => ({
    from: task?.start || project.workflow?.report_periods.daily || researchToday(), to: task?.end ?? "",
  }));
  const [assignees, setAssignees] = useState(() => (task?.assignees ?? []).filter(id => activeIds.has(id)));
  const rewards = project.workflow?.reward_types || defaultResearchRewards;
  const kind = kinds.find(value => rules[value]) || "none";
  const rule = kind === "none" ? undefined : rules[kind];

  return <form className="research-form research-task-editor" onSubmit={event => {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    const members = assignees.filter(id => activeIds.has(id));
    if (!members.length) { setValidation(t("researchWorkbench.pickAssignees")); return; }
    if (!title || !body.trim() || busy) return;
    setValidation("");
    void onSave({ action: task ? "task_edit" : "task", task_id: task?.id, title, body, start: range.from,
      end: range.to || null, assignees: members, reporting: kind === "none" || !rule ? {} : { [kind]: rule } });
  }}>
    <label>{t("researchFlow.taskName")}<input name="title" defaultValue={task?.title} maxLength={160} required disabled={busy} /></label>
    <ResearchAssigneesField members={project.members} selected={assignees} onChange={ids => { setAssignees(ids); setValidation(""); }} disabled={busy} />
    <DateRangeField value={range} onChange={setRange} />
    <section className="research-task-editor-section">
      <h3>{t("researchFlow.taskInstructions")}</h3>
      <MarkdownInput value={body} onChange={setBody} rows={5} required mobileImmersive={false} workspace />
    </section>
    <section className="research-task-editor-section">
      <SelectControl value={kind} label={t("researchFlow.reportSchedule")} disabled={busy}
        options={["none", ...kinds].map(value => ({ value, label: t(`researchFlow.frequency.${value}` as TranslationKey) }))}
        onChange={value => setRules(value === "none" ? {} : { [value]: rules[value as ReportKind] || { amount: 0, reward_type: rewards[0].id } })} />
      {kind !== "none" && rule && <details className="research-form-options" open={rule.amount > 0 || undefined}>
        <summary>{t("researchWorkbench.reportRewards")}</summary>
        <div className="research-task-report-reward">
          <SelectControl label={t("researchFlow.reward")} value={rule.reward_type || rewards[0].id}
            options={rewards.map(reward => ({ value: reward.id, label: reward.name || t(`researchFlow.${reward.id}` as TranslationKey) }))}
            onChange={value => setRules({ [kind]: { ...rule, reward_type: value } })} disabled={busy} />
          <label>{t("researchFlow.rewardAmount")}<input type="number" inputMode="numeric" min={0} max={10000}
            value={rule.amount} onChange={event => setRules({ [kind]: { ...rule, amount: Number(event.target.value) } })} disabled={busy} /></label>
        </div>
      </details>}
    </section>
    {(validation || error) && <p className="research-form-error" role="alert">{validation || error}</p>}
    <footer className="research-task-editor-footer">
      <button className="button" type="submit" disabled={busy || !body.trim()}>{t(busy ? "common.processing" : task ? "research.save" : "research.addTask")}</button>
    </footer>
  </form>;
}

export function ResearchReportForm({ project, task, kind, userId, busy, error, onSave }: {
  project: ResearchProject; task: ResearchTask; kind: ReportKind; userId: number; busy: boolean; error?: string; onSave: ResearchMutation;
}) {
  const { t, language } = useI18n();
  const period = project.workflow?.report_periods[kind];
  const [body, setBody] = useResearchDraft(`report:${userId}:${project.id}:${task.id}:${kind}:${period || ""}`);
  const [waive, setWaive] = useState(false);
  const [ai, setAi] = useState(0);
  const [thinking, setThinking] = useState(0);
  const [response, setResponse] = useState(false);
  const owner = project.members.find(member => member.owner);
  const rule = task.reporting?.[kind];
  const rewards = project.workflow?.reward_types || defaultResearchRewards;
  return <form className="research-form research-report-form" onSubmit={async event => {
    event.preventDefault();
    if (busy || !body.trim() || ai + thinking > 48) return;
    const saved = await onSave({ action: "progress", task_id: task.id, body, report_kind: kind, ai_slots: ai,
      thinking_slots: thinking, waive_reward: waive, ...(response && owner ? { response_to: owner.id } : {}) });
    if (saved) setBody("");
  }}>
    <div className="research-report-context"><strong>{task.title}</strong>{period && <time dateTime={period}>{researchDate(period, language)}</time>}</div>
    <MarkdownInput value={body} onChange={setBody} required rows={8} mobileImmersive={false} workspace />
    {owner && <SettingRow title={t("researchFlow.askMentor")} trailing={<SettingSwitch label={t("researchFlow.askMentor")}
      checked={response} onChange={setResponse} disabled={busy} />} />}
    {(kind === "daily" || Boolean(rule?.amount)) && <details className="research-form-options" open={ai + thinking > 48 || undefined}>
      <summary>{t("researchWorkbench.reportOptions")}</summary>
      {kind === "daily" && <div className="research-report-times">
        <DurationPickerField label={t("researchFlow.aiTime")} value={ai} onChange={setAi} disabled={busy} />
        <DurationPickerField label={t("researchFlow.thinkingTime")} value={thinking} onChange={setThinking} disabled={busy} />
      </div>}
      {!!rule?.amount && <div className="research-report-reward">
        <span>{t("researchFlow.earned", { amount: rule.amount,
          name: rewards.find(reward => reward.id === rule.reward_type)?.name || t(`researchFlow.${rule.reward_type || "silver"}` as TranslationKey) })}</span>
        <SettingRow title={t("researchFlow.waive")} trailing={<SettingSwitch label={t("researchFlow.waive")} checked={waive} onChange={setWaive} disabled={busy} />} />
      </div>}
    </details>}
    {(error || ai + thinking > 48) && <p className="research-form-error" role="alert">{error || t("researchFlow.timeLimit")}</p>}
    <footer className="research-task-editor-footer">
      <button className="button" type="submit" disabled={busy || !body.trim() || ai + thinking > 48}>
        {t(busy ? "common.processing" : "researchFlow.submitReport")}
      </button>
    </footer>
  </form>;
}

export function ResearchTools({ project, owner, userId, busy, mutate, onResources, initialReimbursementId, mutationError, onOpenComment }: {
  project: ResearchProject; owner: boolean; userId: number; busy: boolean;
  mutate: ResearchMutation; onResources: (adding?: boolean) => void; initialReimbursementId?: string; mutationError?: string;
  onOpenComment: (taskId: string, commentId: string) => void;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<"rewards" | "reimbursements" | "newClaim" | "award" | null>(initialReimbursementId ? "reimbursements" : null);
  const [entryClaim, setEntryClaim] = useState(initialReimbursementId);
  const writable = project.status === "active";
  const { rows: claims, pending } = claimOrder(project);
  const canAward = owner && writable && project.members.some(member => !member.owner);

  return <div className="research-administration">
    <div className="research-administration-shortcuts">
      <section>
        <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
        <div><h2>{t("resources.title")}</h2><p>{t("researchWorkbench.materialsHint")}</p></div>
        <div className="research-flow-actions">
          <button type="button" className="ghost-button" onClick={() => onResources()}>{t("researchWorkbench.browseResources")}</button>
          {writable && <button type="button" className="ghost-button" onClick={() => onResources(true)}>{t("resources.add")}</button>}
        </div>
      </section>
      <section>
        <span className="material-symbols-outlined" aria-hidden="true">workspace_premium</span>
        <div><h2>{t("researchFlow.rewards")}</h2><p>{t("researchWorkbench.pointsHint")}</p></div>
        <div className="research-flow-actions">
          <button type="button" className="ghost-button" onClick={() => setPanel("rewards")}>{t("researchFlow.ledger")}</button>
          {canAward && <button type="button" className="ghost-button" onClick={() => setPanel("award")}>{t("researchFlow.award")}</button>}
        </div>
      </section>
    </div>
    <section className="research-claims-overview">
      <header>
        <div><h2>{t("researchFlow.reimbursements")}
          {pending.size > 0 && <span className="research-workbench-count">{t("researchWorkbench.claimsPending", { count: pending.size })}</span>}
        </h2><p>{t(owner ? "researchWorkbench.mentorClaimsHint" : "researchWorkbench.studentClaimsHint")}</p></div>
        <div className="research-flow-actions">
          <button className="ghost-button" type="button" onClick={() => setPanel("reimbursements")}>{t("researchWorkbench.allClaims")}</button>
          {writable && <button className="button" type="button" onClick={() => setPanel("newClaim")}>{t("researchFlow.newReimbursement")}</button>}
        </div>
      </header>
      {claims.length ? <ReimbursementList rows={claims.slice(0, 4)} project={project} onOpen={id => {
        setEntryClaim(id);
        setPanel("reimbursements");
      }} /> : <QuietState icon="receipt_long" title={t("researchFlow.noReimbursement")} />}
    </section>
    {(panel === "reimbursements" || panel === "newClaim") && <ResearchReimbursements project={project} userId={userId} owner={owner} busy={busy}
      initialId={entryClaim} initialAdd={panel === "newClaim"} mutationError={mutationError} mutate={mutate}
      onClose={() => { setEntryClaim(undefined); setPanel(null); }} />}
    {(panel === "rewards" || panel === "award") && <ResearchRewards project={project} owner={owner} initialAward={panel === "award"} busy={busy} mutate={mutate}
      mutationError={mutationError} onClose={() => setPanel(null)} onOpenComment={(taskId, entryId) => {
        setPanel(null);
        onOpenComment(taskId, entryId);
      }} />}
  </div>;
}

function claimOrder(project: ResearchProject) {
  const pending = new Set(project.workflow?.todos.filter(todo => todo.kind === "reimbursement").map(todo => todo.id));
  const rows = [...(project.workflow?.reimbursements ?? [])].sort((a, b) =>
    Number(pending.has(b.id)) - Number(pending.has(a.id)) || Date.parse(b.created_at) - Date.parse(a.created_at));
  return { rows, pending };
}

function ReimbursementList({ rows, project, onOpen }: {
  rows: ResearchReimbursement[]; project: ResearchProject; onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const money = new Intl.NumberFormat(language, { style: "currency", currency: "CNY" });
  return <div className="research-reimbursement-list">{rows.map(row =>
    <button key={row.id} type="button" onClick={() => onOpen(row.id)}>
      <span><strong>{row.title}</strong><small>{[
        project.members.find(member => member.id === row.user_id)?.name,
        researchDate(row.created_at.slice(0, 10), language),
      ].filter(Boolean).join(" · ")}</small></span>
      <span className="research-reimbursement-state" data-status={row.status}>{t(("researchFlow." + row.status) as TranslationKey)}</span>
      <b>{money.format(Number(row.amount))}</b>
      <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
    </button>)}</div>;
}

function ResearchReimbursements({ project, userId, owner, busy, initialId, initialAdd, mutationError, mutate, onClose }: {
  project: ResearchProject; userId: number; owner: boolean; busy: boolean; initialId?: string; initialAdd: boolean; mutationError?: string;
  mutate: ResearchMutation; onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [detailId, setDetailId] = useState<string | null>(initialId ?? null);
  const [adding, setAdding] = useState(initialAdd);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const { rows: claims, pending } = claimOrder(project);
  const claim = claims.find(item => item.id === detailId);
  const visible = filter === "pending" ? claims.filter(item => pending.has(item.id)) : claims;
  const writable = project.status === "active";
  const nameOf = (id: number) => project.members.find(member => member.id === id)?.name ?? String(id);
  const statusOf = (status: string) => t(("researchFlow." + status) as TranslationKey);
  const money = new Intl.NumberFormat(language, { style: "currency", currency: "CNY" });

  async function openEvidence(id: string, resource_id: number) {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setError("");
    try {
      const result = await api.researchUpdate(project.id, project.revision, { action: "reimbursement_open", id, resource_id }) as unknown as { url: string };
      if (popup) popup.location.href = result.url;
      else setError(t("resources.popup"));
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : t("research.failed"));
    }
  }

  return <SideDrawer showTitle className="research-workflow-drawer" open historyKey="research-reimbursements"
    title={t(adding ? "researchFlow.newReimbursement" : "researchFlow.reimbursements")} onClose={() => { if (!busy && !uploading) onClose(); }}>
    <div className="research-form research-reimbursement-workspace">
      {!adding && (error || mutationError) && <p role="alert" className="research-form-error">{error || mutationError}</p>}
      {adding ? <>
        <button className="ghost-button research-tools-back" type="button" disabled={busy || uploading} onClick={() => setAdding(false)}>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>{t("researchFlow.reimbursements")}
        </button>
        <ResearchReimbursementComposer currencies={project.workflow?.reimbursement_currencies || ["CNY"]} busy={busy} mutationError={mutationError}
          mutate={mutate} onDone={() => {
            showToast(t("researchWorkbench.claimSent"));
            setFilter("all");
            setAdding(false);
          }} onBusy={setUploading} />
      </> : claim ? <>
        <button type="button" className="ghost-button research-tools-back" disabled={busy} onClick={() => { setError(""); setDetailId(null); }}>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>{t("researchFlow.reimbursements")}
        </button>
        <section className="research-reimbursement-row" key={claim.id}>
          <header><h3>{claim.title}</h3><strong>{money.format(Number(claim.amount))}</strong></header>
          <p>{nameOf(claim.user_id)} · {statusOf(claim.status)}</p>
          {claim.start && claim.end && <p>{researchDate(claim.start, language)} – {researchDate(claim.end, language)}</p>}
          {claim.notes && <p>{claim.notes}</p>}
          {claim.reviewer_note && <blockquote className="research-note-context">{claim.reviewer_note}</blockquote>}
          {claim.items?.length ? <ResearchReimbursementItems items={claim.items} onOpen={resourceId => void openEvidence(claim.id, resourceId)} />
            : <div className="research-flow-actions">{claim.evidence.map((id, index) => <button key={id} type="button" className="ghost-button"
              onClick={() => void openEvidence(claim.id, id)}>
              {t(index === 0 ? "researchFlow.payment" : index === 1 ? "researchFlow.invoice" : "researchFlow.otherFiles")}{index > 1 ? " " + (index - 1) : ""}
              <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
            </button>)}</div>}
          {claim.user_id === userId && claim.status === "needs_info" && writable && <form onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void mutate({ action: "reimbursement_resubmit", id: claim.id, notes: data.get("notes") });
          }}>
            <label>{t("researchFlow.supplement")}<textarea name="notes" required maxLength={4000} /></label>
            <button className="button" disabled={busy}>{t("researchFlow.resubmit")}</button>
          </form>}
          {owner && writable && <form onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void mutate({ action: "reimbursement_review", id: claim.id, status: data.get("status"), notes: data.get("notes") || "" });
          }}>
            <FormSelectField label={t("research.status")} name="status" initialValue={claim.status === "submitted" ? "reviewed" : claim.status}
              options={["reviewed", "needs_info", "rejected"].map(status => ({ value: status, label: statusOf(status) }))} disabled={busy} />
            <label>{t("researchFlow.reviewNote")}<textarea name="notes" maxLength={2000} defaultValue={claim.reviewer_note} /></label>
            <button className="button" disabled={busy}>{t("research.save")}</button>
          </form>}
        </section>
      </> : <>
        <p className="research-flow-hint">{t("researchFlow.evidencePrivacy")}</p>
        {writable && <button type="button" className="button" onClick={() => setAdding(true)}>{t("researchFlow.newReimbursement")}</button>}
        {claims.length > 0 && <PageTabs label={t("researchFlow.reimbursements")} value={filter} onChange={setFilter} items={[
          { value: "all", label: t("researchWorkbench.allClaims") },
          { value: "pending", label: t("researchWorkbench.claimsPending", { count: pending.size }) },
        ]} />}
        {visible.length ? <ReimbursementList rows={visible} project={project} onOpen={id => { setError(""); setDetailId(id); }} />
          : <QuietState icon="receipt_long" title={t(filter === "pending" ? "researchWorkbench.noPendingClaims" : "researchFlow.noReimbursement")} />}
      </>}
    </div>
  </SideDrawer>;
}

function ResearchRewards({ project, owner, busy, initialAward, mutate, mutationError, onOpenComment, onClose }: {
  project: ResearchProject; owner: boolean; busy: boolean; initialAward: boolean; mutate: ResearchMutation; mutationError?: string;
  onOpenComment: (taskId: string, commentId: string) => void; onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [editingReward, setEditingReward] = useState<ResearchReward | null>(null);
  const [editingAward, setEditingAward] = useState<ResearchAward | null>(null);
  const [awarding, setAwarding] = useState(initialAward);
  const rewards = project.workflow?.reward_types ?? defaultResearchRewards;
  const ledger = project.workflow?.ledger ?? [];
  const editable = owner && project.status === "active";
  const students = project.members.filter(member => !member.owner);
  const nameOf = (id: string) => rewards.find(reward => reward.id === id)?.name || t(("researchFlow." + id) as TranslationKey);
  const time = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
  const totals = new Map<string, number>();
  ledger.forEach(item => totals.set(item.reward_type, (totals.get(item.reward_type) ?? 0) + item.amount));
  return <SideDrawer showTitle className="research-workflow-drawer" open historyKey="research-rewards" title={t("researchFlow.rewards")}
    onClose={() => { if (!busy) onClose(); }}>
    <div className="research-form">
      {mutationError && <p role="alert" className="research-form-error">{mutationError}</p>}
      {editable && <div className="research-flow-actions">
        <button type="button" className="button" disabled={!students.length} onClick={() => setAwarding(true)}>{t("researchFlow.award")}</button>
        <button type="button" className="ghost-button" onClick={() => setEditingReward({ id: crypto.randomUUID(), name: "", description: "" })}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>{t("common.add")}
        </button>
      </div>}
      <div className="research-points-list">{rewards.map(reward => <section key={reward.id}>
        <span className={"material-symbols-outlined research-point-" + reward.id} aria-hidden="true">
          {reward.id === "diamond" ? "diamond" : "workspace_premium"}
        </span>
        <div><strong>{nameOf(reward.id)}</strong>{reward.description && <p>{reward.description}</p>}</div>
        <b>{totals.get(reward.id) ?? 0}</b>
        {editable && <button className="research-reward-edit" type="button" aria-label={t("researchFlow.edit") + " " + nameOf(reward.id)}
          onClick={() => setEditingReward(reward)}><span className="material-symbols-outlined" aria-hidden="true">edit</span></button>}
      </section>)}</div>
      <h3>{t("researchFlow.ledger")}</h3>
      {ledger.slice(0, 100).map(item => <div className="research-ledger-row" key={item.id}>
        <div><strong>{project.members.find(member => member.id === item.user_id)?.name || String(item.user_id)}</strong>
          <p>{kinds.includes(item.reason as ReportKind) ? t(("researchFlow." + item.reason) as TranslationKey) : item.reason}</p>
          <small>{time.format(new Date(item.created_at))}</small>
          {item.editable && editable && <button type="button" className="research-comment-action" onClick={() => setEditingAward(item)}>{t("researchFlow.editBonus")}</button>}
          {item.source_id && item.task_id && <button type="button" className="research-comment-action" onClick={() => onOpenComment(item.task_id!, item.source_id!)}>
            {t("researchFlow.viewSource")}<span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
          </button>}
        </div>
        <span>+{item.amount} {nameOf(item.reward_type)}</span>
      </div>)}
      {!ledger.length && <p className="research-flow-hint">{t("researchFlow.noLedger")}</p>}
    </div>
    <SideDrawer className="research-workflow-drawer" open={Boolean(editingReward)} historyKey="research-reward-edit"
      title={t(editingReward && rewards.some(reward => reward.id === editingReward.id) ? "researchFlow.edit" : "common.add")}
      onClose={() => { if (!busy) setEditingReward(null); }}>
      {mutationError && <p role="alert" className="research-form-error">{mutationError}</p>}
      {editingReward && <ResearchRewardEditor key={editingReward.id} reward={editingReward} busy={busy} onSave={async reward => {
        const next = rewards.some(item => item.id === reward.id) ? rewards.map(item => item.id === reward.id ? reward : item) : [...rewards, reward];
        if (await mutate({ action: "reward_types", reward_types: next })) setEditingReward(null);
      }} />}
    </SideDrawer>
    <SideDrawer showTitle className="research-workflow-drawer" open={awarding && editable} historyKey="research-award" title={t("researchFlow.award")}
      onClose={() => { if (!busy) setAwarding(false); }}>
      <form className="research-form research-reward-editor" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void mutate({ action: "award", user_id: Number(data.get("user_id")), reward_type: data.get("reward_type"),
          amount: Number(data.get("amount")), reason: data.get("reason") }).then(ok => { if (ok) setAwarding(false); });
      }}>
        <FormSelectField label={t("research.assignees")} name="user_id" initialValue={String(students[0]?.id ?? "")}
          options={students.map(member => ({ value: String(member.id), label: member.name }))} disabled={busy} />
        <FormSelectField label={t("researchFlow.reward")} name="reward_type" initialValue={rewards[0]?.id ?? ""}
          options={rewards.map(reward => ({ value: reward.id, label: nameOf(reward.id) }))} disabled={busy} />
        <label>{t("researchFlow.points")}<input name="amount" type="number" inputMode="numeric" min={1} max={10000} required /></label>
        <label>{t("researchFlow.reason")}<textarea name="reason" maxLength={1000} required /></label>
        {mutationError && <p role="alert" className="research-form-error">{mutationError}</p>}
        <button className="button" disabled={busy || !students.length}>{t("researchFlow.award")}</button>
      </form>
    </SideDrawer>
    <SideDrawer className="research-workflow-drawer" open={Boolean(editingAward)} historyKey="research-ledger-edit"
      title={t("researchFlow.editBonus")} onClose={() => { if (!busy) setEditingAward(null); }}>
      {editingAward && <ResearchAwardForm key={editingAward.id} project={project} userId={editingAward.user_id}
        sourceId={editingAward.source_id || ""} award={editingAward} busy={busy} mutate={mutate} onDone={() => setEditingAward(null)} />}
    </SideDrawer>
  </SideDrawer>;
}
