import { useI18n } from "../lib/language";
import { latestResearchUpdates, researchDate, researchExcerpt, researchTaskOrder, researchToday, taskPhase } from "../lib/researchWorkbench";
import type { ResearchProject, ResearchSummary, ResearchTodo } from "../lib/research";
import { QuietState } from "./BoundaryState";
import { MemberAvatarStack } from "./MemberAvatarStack";
import { Markdown } from "./ResearchMarkdown";
import { ResearchTimeline, type ResearchMutation } from "./ResearchWorkflow";
import { PlainAvatar } from "./UserAvatar";

export function ResearchHome({ projects, selected, open, create }: {
  projects: ResearchSummary[]; selected?: number | null; open: (id: number) => void; create: () => void;
}) {
  const { t, language } = useI18n();
  if (!projects.length) return <div className="research-home-scroll">
    <QuietState icon="science" title={t("research.empty")} description={t("research.intro")}
      action={<button type="button" className="button" onClick={create}>{t("research.create")}</button>} />
  </div>;

  return <div className="research-home-scroll research-project-directory">
    {(["active", "archived"] as const).map(status => {
      const rows = projects.filter(project => project.status === status);
      if (!rows.length) return null;
      return <section key={status} className="research-directory-section">
        <h2>{t(`research.${status}`)} <span>{rows.length}</span></h2>
        <div className="research-project-list">
          {rows.map(project => <button type="button" className="research-directory-row" key={project.id}
            aria-current={selected === project.id ? "page" : undefined} onClick={() => open(project.id)}>
            <span><strong>{project.title}</strong><small>
              {researchDate(project.start, language)} · {project.end ? researchDate(project.end, language) : t("research.openEnd")}
            </small></span>
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>)}
        </div>
      </section>;
    })}
  </div>;
}

