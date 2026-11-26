import type { ResearchMember, ResearchTask } from "../lib/research";
import { useI18n } from "../lib/language";
import { researchDate, taskPhase } from "../lib/researchWorkbench";

export function ResearchTaskItem({ task, members, today, selected = false, onClick }: {
  task: ResearchTask; members: ResearchMember[]; today: string; selected?: boolean; onClick: () => void;
}) {
  const { t, language } = useI18n();
  const phase = taskPhase(task, today);
  const names = members.filter(member => task.assignees.includes(member.id)).map(member => member.name);
  const date = phase === "upcoming" ? task.start : task.end;
  return <button className={`research-task-row${selected ? " selected" : ""}`} type="button"
    aria-current={selected ? "true" : undefined} onClick={onClick}>
    <span className="research-task-row-copy">
      <strong>{task.title}</strong>
      <span className="research-task-row-meta">
        <span data-phase={phase}>{t(`researchWorkbench.phase.${phase}`)}</span>
        {date && <time dateTime={date}>{researchDate(date, language)}</time>}
      </span>
      {names.length > 0 && <small className="research-task-assignees" title={names.join(" · ")}>{names.join(" · ")}</small>}
    </span>
    <span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
  </button>;
}
