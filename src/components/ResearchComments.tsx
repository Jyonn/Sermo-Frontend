import { useEffect, useRef, useState, type ReactNode } from "react";
import { matchesResearchDiscussion, researchDiscussionDay } from "../lib/researchDiscussion";
import { useResearchDraft } from "../lib/researchDraft";
import { researchDate, researchExcerpt } from "../lib/researchWorkbench";
import { useI18n, type TranslationKey } from "../lib/language";
import type { ResearchMember, ResearchProgress, ResearchProject, ResearchTask } from "../lib/research";
import type { SquareStatementCommentDTO, TinyUserDTO } from "../types";
import { CommentThread } from "./CommentThread";
import { ConfirmDialog } from "./ConfirmDialog";
import { Markdown } from "./ResearchMarkdown";
import { MarkdownInput } from "./ResearchMarkdownInput";
import { QuietState } from "./BoundaryState";
import { ReferenceShareButton } from "./ReferenceShareButton";
import { ResearchAwardForm } from "./ResearchAwardForm";
import { SelectControl, SettingRow, SettingSwitch } from "./SettingRow";
import { SideDrawer } from "./SideDrawer";
import { UserProfilePanel } from "./UserProfilePanel";
import type { ResearchMutation } from "./ResearchWorkflow";
import "./ResearchComments.css";

type Send = (body: string, replyTo?: string, responseTo?: number) => Promise<boolean>;

