import assert from "node:assert/strict";
import test from "node:test";
import type { ResearchProject, ResearchTask } from "../src/lib/research.ts";
import { latestResearchUpdates, researchExcerpt, researchReportRoster, researchTaskOrder, taskPhase } from "../src/lib/researchWorkbench.ts";

const day = "2026-11-26";
const base: ResearchTask = {
  id: "baseline", title: "Baseline", body: "", status: "active",
  start: "2026-11-23", end: day, assignees: [2, 3], progress: [],
};

test("tasks on their deadline are still active, with overdue work first and archives last", () => {
  const overdue = { ...base, id: "overdue", end: "2026-11-25" };
  const future = { ...base, id: "future", start: "2026-12-03", end: null };
  const archived = { ...overdue, id: "archived", status: "archived" as const };
  assert.equal(taskPhase(base, day), "active");
  assert.deepEqual(researchTaskOrder([base, archived, future, overdue], day).map(task => task.id),
    ["overdue", base.id, "future", "archived"]);
});

const ownReport = {
  id: "new", report_kind: "weekly" as const, period_start: "2026-11-23",
  user_id: 2, body: "### Findings\n- The **baseline** works.", created_at: "2026-11-25T12:00:00Z",
};
const otherTask = { ...base, id: "other", assignees: [3], progress: [
  { ...ownReport, id: "other-new", user_id: 3, created_at: "2026-11-26T12:00:00Z" },
] };
const task = { ...base, progress: [
  ownReport,
  { ...ownReport, id: "previous", user_id: 3, period_start: "2026-11-16", created_at: "2026-11-18T12:00:00Z" },
  { ...ownReport, id: "reply", report_kind: undefined, user_id: 1, reply_to: ownReport.id, created_at: "2026-11-26T13:00:00Z" },
] };
const project: ResearchProject = {
  id: 1, chat_id: 2, title: "Research", description: "", start: base.start, end: null, status: "active", revision: 1,
  members: [{ id: 1, name: "Mentor", owner: true }, { id: 2, name: "Student A", owner: false }, { id: 3, name: "Student B", owner: false }],
  tasks: [task, otherTask],
  workflow: { report_periods: { daily: day, weekly: "2026-11-23", monthly: "2026-11-01" }, reportable_task_ids: [],
    milestones: [], reward_types: [], todos: [], comment_awards: [], ledger: [], reimbursements: [] },
};

test("the mentor roster counts only this period's reports by assigned students", () => {
  assert.deepEqual(researchReportRoster(project, task, "weekly").map(row => [row.member.id, row.report?.id]),
    [[2, "new"], [3, undefined]]);
});

test("recent progress excludes replies and focuses students on their assigned work", () => {
  assert.deepEqual(latestResearchUpdates(project).map(row => row.entry.id), ["other-new", "new", "previous"]);
  assert.deepEqual(latestResearchUpdates(project, 2).map(row => row.entry.id), ["new", "previous"]);
  assert.equal(researchExcerpt(ownReport), "Findings The baseline works.");
});
