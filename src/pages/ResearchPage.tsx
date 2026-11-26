import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ActionSheet } from "../components/ActionSheet";
import { AppChrome } from "../components/AppChrome";
import { ContentLoader, QuietState } from "../components/BoundaryState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateRangeField } from "../components/DateRangeField";
import { FloatingDrawerScope } from "../components/DesktopPanelWorkspace";
import { HeaderIconButton } from "../components/HeaderIconButton";
import { MarkdownEditorDialog } from "../components/MarkdownEditorDialog";
import { MemberPickerSheet } from "../components/MemberPickerSheet";
import { PageTabs } from "../components/PageTabs";
import { ReferenceShareButton } from "../components/ReferenceShareButton";
import { ResearchCalendar } from "../components/ResearchCalendar";
import { ResearchComments } from "../components/ResearchComments";
import { ResearchCreateFlow, type ResearchDraft } from "../components/ResearchCreateFlow";
import { Markdown } from "../components/ResearchMarkdown";
import { ResearchProjectDetails } from "../components/ResearchProjectDetails";
import { ResearchProjectHeader } from "../components/ResearchProjectHeader";
import { ResearchResources } from "../components/ResearchResources";
import { ResearchCurrentReport, ResearchTaskBrowser } from "../components/ResearchTaskBrowser";
import { ResearchReportForm, ResearchTaskEditor, ResearchTools } from "../components/ResearchWorkflow";
import { ResearchHome, ResearchOverview } from "../components/ResearchWorkspace";
import { SelectControl } from "../components/SettingRow";
import { SideDrawer } from "../components/SideDrawer";
import { TabPageHeader } from "../components/TabPageHeader";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n, type TranslationKey } from "../lib/language";
import type { ReportKind, ResearchProject, ResearchSummary, ResearchTodo } from "../lib/research";
import { researchCreateRestriction } from "../lib/researchCreatePermission";
import { submittedReportRewards } from "../lib/researchDiscussion";
import { selectResearchProject } from "../lib/researchNavigation";
import { researchDate, researchToday, taskPhase } from "../lib/researchWorkbench";
import { useSpaceFeatures } from "../lib/spaceFeatures";
import { authStorage } from "../lib/storage";
import { showToast } from "../lib/toast";
import type { UserDTO } from "../types";
import "./ResearchPage.css";
import "./ResearchWorkspaceLayout.css";
import "./ResearchWorkbench.css";

const EmbeddedChats = lazy(() => import("./ChatsPage"));
const tabs = ["overview", "tasks", "calendar", "tools"] as const;
type ResearchTab = typeof tabs[number];
type ProjectPanel = "create" | "task" | "members" | "description" | "title";
type MemberAction = "transfer" | "remove";
type Confirmation = { action: MemberAction; userId: number } | { action: "leave" | "dissolve" };

export default function ResearchPage() {
  const { session } = useAuth();
  const accountKey = `${session?.user.space_id}:${session?.user.user_id}`;
  return <ResearchWorkspacePage key={accountKey} />;
}