export function ResearchComments({ project, task, userId, scope, onScope, writable, busy, send, header, children, mutate, focusProgressId, error }: {
  project: ResearchProject; task: ResearchTask; userId: number; scope: string; writable: boolean; busy: boolean;
  send: Send; mutate: ResearchMutation; header?: ReactNode; children?: ReactNode; focusProgressId?: string; error?: string;
  onScope: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const [day, setDay] = useState("all");
  const [editor, setEditor] = useState<{ replyTo?: string; editId?: string } | null>(null);
  const [deleting, setDeleting] = useState<ResearchProgress | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [profile, setProfile] = useState<TinyUserDTO | null>(null);
  const [award, setAward] = useState<{ userId: number; sourceId: string; awardId?: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const commentIds = useRef(new Map<string, number>());
  const owner = project.members.some(member => member.id === userId && member.owner);
  const items = [...task.progress].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const byId = new Map(items.map(entry => [entry.id, entry]));
  const members = new Map(project.members.map(member => [member.id, member]));
  const dayChoices = [...new Set(items.map(entry => researchDiscussionDay(entry.created_at)))].sort().reverse();
  const selectedDay = dayChoices.includes(day) ? day : "all";
  const belongs = (entry: ResearchProgress) => matchesResearchDiscussion(entry, selectedDay, scope === "all" ? null : Number(scope));

  const roots = new Map<string, string>();
  function rootOf(entry: ResearchProgress) {
    let current = entry;
    const visited = new Set<string>();
    while (current.reply_to && !visited.has(current.id)) {
      const known = roots.get(current.id);
      if (known) return known;
      const parent = byId.get(current.reply_to);
      if (!parent) break;
      visited.add(current.id);
      current = parent;
    }
    return current.id;
  }

  const byCommentId = new Map<number, ResearchProgress>();
  const replies = new Map<string, ResearchProgress[]>();
  for (const entry of items) {
    if (!commentIds.current.has(entry.id)) commentIds.current.set(entry.id, commentIds.current.size + 1);
    byCommentId.set(commentIds.current.get(entry.id)!, entry);
    const root = rootOf(entry);
    roots.set(entry.id, root);
    if (root === entry.id || !belongs(entry)) continue;
    const bucket = replies.get(root) ?? [];
    bucket.push(entry);
    replies.set(root, bucket);
  }
  const rootEntries = items.filter(entry => roots.get(entry.id) === entry.id && (belongs(entry) || replies.has(entry.id)));
  const person = (id: number): TinyUserDTO => {
    const member = members.get(id);
    return { user_id: id, name: member?.name || String(id), avatar_uri: member?.avatar_uri,
      avatar_cache_key: member?.avatar_cache_key, avatar_frame_style: member?.avatar_frame_style };
  };
  const dto = (entry: ResearchProgress): SquareStatementCommentDTO => {
    const root = roots.get(entry.id) ?? entry.id;
    const parent = entry.reply_to ? byId.get(entry.reply_to) : undefined;
    return { comment_id: commentIds.current.get(entry.id)!, statement_id: 0, user: person(entry.user_id), text: entry.body,
      created_at: Date.parse(entry.created_at) / 1000, edited_at: entry.edited_at ? Date.parse(entry.edited_at) / 1000 : null,
      like_count: 0, reply_count: 0, liked: false, can_edit: writable && entry.can_edit, can_delete: writable && Boolean(entry.can_delete),
      parent_id: root !== entry.id ? commentIds.current.get(root) : null, reply_to_user: parent ? person(parent.user_id) : null };
  };

  const focusedRoot = focusProgressId ? commentIds.current.get(roots.get(focusProgressId) || "") : undefined;
  useEffect(() => {
    if (!focusProgressId || !focusedRoot) return;
    setDay("all");
    setExpanded(focusedRoot);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => document.getElementById(`research-progress-${focusProgressId}`)?.scrollIntoView({
        block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      }));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [focusProgressId, focusedRoot]);

  const target = editor?.replyTo ? byId.get(editor.replyTo) : undefined;
  const edited = editor?.editId ? byId.get(editor.editId) : undefined;
  const targets = project.members.filter(member => member.id !== userId && (owner ? !member.owner : member.owner));
  const bonuses = project.workflow?.comment_awards ?? [];
  const commentShare = (entry: SquareStatementCommentDTO) => {
    const progress = byCommentId.get(entry.comment_id)!;
    return <ReferenceShareButton className="research-comment-share" reference={{
      kind: progress.reply_to ? "research_reply" : "research_comment", project_id: project.id, task_id: task.id, progress_id: progress.id,
    }} />;
  };

  return <section className="research-task-comments">
    {header && <div className="research-task-sticky">{header}</div>}
    <div className="research-comments-scroll">
      {children}
      <div className="research-progress-head">
        <h2>{t("researchWorkbench.discussion")}</h2>
        {items.length > 0 && <div className="research-discussion-filter">
          <SelectControl compact label={t("researchFlow.memberFilter")} value={scope} onChange={onScope}
            options={[{ value: "all", label: t("researchWorkbench.everyone") },
              ...project.members.map(member => ({ value: String(member.id), label: member.name }))]} />
          {dayChoices.length > 1 && <SelectControl compact label={t("researchFlow.discussionDate")} value={selectedDay} onChange={setDay} options={[
            { value: "all", label: t("researchWorkbench.allDates") },
            ...dayChoices.map(value => ({ value, label: researchDate(value, language) })),
          ]} />}
        </div>}
      </div>
      <div className="square-comment-list">
        {rootEntries.map(entry => {
          const root = dto(entry);
          const thread = [...(replies.get(entry.id) ?? [])].reverse().map(dto);
          return <CommentThread key={entry.id} comment={{ ...root, replies: thread, reply_count: thread.length }}
            canInteract={writable} authorAccessory={commentShare} expanded={expanded === root.comment_id}
            onToggleReplies={id => setExpanded(previous => previous === id ? null : id)}
            onEdit={comment => {
              const item = byCommentId.get(comment.comment_id);
              if (!busy && item?.can_edit) setEditor({ editId: item.id });
            }}
            onDelete={comment => {
              const item = byCommentId.get(comment.comment_id);
              if (!busy && item?.can_delete) {
                setDeleteFailed(false);
                setDeleting(item);
              }
            }}
            onOpenProfile={setProfile} onReply={comment => {
              const source = byCommentId.get(comment.comment_id);
              if (!source) return;
              setExpanded(root.comment_id);
              setEditor({ replyTo: source.id });
            }}
            renderContent={comment => {
              const item = byCommentId.get(comment.comment_id)!;
              const awards = bonuses.filter(bonus => bonus.source_id === item.id);
              return <div id={`research-progress-${item.id}`}
                className={`research-comment-anchor${focusProgressId === item.id ? " is-highlighted" : ""}${item.report_kind ? " is-report" : ""}`}>
                <div className="research-flow-metadata">
                  {!belongs(item) && <small>{t("researchFlow.replyContext")}</small>}
                  {item.report_kind && <>
                    <strong>{t(`researchFlow.${item.report_kind}`)}</strong>
                    {item.period_start && <small>{researchDate(item.period_start, language)}</small>}
                    {item.report_kind === "daily" && Boolean(item.ai_slots || item.thinking_slots) &&
                      <small>{t("researchFlow.aiTime")} {(item.ai_slots || 0) / 2}h · {t("researchFlow.thinkingTime")} {(item.thinking_slots || 0) / 2}h</small>}
                    {item.waive_reward && <small>{t("researchFlow.waived")}</small>}
                  </>}
                  {item.response_to && <strong className={`research-answer-status ${item.resolved_at ? "is-resolved" : "is-pending"}`}>
                    {t(item.resolved_at ? "researchFlow.answered" : "researchFlow.response")} · {person(item.response_to).name}
                  </strong>}
                </div>
                <Markdown body={comment.text} />
                {(awards.length > 0 || owner && writable && item.user_id !== userId) && <div className="research-note-awards">
                  {awards.map(bonus => <small key={bonus.id}>+{bonus.amount} {project.workflow?.reward_types.find(reward => reward.id === bonus.reward_type)?.name ||
                    t(`researchFlow.${bonus.reward_type}` as TranslationKey)} · {bonus.reason}</small>)}
                  {owner && writable && item.user_id !== userId && <button type="button" className="research-inline-action" disabled={busy}
                    onClick={() => setAward({ userId: item.user_id, sourceId: item.id, awardId: awards[0]?.id })}>
                    {t(awards.length ? "researchFlow.editBonus" : "researchFlow.award")}
                  </button>}
                </div>}
              </div>;
            }} />;
        })}
      </div>
      {!rootEntries.length && <QuietState icon="forum"
        title={t(task.progress.length ? "researchWorkbench.noMatchingUpdate" : "research.noProgress")}
        description={task.progress.length ? undefined : t("researchWorkbench.firstUpdateHint")} />}
    </div>

    {writable && <div className="research-compose-dock">
      <button type="button" className="button" disabled={busy} onClick={() => setEditor({})}>
        <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>{t("researchWorkbench.writeUpdate")}
      </button>
    </div>}
    <SideDrawer className="research-workflow-drawer research-writing-drawer" showTitle historyKey="research-write-update" open={Boolean(editor) && writable && (!editor?.editId || Boolean(edited))}
      title={t(edited ? "research.editProgress" : target ? "researchWorkbench.publishReply" : "researchWorkbench.writeUpdate")} onClose={() => { if (!busy) setEditor(null); }}>
      {editor && <ResearchNoteEditor key={editor.editId || editor.replyTo || "update"}
        draftKey={`note:${userId}:${project.id}:${task.id}:${editor.editId ? `edit:${editor.editId}` : editor.replyTo || ""}`}
        task={task} target={target} targetName={target ? person(target.user_id).name : undefined} targets={edited ? [] : targets} edited={edited}
        owner={owner} busy={busy} error={error} onSend={async (body, recipient) => {
          const ok = edited
            ? await mutate({ action: "progress_edit", task_id: task.id, progress_id: edited.id, body })
            : await send(body, editor.replyTo, recipient);
          if (ok) {
            if (target) setExpanded(commentIds.current.get(roots.get(target.id) ?? target.id) ?? null);
            setEditor(null);
          }
          return Boolean(ok);
        }} />}
    </SideDrawer>
    <ConfirmDialog open={Boolean(deleting)} busy={busy} danger title={t("research.deleteProgress")}
      description={t(deleting?.report_kind ? "research.deleteReportHint" : "research.deleteProgressHint")}
      confirmLabel={t("common.delete")} onClose={() => { if (!busy) setDeleting(null); }}
      onConfirm={async () => {
        if (!deleting || busy) return;
        setDeleteFailed(false);
        const ok = await mutate({ action: "progress_delete", task_id: task.id, progress_id: deleting.id });
        if (ok) setDeleting(null);
        else setDeleteFailed(true);
      }}>
      {deleteFailed && <p role="alert" className="research-form-error">{error || t("research.failed")}</p>}
    </ConfirmDialog>
    <SideDrawer className="research-workflow-drawer" open={Boolean(award)} historyKey="research-comment-award"
      title={t("researchFlow.award")} onClose={() => { if (!busy) setAward(null); }}>
      {award && <ResearchAwardForm key={award.awardId || award.sourceId} award={bonuses.find(item => item.id === award.awardId)}
        project={project} userId={award.userId} sourceId={award.sourceId} busy={busy} mutate={mutate} onDone={() => setAward(null)} />}
    </SideDrawer>
    <SideDrawer headerless historyKey="research-comment-profile" open={Boolean(profile)} onClose={() => setProfile(null)} title={t("profile.details")}>
      {profile && <UserProfilePanel userId={profile.user_id} initialUser={profile} />}
    </SideDrawer>
  </section>;
}

function ResearchNoteEditor({ draftKey, task, target, targetName, targets, edited, owner, busy, error, onSend }: {
  draftKey: string; task: ResearchTask; target?: ResearchProgress; targetName?: string; targets: ResearchMember[];
  edited?: ResearchProgress; owner: boolean; busy: boolean; error?: string; onSend: (body: string, recipient?: number) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [body, setBody] = useResearchDraft(draftKey, edited?.body);
  const [request, setRequest] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recipient, setRecipient] = useState(() => String(targets.find(member => member.id === target?.user_id)?.id || targets[0]?.id || ""));
  const recipientId = targets.some(member => member.id === Number(recipient)) ? Number(recipient) : targets[0]?.id;
  return <form className="research-form research-note-form" onSubmit={async event => {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setFailed(false);
    const ok = await onSend(body, request ? recipientId : undefined);
    if (ok) setBody("");
    else setFailed(true);
  }}>
    <div className="research-report-context"><strong>{task.title}</strong></div>
    {target && <blockquote className="research-note-context"><strong>{targetName}</strong><small>{researchExcerpt(target)}</small></blockquote>}
    <MarkdownInput value={body} onChange={setBody} rows={8} required mobileImmersive={false} workspace />
    {targets.length > 0 && <SettingRow title={t(owner ? "researchFlow.needsAnswer" : "researchFlow.askMentor")} trailing={
      <SettingSwitch label={t(owner ? "researchFlow.needsAnswer" : "researchFlow.askMentor")} checked={request} onChange={setRequest} disabled={busy} />
    } />}
    {request && targets.length > 1 && <SelectControl label={t("researchFlow.answerTarget")} value={String(recipientId ?? "")}
      onChange={setRecipient} options={targets.map(member => ({ value: String(member.id), label: member.name }))} disabled={busy} />}
    {failed && <p role="alert" className="research-form-error">{error || t("research.failed")}</p>}
    <footer className="research-task-editor-footer">
      <button className="button" disabled={busy || !body.trim()} type="submit">{t(busy ? "common.processing" : edited ? "common.save" : target ? "researchWorkbench.publishReply" : "researchWorkbench.publishUpdate")}</button>
    </footer>
  </form>;
}
