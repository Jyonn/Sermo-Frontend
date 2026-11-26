import type { ReportKind, ResearchProgress, ResearchProject, ResearchTask } from "./research";

export const reportKinds = ["daily", "weekly", "monthly"] as const;

export function researchToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());
}

export function taskPhase(task: ResearchTask, today: string) {
  if (task.status === "archived") return "archived";
  if (task.end && task.end < today) return "overdue";
  return task.start > today ? "upcoming" : "active";
}

const phaseOrder = { overdue: 0, active: 1, upcoming: 2, archived: 3 };

export function researchTaskOrder(tasks: ResearchTask[], today: string) {
  return [...tasks].sort((a, b) => {
    const first = taskPhase(a, today);
    const second = taskPhase(b, today);
    return phaseOrder[first] - phaseOrder[second] ||
      (first === "upcoming" ? a.start.localeCompare(b.start) : (a.end ?? "9999").localeCompare(b.end ?? "9999"));
  });
}

export function researchDate(date: string, language: string) {
  return new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(date + "T12:00:00"));
}

export function reportForMember(task: ResearchTask, kind: ReportKind, period: string | undefined, userId: number) {
  if (!period) return undefined;
  return task.progress.find(entry => entry.user_id === userId && entry.report_kind === kind && entry.period_start === period);
}

export function researchReportRoster(project: ResearchProject, task: ResearchTask, kind: ReportKind) {
  const period = project.workflow?.report_periods[kind];
  return project.members.filter(member => !member.owner && task.assignees.includes(member.id)).map(member => ({
    member,
    report: reportForMember(task, kind, period, member.id),
  }));
}

export function latestResearchUpdates(project: ResearchProject, userId?: number) {
  const updates = project.tasks.flatMap(task => task.progress
    .filter(entry => !entry.reply_to)
    .map(entry => ({ task, entry })));
  const recent = updates.filter(({ task, entry }) => !userId || task.assignees.includes(userId) || entry.user_id === userId);
  return (recent.length ? recent : updates)
    .sort((a, b) => Date.parse(b.entry.created_at) - Date.parse(a.entry.created_at))
    .slice(0, 5);
}

export function researchExcerpt(entry: Pick<ResearchProgress, "body">) {
  return entry.body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__|`{1,3})/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