function ResearchWorkspacePage() {
  const { t, language } = useI18n();
  const { session } = useAuth();
  const features = useSpaceFeatures();
  const userId = session?.user.user_id ?? 0;
  const spaceId = session?.user.space_id;
  const [search, setSearch] = useSearchParams();
  const requestedProject = Number(search.get("project")) || null;
  const requestedChat = Number(search.get("chat")) || null;
  const requestedTask = search.get("task");
  const requestedProgress = search.get("progress");
  const detailsRequested = search.get("details") === "1";
  const returnKey = `chronelle:return-project:${userId}`;
  const [returning] = useState(() => sessionStorage.getItem(returnKey));
  const memoryKey = `research:current:${userId}`;
  const [id, setId] = useState<number | null>(() => requestedProject || Number(returning || localStorage.getItem(memoryKey)) || null);
  const [list, setList] = useState<ResearchSummary[]>([]);
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [tick, setTick] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(requestedTask);
  const [scope, setScope] = useState("all");
  const [focusProgressId, setFocusProgressId] = useState<string | undefined>(requestedProgress ?? undefined);
  const [tab, setTab] = useState<ResearchTab>(returning || search.has("calendar") ? "calendar" : requestedTask ? "tasks" : "overview");
  const [onboarding, setOnboarding] = useState(Boolean(returning));
  const [panel, setPanel] = useState<ProjectPanel | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [resourceTarget, setResourceTarget] = useState<{ taskId?: string } | null>(null);
  const [report, setReport] = useState<{ taskId: string; kind: ReportKind } | null>(null);
  const [claim, setClaim] = useState<{ id: string } | null>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [friends, setFriends] = useState<UserDTO[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberAction, setMemberAction] = useState<number | null>(null);
  const [memberPicker, setMemberPicker] = useState<MemberAction | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [dates, setDates] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  const checkingCreate = useRef(false);
  const openProjectId = useRef(id);
  openProjectId.current = id;
  const current = project?.id === id ? project : null;
  const owner = current?.members.some(member => member.id === userId && member.owner) ?? false;
  const writable = current?.status === "active";
  const task = current?.tasks.find(item => item.id === taskId);
  const reportTask = current?.tasks.find(item => item.id === report?.taskId);
  const today = current?.workflow?.report_periods.daily || researchToday();
  const needsFriends = inviteOpen || panel === "members";

  function changeTab(next: ResearchTab) {
    if (next === tab) return;
    setTab(next);
    setTaskId(null);
    setScope("all");
    setFocusProgressId(undefined);
    setClaim(null);
    setSearch(params => {
      params.delete("task");
      params.delete("progress");
      return params;
    }, { replace: true });
  }

  function openTask(next: string, progressId?: string) {
    setTab("tasks");
    setTaskId(next);
    setScope("all");
    setFocusProgressId(progressId);
    setSearch(params => {
      params.set("task", next);
      if (progressId) params.set("progress", progressId);
      else params.delete("progress");
      return params;
    }, { replace: true });
  }

  function closeTask() {
    setTaskId(null);
    setFocusProgressId(undefined);
    setSearch(params => {
      params.delete("task");
      params.delete("progress");
      return params;
    }, { replace: true });
  }

  function openProject(next: number) {
    if (next !== id) setLoading(true);
    setId(next);
    setBrowsing(false);
    setTab("overview");
    setTaskId(null);
    setFocusProgressId(undefined);
    setOnboarding(false);
    setClaim(null);
    setPanel(null);
    setChatOpen(false);
    setResourceTarget(null);
    setReport(null);
    setError("");
    setSearch(params => {
      params.set("project", String(next));
      ["task", "progress", "chat", "details", "onboarding", "calendar"].forEach(key => params.delete(key));
      return params;
    }, { replace: true });
  }

  function openTodo(todo: ResearchTodo) {
    setError("");
    if (todo.kind === "reimbursement") {
      changeTab("tools");
      setClaim({ id: todo.id });
      return;
    }
    if (!todo.task_id) return;
    openTask(todo.task_id, todo.progress_id);
    if (todo.kind !== "response") setReport({ taskId: todo.task_id, kind: todo.kind });
  }

  function showPanel(next: ProjectPanel) {
    setError("");
    setPanel(next);
  }

  function createTask() {
    setEditingTask(false);
    showPanel("task");
  }

  useEffect(() => {
    if (requestedProject && requestedProject !== id) {
      setLoading(true);
      setId(requestedProject);
      setBrowsing(false);
      setReport(null);
      setClaim(null);
      setResourceTarget(null);
      setError("");
      if (!requestedTask) {
        setTaskId(null);
        setFocusProgressId(undefined);
        setTab(search.has("calendar") ? "calendar" : "overview");
      }
    }
    if (!requestedTask) return;
    setBrowsing(false);
    setTaskId(requestedTask);
    setTab("tasks");
    setScope("all");
    setFocusProgressId(requestedProgress ?? undefined);
  }, [requestedProject, requestedTask, requestedProgress]);

  useEffect(() => {
    if (listLoading || !requestedChat) return;
    const target = list.find(item => item.chat_id === requestedChat);
    if (!target) return;
    setId(target.id);
    setBrowsing(false);
    setSearch(params => {
      params.delete("chat");
      params.set("project", String(target.id));
      return params;
    }, { replace: true });
  }, [list, listLoading, requestedChat, setSearch]);

  useEffect(() => {
    if (!current || current.id !== requestedProject || !detailsRequested) return;
    showPanel("members");
    setSearch(params => { params.delete("details"); return params; }, { replace: true });
  }, [current, requestedProject, detailsRequested, setSearch]);

  useEffect(() => {
    if (listLoading || loadError || requestedProject || requestedChat || browsing) return;
    const next = selectResearchProject(list, id);
    if (next === null || next === id) return;
    setId(next);
  }, [list, listLoading, loadError, requestedProject, requestedChat, id, browsing]);

  useEffect(() => {
    if (!current || browsing) return;
    localStorage.setItem(memoryKey, String(current.id));
    if (requestedProject !== current.id) {
      setSearch(params => { params.set("project", String(current.id)); return params; }, { replace: true });
    }
  }, [current, browsing, memoryKey, requestedProject, setSearch]);

  useEffect(() => {
    if (!features.ready || !features.researchEnabled) return;
    const controller = new AbortController();
    setListLoading(true);
    setLoadError("");
    api.researchList(controller.signal).then(rows => {
      if (!controller.signal.aborted) setList(rows);
    }).catch(e => {
      if (!controller.signal.aborted) setLoadError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setListLoading(false);
    });
    return () => controller.abort();
  }, [features.ready, features.researchEnabled, tick]);

  useEffect(() => {
    if (!id || !features.researchEnabled) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    api.researchGet(id, controller.signal).then(next => {
      if (!controller.signal.aborted) setProject(previous => previous?.id === next.id && previous.revision > next.revision ? previous : next);
    }).catch(e => {
      if (!controller.signal.aborted) setLoadError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id, tick, features.researchEnabled]);

  useEffect(() => {
    if (!id || !features.researchEnabled) return;
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (document.hidden || inFlight || operation.current) return;
      inFlight = true;
      try {
        const next = await api.researchGet(id, controller.signal);
        if (!controller.signal.aborted) setProject(previous => previous?.id === next.id && next.revision >= previous.revision ? next : previous);
      } catch { /* The open workspace can remain usable offline. */ }
      finally { inFlight = false; }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, features.researchEnabled]);

  useEffect(() => {
    if (!needsFriends) return;
    const controller = new AbortController();
    api.getFriends(controller.signal).then(rows => {
      if (!controller.signal.aborted) setFriends(rows);
    }).catch(e => {
      if (!controller.signal.aborted) showToast(e.message, "error");
    });
    return () => controller.abort();
  }, [needsFriends]);

  function sessionMatches() {
    const active = authStorage.get()?.user;
    return active?.user_id === userId && active?.space_id === spaceId;
  }

  function applyProject(next: ResearchProject) {
    if (openProjectId.current === next.id) {
      setProject(previous => previous?.id === next.id && previous.revision > next.revision ? previous : next);
    }
    setList(items => items.map(item => item.id === next.id ? next : item));
  }

  async function startCreate() {
    if (checkingCreate.current || operation.current) return;
    checkingCreate.current = true;
    try {
      const me = await api.getUserMe();
      if (!sessionMatches()) return;
      const restriction = researchCreateRestriction(me);
      if (restriction) { showToast(t(restriction.key, restriction.values), "error", 4000); return; }
      showPanel("create");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("research.failed"), "error");
    } finally { checkingCreate.current = false; }
  }

  function beginOperation() {
    operation.current = true;
    setBusy(true);
    setError("");
  }

  function endOperation() {
    operation.current = false;
    setBusy(false);
  }

  async function mutate(body: Record<string, unknown>) {
    if (!current || operation.current) return false;
    const before = current;
    beginOperation();
    try {
      const next = await api.researchUpdate(before.id, before.revision, body);
      if (!sessionMatches()) return false;
      if (body.action === "leave" || body.action === "dissolve") {
        setList(items => items.filter(item => item.id !== before.id));
        localStorage.removeItem(memoryKey);
        setId(null);
        setProject(null);
        setTaskId(null);
        setBrowsing(true);
        setSearch({}, { replace: true });
        return true;
      }
      applyProject(next);
      if (openProjectId.current !== next.id) return false;
      if (body.action === "task") {
        const added = next.tasks.find(item => !before.tasks.some(old => old.id === item.id));
        if (added) openTask(added.id);
      }
      if (body.action === "progress" && body.report_kind) {
        const { awards, report: submitted } = submittedReportRewards(before, next, userId, String(body.task_id));
        if (awards.length) {
          const rewards = awards.map(award => {
            const name = next.workflow?.reward_types.find(type => type.id === award.reward_type)?.name;
            return `${award.amount} ${name || t(`researchFlow.${award.reward_type}` as TranslationKey)}`;
          }).join(" · ");
          showToast(t("researchFlow.rewardToast", { rewards }));
        } else {
          showToast(t(submitted?.waive_reward ? "researchFlow.waivedToast" : "researchFlow.reportSavedToast"));
        }
        if (submitted) openTask(String(body.task_id), submitted.id);
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        try { applyProject(await api.researchGet(before.id)); setError(t("research.changedRetry")); }
        catch { setError(t("research.failed")); }
      } else setError(e instanceof Error ? e.message : t("research.failed"));
      return false;
    } finally { endOperation(); }
  }

  async function createProject(body: ResearchDraft) {
    if (operation.current) return false;
    beginOperation();
    try {
      const created = await api.researchCreate(body);
      if (!sessionMatches()) return false;
      setList(items => [created, ...items]);
      setProject(created);
      openProject(created.id);
      return true;
    } catch (e) {
      let message = e instanceof Error ? e.message : t("research.failed");
      if (e instanceof ApiError && e.status === 403) {
        message = t("research.createDenied");
        try {
          const restriction = researchCreateRestriction(await api.getUserMe());
          if (restriction) message = t(restriction.key, restriction.values);
        } catch { /* Keep the access error. */ }
      }
      setError(message);
      return false;
    } finally { endOperation(); }
  }

  async function inviteMembers(ids: number[]) {
    if (!current || operation.current) return false;
    beginOperation();
    let next = current;
    try {
      for (const user_id of ids) {
        if (next.members.some(member => member.id === user_id) || next.pending_invitee_ids?.includes(user_id)) continue;
        next = await api.researchUpdate(next.id, next.revision, { action: "invite", user_id });
        if (!sessionMatches()) return false;
        applyProject(next);
      }
      showToast(t("researchWorkbench.invitationsSent"));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        try { applyProject(await api.researchGet(next.id)); setError(t("research.changedRetry")); }
        catch { setError(t("research.failed")); }
      } else setError(e instanceof Error ? e.message : t("research.failed"));
      return false;
    } finally { endOperation(); }
  }

  function finishCalendarSetup() {
    setOnboarding(false);
    sessionStorage.removeItem(returnKey);
    setSearch(params => { params.delete("onboarding"); return params; }, { replace: true });
  }

  if (features.ready && !features.researchEnabled) return <Navigate replace to="/app/menu" />;
  const memberName = (value: number) => current?.members.find(member => member.id === value)?.name || `#${value}`;
  const inviteCandidates = current ? friends.filter(friend => !current.members.some(member => member.id === friend.user_id)).map(friend => ({
    id: friend.user_id, name: friend.name, avatar_uri: friend.avatar_uri, avatar_cache_key: friend.avatar_cache_key,
    avatar_frame_style: friend.avatar_frame_style, locked: current.pending_invitee_ids?.includes(friend.user_id), lockedLabel: t("research.invited"),
  })) : [];
  const activeProject = Boolean(id && !browsing);
  const title = current?.title || list.find(item => item.id === id)?.title || t("research.project");
  const showInvite = () => { setError(""); setInviteOpen(true); };

  return <AppChrome title={t("research.title")} hideTopbar shellClassName="desktop-tab-shell research-workspace-shell">
    <section className="page-stack research-page research-direct-workspace">
      {activeProject ? <ResearchProjectHeader title={title} disabled={!current}
        onBack={() => setBrowsing(true)} onMenu={() => showPanel("members")} onChat={() => setChatOpen(true)} />
        : <TabPageHeader title={t("researchWorkbench.projects")} actions={<HeaderIconButton label={t("research.create")} onClick={() => void startCreate()}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
        </HeaderIconButton>} />}

      <FloatingDrawerScope>
        <div className="research-project-surface">
          {loadError && <div className="research-workbench-error" role="alert"><span>{loadError}</span>
            <button className="ghost-button" type="button" onClick={() => setTick(count => count + 1)}>{t("common.retry")}</button>
          </div>}
          {!features.ready || (activeProject && loading && !current) || (!activeProject && listLoading)
            ? <ContentLoader label={t("common.loading")} rows={4} />
            : !activeProject ? <ResearchHome projects={list} selected={id} open={openProject} create={() => void startCreate()} />
            : current ? <>
              <div className="research-project-navigation">
                <PageTabs label={t("researchWorkbench.workspace")} value={tab} onChange={changeTab} items={tabs.map(value => ({
                  value, label: t(value === "overview" ? "researchWorkbench.workspace" : value === "tools" ? "researchWorkbench.administration" : `research.${value}`),
                }))} />
              </div>
              {tab === "overview" && <ResearchOverview key={current.id} project={current} owner={owner} userId={userId}
                openMembers={() => showPanel("members")} openTasks={() => changeTab("tasks")} openTask={openTask} openTodo={openTodo}
                createTask={createTask} invite={showInvite} openResources={() => setResourceTarget({})} mutate={mutate} />}
              {tab === "calendar" && <ResearchCalendar key={current.id} project={current} userId={userId}
                onboarding={onboarding} onOnboarded={finishCalendarSetup} />}
              {tab === "tools" && <ResearchTools key={`${current.id}:${claim?.id || ""}`} project={current} owner={owner} userId={userId}
                busy={busy} mutate={mutate} mutationError={error} initialReimbursementId={claim?.id}
                onOpenComment={openTask} onResources={() => setResourceTarget({})} />}
              {tab === "tasks" && <div className={`research-task-layout${task ? " has-detail" : ""}`}>
                <ResearchTaskBrowser key={`${current.id}:${owner}`} project={current} taskId={taskId} owner={owner} userId={userId} open={openTask} create={createTask} />
                <article className="research-task-detail">
                  {task ? <ResearchComments key={task.id} focusProgressId={focusProgressId} project={current} task={task}
                    userId={userId} scope={scope} writable={writable && task.status === "active"} busy={busy} mutate={mutate} error={error}
                    send={(body, reply_to, response_to) => mutate({ action: "progress", task_id: task.id, body, reply_to, response_to })}>
                    <header className="research-task-heading">
                      <button className="ghost-button research-back" type="button" onClick={closeTask} aria-label={t("researchWorkbench.backToTasks")}>
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                      </button>
                      <h2>{task.title}</h2>
                      <ReferenceShareButton key={`${current.id}:${task.id}`} reference={{ kind: "research_task", project_id: current.id, task_id: task.id }} />
                      {owner && writable && <HeaderIconButton label={t("researchFlow.edit")} onClick={() => { setEditingTask(true); showPanel("task"); }}>
                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                      </HeaderIconButton>}
                    </header>
                    <div className="research-task-meta">
                      <span className="research-status" data-phase={taskPhase(task, today)}>{t(`researchWorkbench.phase.${taskPhase(task, today)}`)}</span>
                      <span><span className="material-symbols-outlined" aria-hidden="true">group</span>{task.assignees.map(memberName).join(" · ") || t("research.unassigned")}</span>
                      <span><span className="material-symbols-outlined" aria-hidden="true">date_range</span>
                        {researchDate(task.start, language)} · {task.end ? researchDate(task.end, language) : t("research.openEnd")}
                      </span>
                    </div>
                    <div className="research-task-document">
                      <div className="research-task-body"><Markdown body={task.body} /></div>
                      <div className="research-task-document-actions">
                        <button type="button" className="ghost-button" onClick={() => setResourceTarget({ taskId: task.id })}>
                          <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>{t("resources.task")}
                        </button>
                        {owner && writable && <button type="button" className="ghost-button" disabled={busy}
                          onClick={async () => {
                            if (!await mutate({ action: "task_status", task_id: task.id, status: task.status === "active" ? "archived" : "active" })) {
                              showToast(t("research.failed"), "error");
                            }
                          }}
                        >{t(task.status === "active" ? "researchWorkbench.archiveTask" : "researchWorkbench.reopenTask")}</button>}
                      </div>
                    </div>
                    <ResearchCurrentReport project={current} task={task} owner={owner} userId={userId}
                      onWrite={kind => { setError(""); setReport({ taskId: task.id, kind }); }}
                      onOpen={progressId => openTask(task.id, progressId)} />
                    <div className="research-progress-head">
                      <h2>{t("researchWorkbench.discussion")}</h2>
                      {task.progress.length > 0 && <SelectControl compact label={t("researchFlow.memberFilter")} value={scope}
                        onChange={setScope} options={[{ value: "all", label: t("researchWorkbench.everyone") },
                          ...current.members.map(member => ({ value: String(member.id), label: member.name }))]} />}
                    </div>
                  </ResearchComments> : <QuietState icon="assignment" title={t(taskId ? "researchWorkbench.taskUnavailable" : "research.chooseTask")} />}
                </article>
              </div>}
            </> : !loading && <QuietState icon="science" title={t("researchWorkbench.projectUnavailable")}
              action={<button type="button" className="ghost-button" onClick={() => setBrowsing(true)}>{t("researchWorkbench.projects")}</button>} />}
        </div>
      </FloatingDrawerScope>

      <FloatingDrawerScope>
        {resourceTarget && current && <ResearchResources key={`${current.id}:${resourceTarget.taskId || ""}`}
          projectId={current.id} taskId={resourceTarget.taskId} members={current.members}
          title={resourceTarget.taskId ? t("resources.task") : t("resources.title")} onClose={() => setResourceTarget(null)} />}
        <SideDrawer historyKey="research-chat" className="research-chat-drawer" headerless floatingBack={false} fullscreen
          open={chatOpen && Boolean(current)} onClose={() => setChatOpen(false)} title={t("research.group")}>
          {chatOpen && current && <Suspense fallback={<ContentLoader label={t("common.loading")} />}>
            <EmbeddedChats embeddedChat={{ id: current.chat_id, onClose: () => setChatOpen(false), onProjectDetails: () => showPanel("members") }} />
          </Suspense>}
        </SideDrawer>
        <SideDrawer className="research-workflow-drawer" historyKey="research-members" open={panel === "members"} onClose={() => setPanel(null)} title={t("researchWorkbench.projectSettings")}>
          {error && <p className="research-error" role="alert">{error}</p>}
          {current && <ResearchProjectDetails project={current} owner={owner} busy={busy}
            onTitle={() => showPanel("title")} onDates={() => { setError(""); setDates({ from: current.start, to: current.end || "" }); }}
            onDescription={() => showPanel("description")} onMember={member => setMemberAction(member.id)} onAdd={showInvite}
            onRemove={() => setMemberPicker("remove")} onTransfer={() => setMemberPicker("transfer")}
            onChat={() => { setPanel(null); setChatOpen(true); }} onDanger={() => setConfirm({ action: owner ? "dissolve" : "leave" })}
            onStatus={async status => { if (!await mutate({ action: "settings", status })) throw new Error("Status update failed"); }} />}
        </SideDrawer>
        <SideDrawer className="research-workflow-drawer" historyKey="research-task-create" open={panel === "task"}
          onClose={() => { if (!busy) setPanel(null); }} title={t(editingTask ? "researchFlow.editTask" : "research.addTask")}>
          {current && <ResearchTaskEditor key={editingTask ? task?.id : "new"} project={current} task={editingTask ? task : undefined}
            busy={busy} error={error} onSave={async body => { const ok = await mutate(body); if (ok) setPanel(null); return ok; }} />}
        </SideDrawer>
        {memberPicker && current && <MemberPickerSheet title={t(memberPicker === "transfer" ? "research.transferOwner" : "research.remove")}
          members={current.members.filter(member => !member.owner)} initial={[]} limit={1} allowEmpty={false}
          actionLabel={t("common.next")} onClose={() => setMemberPicker(null)} onApply={ids => { setConfirm({ action: memberPicker, userId: ids[0] }); }} />}
        {inviteOpen && current && <MemberPickerSheet allowEmpty={false} title={t("research.invite")} initial={[]}
          actionLabel={t("research.sendInvitation")} error={error} members={inviteCandidates}
          onClose={() => setInviteOpen(false)} onApply={inviteMembers} />}
        <ActionSheet open={memberAction !== null} title={memberName(memberAction ?? 0)} onClose={() => setMemberAction(null)} actions={memberAction === null ? [] : [
          { key: "transfer", label: t("research.transfer"), disabled: busy, onSelect: () => { setError(""); setConfirm({ action: "transfer", userId: memberAction }); } },
          { key: "remove", label: t("research.remove"), danger: true, disabled: busy, onSelect: () => { setError(""); setConfirm({ action: "remove", userId: memberAction }); } },
        ]} />
        <ConfirmDialog open={Boolean(confirm)} title={confirm?.action === "transfer" ? t("research.transferConfirm", { name: memberName(confirm.userId) }) : t("research.confirm")}
          description={t(confirm?.action === "transfer" ? "research.transferHint" : "research.sensitive")}
          danger={confirm?.action !== "transfer"} busy={busy} onClose={() => { setConfirm(null); setError(""); }}
          onConfirm={() => {
            if (!confirm) return;
            void mutate({ action: confirm.action, ...("userId" in confirm ? { user_id: confirm.userId } : {}) }).then(ok => {
              if (!ok) return;
              setConfirm(null);
              setPanel(null);
              if (confirm.action === "transfer") showToast(t("research.transferred"));
            });
          }}>
          {error && <p className="research-error" role="alert">{error}</p>}
        </ConfirmDialog>
        <SideDrawer className="research-workflow-drawer" open={Boolean(report && reportTask)} historyKey="research-report"
          title={t(`researchFlow.${report?.kind || "daily"}`)} onClose={() => { if (!busy) setReport(null); }}>
          {current && report && reportTask && <ResearchReportForm
            key={`${reportTask.id}:${report.kind}:${current.workflow?.report_periods[report.kind]}`}
            project={current} task={reportTask} userId={userId} kind={report.kind} busy={busy} error={error}
            onSave={async body => { const ok = await mutate(body); if (ok) setReport(null); return ok; }} />}
        </SideDrawer>
        <SideDrawer className="research-workflow-drawer" open={panel === "title"} historyKey="research-title"
          title={t("research.name")} onClose={() => { if (!busy) setPanel(null); }}>
          {current && <form className="research-form" onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void mutate({ action: "settings", title: data.get("title") }).then(ok => { if (ok) setPanel(null); });
          }}>
            <label>{t("research.name")}<input name="title" maxLength={50} required defaultValue={current.title} /></label>
            {error && <p role="alert">{error}</p>}
            <button className="button" disabled={busy}>{t("research.save")}</button>
          </form>}
        </SideDrawer>
        {panel === "description" && current && <MarkdownEditorDialog title={t("research.description")} initialValue={current.description}
          busy={busy} error={error} onClose={() => setPanel(null)}
          onSave={description => { void mutate({ action: "settings", description }).then(ok => { if (ok) setPanel(null); }); }} />}
        {panel === "create" && <ResearchCreateFlow busy={busy} error={error} onClose={() => setPanel(null)} onCreate={createProject} />}
        <ConfirmDialog open={Boolean(dates)} title={t("research.editDates")} description="" busy={busy} confirmLabel={t("research.save")}
          onClose={() => setDates(null)} onConfirm={() => {
            if (dates) void mutate({ action: "settings", start: dates.from, end: dates.to || null }).then(ok => { if (ok) setDates(null); });
          }}>
          {dates && <DateRangeField value={dates} onChange={setDates} />}
          {error && <p className="research-error" role="alert">{error}</p>}
        </ConfirmDialog>
      </FloatingDrawerScope>
    </section>
  </AppChrome>;
}
