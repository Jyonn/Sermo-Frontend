import type { ComponentProps } from "react";
import { useI18n } from "../lib/language";
import type { SquareStatementCommentDTO } from "../types";
import { ContentLoader, QuietState } from "./BoundaryState";
import { CommentThread } from "./CommentThread";
import { FeedbackState } from "./FeedbackState";

type CommentSort = "hot" | "latest";
type SquareDiscussionProps = Pick<ComponentProps<typeof CommentThread>,
  "canInteract" | "onDelete" | "onLike" | "onOpenProfile" | "onReply" | "onToggleReplies" | "renderContent"
> & {
  comments: SquareStatementCommentDTO[];
  count: number;
  error: string;
  expandedCommentId: number | null;
  hasMore: boolean;
  loading: boolean;
  sort: CommentSort;
  onSortChange: (sort: CommentSort) => void;
  onRetry: () => void;
  onLoadMore: () => void;
};

export function SquareDiscussion({
  comments, count, error, expandedCommentId, hasMore, loading, sort,
  onSortChange, onRetry, onLoadMore, ...threadProps
}: SquareDiscussionProps) {
  const { t } = useI18n();
  const hasComments = comments.length > 0;

  return <section className="square-discussion-section">
    <div className="square-comments-heading">
      <div><strong>{t("square.comments")}</strong><span>{count}</span></div>
      {hasComments ? <div className="square-comments-sort" role="group" aria-label={t("square.commentSortLabel")}>
        <button aria-pressed={sort === "hot"} className={sort === "hot" ? "is-active" : ""} onClick={() => onSortChange("hot")} type="button">{t("square.commentsHot")}</button>
        <button aria-pressed={sort === "latest"} className={sort === "latest" ? "is-active" : ""} onClick={() => onSortChange("latest")} type="button">{t("square.commentsLatest")}</button>
      </div> : null}
    </div>
    {loading && !hasComments ? <ContentLoader label={t("common.loading")} rows={3} /> : null}
    {error ? <FeedbackState tone="error" title={error} action={<button className="secondary-button" onClick={onRetry} type="button">{t("common.retry")}</button>} /> : null}
    {!loading && !hasComments && !error ? <QuietState icon="forum" title={t("square.noComments")} description={threadProps.canInteract ? t("square.noCommentsHint") : t("square.readOnlyHint")} /> : null}
    <div className={`square-comment-list${loading && hasComments ? " is-refreshing" : ""}`}>
      {comments.map((comment) => <CommentThread
        {...threadProps}
        comment={comment}
        expanded={expandedCommentId === comment.comment_id}
        key={comment.comment_id}
      />)}
    </div>
    {hasMore ? <button className="square-load-more" disabled={loading} onClick={onLoadMore} type="button">{t("square.loadMoreComments")}</button> : null}
  </section>;
}
