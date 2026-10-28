import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { visibleCommentReplyTarget } from "../lib/squareComments";
import { formatRelativeTime } from "../lib/presentation";
import { UserAvatar } from "./UserAvatar";
import { GrowthLevelBadge } from "./GrowthLevelBadge";
import type { SquareStatementCommentDTO, TinyUserDTO } from "../types";

function isUnclaimedQqUser(user?: TinyUserDTO | null) {
  return user?.external_identity?.provider === "qq";
}

function QqSourceTag({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return <span className={`square-qq-source-tag${compact ? " is-compact" : ""}`}><span className="square-qq-source-tag-mark">QQ</span>{compact ? null : <span className="square-qq-source-tag-label">{t("square.qqSource")}</span>}</span>;
}

export function CommentThread({ comment, canInteract, expanded = false, onDelete, onLike, onOpenProfile, onReply, onToggleReplies, renderContent }: {
  comment: SquareStatementCommentDTO;
  canInteract: boolean;
  expanded?: boolean;
  onDelete: (comment: SquareStatementCommentDTO) => void;
  onLike?: (comment: SquareStatementCommentDTO) => void;
  renderContent: (comment: SquareStatementCommentDTO, onReply: (event: ReactMouseEvent) => void) => ReactNode;
  onOpenProfile: (user: TinyUserDTO) => void;
  onReply: (comment: SquareStatementCommentDTO) => void;
  onToggleReplies?: (commentId: number) => void;
}) {
  const { t } = useI18n();
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuPosition) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuPosition(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuPosition]);
  const beginReply = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (canInteract) onReply(comment);
  };
  const qqUser = isUnclaimedQqUser(comment.user);
  const layerReplyTarget = visibleCommentReplyTarget(comment);
  const displayName = comment.is_anonymous ? t("square.anonymousUser") : comment.user.name;
  const replyCount = Math.max(comment.reply_count || 0, comment.replies?.length || 0);
  const hasExpandableReplies = !comment.parent_id && replyCount > 0;
  const toggleReplies = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (hasExpandableReplies) onToggleReplies?.(comment.comment_id);
  };
  return <article className={`square-comment-thread${canInteract ? " is-replyable" : ""}${hasExpandableReplies ? " has-replies" : ""}`} onClick={comment.parent_id ? beginReply : toggleReplies}>
    {comment.is_anonymous ? <span className="square-anonymous-avatar square-comment-avatar"><span className="material-symbols-outlined">person</span></span> : <button aria-label={comment.user.name} className="square-comment-avatar-button" onClick={(event) => { event.stopPropagation(); onOpenProfile(comment.user); }} type="button"><UserAvatar className="square-comment-avatar" frame={comment.user.avatar_frame_style} name={comment.user.name} uri={comment.user.avatar_uri} /></button>}
    <div>
      <header><div className={`square-comment-author-name${comment.is_anonymous ? " is-anonymous" : ""}${comment.user.is_permanent_vip ? " is-vip" : ""}`}>{qqUser ? <button className="square-comment-author-profile" onClick={(event) => { event.stopPropagation(); onOpenProfile(comment.user); }} type="button"><strong>{displayName}</strong><QqSourceTag /></button> : <><strong>{displayName}</strong>{!comment.is_anonymous && comment.user.growth_level ? <GrowthLevelBadge level={comment.user.growth_level} name={comment.user.growth_level_name} /> : null}</>}{comment.is_author ? <em>{t("square.authorTag")}</em> : null}{layerReplyTarget ? <span className="square-comment-relation"><i aria-hidden="true" />{layerReplyTarget.anonymous ? t("square.anonymousUser") : layerReplyTarget.name}</span> : null}</div>{comment.can_delete ? <button aria-expanded={Boolean(menuPosition)} aria-label={t("common.more")} className="square-comment-more" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const width = 104; setMenuPosition((current) => current ? null : { top: rect.bottom + 5, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) }); }} type="button"><span className="material-symbols-outlined">more_horiz</span></button> : null}</header>
      {renderContent(comment, beginReply)}
      <div className="square-comment-footer">
        <time>{formatRelativeTime(comment.created_at)}</time>
        <div className="square-comment-actions">
          {canInteract ? <button onClick={beginReply} type="button"><span>{t("square.reply")}</span></button> : null}
          {onLike ? <button className={comment.liked ? "is-liked" : ""} disabled={!canInteract} onClick={(event) => { event.stopPropagation(); onLike(comment); }} type="button"><span className="material-symbols-outlined">favorite</span><span>{comment.like_count || t("square.like")}</span></button> : null}
        </div>
      </div>
      {hasExpandableReplies ? <button aria-expanded={expanded} className="square-comment-replies-toggle" onClick={toggleReplies} type="button"><span>{expanded ? t("square.hideReplies") : t("square.viewReplies", { count: replyCount })}</span><span className="material-symbols-outlined">chevron_right</span></button> : null}
      {hasExpandableReplies && comment.replies?.length ? <div aria-hidden={!expanded} className={`square-comment-replies-shell${expanded ? " is-expanded" : ""}`}><div className="square-comment-replies">{comment.replies.map((reply) => <CommentThread canInteract={canInteract} comment={reply} key={reply.comment_id} onDelete={onDelete} onLike={onLike} onOpenProfile={onOpenProfile} onReply={onReply} renderContent={renderContent} />)}</div></div> : null}
    </div>
    {menuPosition && typeof document !== "undefined" ? createPortal(<div className="square-comment-menu" onClick={(event) => event.stopPropagation()} ref={menuRef} style={menuPosition}><button onClick={(event) => { event.stopPropagation(); setMenuPosition(null); onDelete(comment); }} type="button"><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button></div>, document.body) : null}
  </article>;
}