export function ResearchOverview({
  project, owner, userId, openMembers, openTasks, openTask, openTodo, createTask, invite, openResources, mutate,
}: {
  project: ResearchProject; owner: boolean; userId: number; openMembers: () => void; openTasks: () => void;
  openTask: (id: string, progressId?: string) => void; openTodo: (todo: ResearchTodo) => void;
  createTask: () => void; invite: () => void; openResources: () => void; mutate: ResearchMutation;
}) {
  const { t, language } = useI18n();
  const today = project.workflow?.report_periods.daily || researchToday();
  const todos = project.workflow?.todos ?? [];
  const upcoming = researchTaskOrder(project.tasks, today)
    .filter(task => task.status === "active" && (owner || task.assignees.includes(userId))).slice(0, 4);
  const updates = latestResearchUpdates(project, owner ? undefined : userId);
  const editable = owner && project.status === "active";
  const milestone = project.workflow?.milestones ?? [];
  const names = new Map(project.members.map(member => [member.id, member]));

  return <div className="research-overview research-workbench">
    <header className="research-workbench-head">
      <div>
        <span className="research-workbench-date"><time dateTime={today}>{researchDate(today, language)}</time>
          <span className={`research-status is-${project.status}`}>{t(`research.${project.status}`)}</span>
        </span>
        <h2>{t(owner ? "researchWorkbench.mentorWork" : "researchWorkbench.studentWork")}</h2>
      </div>
      <button type="button" className={editable ? "button" : "ghost-button"} onClick={editable ? createTask : openTasks}>
        <span className="material-symbols-outlined" aria-hidden="true">{editable ? "add" : "checklist"}</span>
        {t(editable ? "research.addTask" : "researchWorkbench.viewTasks")}
      </button>
    </header>

    <div className="research-workbench-columns">
      <div className="research-workbench-main">
        <section className="research-workbench-section">
          <h3>{t("researchWorkbench.actions")}{todos.length > 0 && <span className="research-workbench-count">{todos.length}</span>}</h3>
          {todos.length ? <div className="research-workbench-list">
            {todos.map(todo => {
              const kind = todo.kind;
              const label = kind === "response" ? t("researchWorkbench.replyAction")
                : kind === "reimbursement" ? t(owner ? "researchWorkbench.reviewClaim" : "researchWorkbench.updateClaim")
                : t("researchFlow.writeReport", { kind: t(`researchFlow.${kind}`) });
              const icon = kind === "response" ? "reply" : kind === "reimbursement" ? "receipt_long" : "edit_note";
              return <button className="research-workbench-row research-todo-row" type="button" key={todo.id} onClick={() => openTodo(todo)}>
                <span className="research-workbench-glyph material-symbols-outlined" aria-hidden="true">{icon}</span>
                <span className="research-workbench-copy"><strong>{todo.title}</strong>
                  {todo.body ? <small>{researchExcerpt({ body: todo.body })}</small>
                    : todo.period_start && <small>{researchDate(todo.period_start, language)}</small>}
                </span>
                <span className="research-workbench-row-action">{label}<span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></span>
              </button>;
            })}
          </div> : <p className="research-workbench-empty"><span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
            {t(project.status === "archived" ? "researchWorkbench.archivedWorkspace" : "researchFlow.noTodo")}
          </p>}
        </section>

        <section className="research-workbench-section">
          <h3>{t("researchWorkbench.recentUpdates")}</h3>
          {updates.length ? <div className="research-workbench-list">
            {updates.map(({ task, entry }) => {
              const author = names.get(entry.user_id);
              return <button type="button" className="research-workbench-row" key={entry.id} onClick={() => openTask(task.id, entry.id)}>
                <PlainAvatar className="research-workbench-avatar" name={author?.name || String(entry.user_id)} uri={author?.avatar_uri} cacheKey={author?.avatar_cache_key} />
                <span className="research-workbench-copy">
                  <strong>{task.title}</strong><span>{researchExcerpt(entry)}</span>
                  <small>{[author?.name, entry.report_kind ? t(`researchFlow.${entry.report_kind}`) : undefined,
                    new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "Asia/Shanghai" }).format(new Date(entry.created_at))]
                    .filter(Boolean).join(" · ")}</small>
                </span>
                <span className="material-symbols-outlined research-workbench-arrow" aria-hidden="true">chevron_right</span>
              </button>;
            })}
          </div> : <p className="research-workbench-empty">{t("researchWorkbench.noUpdates")}</p>}
        </section>
      </div>

      <aside className="research-workbench-side">
        <section className="research-workbench-section">
          <h3>{t("researchWorkbench.nextTasks")}</h3>
          {upcoming.length ? <div className="research-workbench-list">
            {upcoming.map(task => <button className="research-workbench-row research-workbench-deadline" type="button" key={task.id} onClick={() => openTask(task.id)}>
              <span className="research-workbench-copy"><strong>{task.title}</strong>
                <small data-phase={taskPhase(task, today)}>{t(`researchWorkbench.phase.${taskPhase(task, today)}`)}
                  {task.end && ` · ${researchDate(task.end, language)}`}</small>
              </span>
              <span className="material-symbols-outlined research-workbench-arrow" aria-hidden="true">chevron_right</span>
            </button>)}
          </div> : <p className="research-workbench-empty">{t(owner ? "researchWorkbench.noTasksYet" : "researchWorkbench.nothingAssigned")}</p>}
        </section>

        {(milestone.length > 0 || editable) && <ResearchTimeline project={project} editable={editable} mutate={mutate} />}

        <section className="research-workbench-section">
          <h3>{t("research.team")}</h3>
          <div className="research-workbench-team">
            <MemberAvatarStack members={project.members.map(member => ({ id: member.id, name: member.name, uri: member.avatar_uri, cacheKey: member.avatar_cache_key }))}
              label={t("chat.memberCount", { count: project.members.length })} size={30} onClick={openMembers} />
            {editable && <button type="button" className="ghost-button" onClick={invite}>{t("research.invite")}</button>}
          </div>
          <button type="button" className="research-workbench-row research-workbench-resource" onClick={openResources}>
            <span className="material-symbols-outlined" aria-hidden="true">folder_open</span><strong>{t("resources.title")}</strong>
            <span className="material-symbols-outlined research-workbench-arrow" aria-hidden="true">chevron_right</span>
          </button>
          {project.description && <details className="research-workbench-description">
            <summary>{t("research.description")}</summary><Markdown body={project.description} />
          </details>}
        </section>
      </aside>
    </div>
  </div>;
}
