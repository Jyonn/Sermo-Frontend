import { useState } from "react";
import type { ReportKind, ResearchProject, ResearchTask } from "../lib/research";
import { reportForMember, reportKinds, researchDate, researchReportRoster, researchTaskOrder, researchToday, taskPhase } from "../lib/researchWorkbench";
import { useI18n } from "../lib/language";
import { PageTabs } from "./PageTabs";
import { ResearchTaskItem } from "./ResearchTaskItem";
import { PlainAvatar } from "./UserAvatar";

export function ResearchTaskBrowser({ project, taskId, owner, userId, open, create }: {
  project: ResearchProject; taskId: string | null; owner: boolean; userId: number;
  open: (id: string) => void; create: () => void;
}) {
  const { t } = useI18n();
  const selected = project.tasks.find(task => task.id === taskId);
  const [ownership, setOwnership] = useState<"mine" | "all">(owner || (selected && !selected.assignees.includes(userId)) ? "all" : "mine");
  const [query, setQuery] = useState("");
  const today = project.workflow?.report_periods.daily || researchToday();
  const filter = query.trim().toLocaleLowerCase();
  const visible = researchTaskOrder(project.tasks, today).filter(task => {
    if (ownership === "mine" && !task.assignees.includes(userId)) return false;
    return !filter || task.title.toLocaleLowerCase().includes(filter);
  });
  const working = visible.filter(task => task.status === "active");
  const archived = visible.filter(task => task.status === "archived");
  const render = (task: ResearchTask) => <ResearchTaskItem key={task.id} task={task} members={project.members}
    today={today} selected={taskId === task.id} onClick={() => open(task.id)} />;
  return <aside className="research-task-browser">
    <div className="research-task-browser-controls">
      <header>
        <h2>{t("research.tasks")}</h2>
        {owner && project.status === "active" && <button className="ghost-button" type="button" onClick={create} aria-label={t("research.addTask")}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>{t("research.addTask")}
        </button>}
      </header>
      <PageTabs label={t("research.tasks")} value={ownership} onChange={setOwnership} items={[
        { value: "all", label: t("researchWorkbench.allTasks") }, { value: "mine", label: t("researchWorkbench.myTasks") },
      ]} />
      <label className="research-task-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input type="search" placeholder={t("researchWorkbench.findTask")} aria-label={t("researchWorkbench.findTask")}
          value={query} onChange={event => setQuery(event.target.value)} />
      </label>
    </div>
    {working.map(render)}
    {archived.length > 0 && <details className="research-task-archive"
      key={filter ? "results" : "directory"} open={filter || archived.some(task => task.id === taskId) ? true : undefined}>
      <summary>{t("research.archived")} <span>{archived.length}</span></summary>
      {archived.map(render)}
    </details>}
    {!visible.length && <div className="research-task-browser-empty">
      <p>{t(filter ? "researchWorkbench.noMatchingTask" : ownership === "mine" ? "researchWorkbench.nothingAssigned" : "research.noTasks")}</p>
      {filter && <button className="ghost-button" type="button" onClick={() => setQuery("")}>{t("common.clear")}</button>}
      {!filter && ownership === "mine" && <button className="ghost-button" type="button" onClick={() => setOwnership("all")}>{t("researchWorkbench.allTasks")}</button>}
    </div>}
  </aside>;
}

export function ResearchCurrentReport({ project, task, owner, userId, onWrite, onOpen }: {
  project: ResearchProject; task: ResearchTask; owner: boolean; userId: number;
  onWrite: (kind: ReportKind) => void; onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const workflow = project.workflow;
  const kind = reportKinds.find(rule => task.reporting?.[rule]);
  if (!workflow || !kind || project.status !== "active" || taskPhase(task, workflow.report_periods.daily) !== "active") return null;
  const start = workflow.report_periods[kind];
  const label = t(`researchFlow.${kind}`);
  const roster = owner ? researchReportRoster(project, task, kind) : [];
  const { report: myReport, removed: myReportRemoved } = reportForMember(task, kind, start, userId);
  if (owner ? roster.length === 0 : !workflow.reportable_task_ids.includes(task.id)) return null;
  return <section className="research-current-report">
    <header>
      <div><h3>{t("researchWorkbench.currentReport", { kind: label })}</h3>
        <small><time dateTime={start}>{researchDate(start, language)}</time></small>
      </div>
      {owner ? <span className="research-report-tally">{t("researchWorkbench.reportTally", { done: roster.filter(row => row.report || row.removed).length, total: roster.length })}</span>
        : myReport ? <button type="button" className="ghost-button" onClick={() => onOpen(myReport.id)}>{t("researchWorkbench.viewReport")}</button>
        : myReportRemoved ? <span className="research-muted">{t("researchWorkbench.reportBodyRemoved")}</span>
        : <button type="button" className="button" onClick={() => onWrite(kind)}>{t("researchFlow.writeReport", { kind: label })}</button>}
    </header>
    {owner && <ul className="research-report-roster">
      {roster.map(({ member, report, removed }) => <li key={member.id}>
        <PlainAvatar className="research-workbench-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} />
        <strong>{member.name}</strong>
        {report ? <button className="research-inline-action" type="button" onClick={() => onOpen(report.id)}>{t("researchWorkbench.viewReport")}</button>
          : <span className="research-muted">{t(removed ? "researchWorkbench.reportBodyRemoved" : "researchWorkbench.notSubmitted")}</span>}
      </li>)}
    </ul>}
  </section>;
}
