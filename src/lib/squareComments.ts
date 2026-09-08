import type { SquareStatementCommentDTO, TinyUserDTO } from "../types";

export function visibleCommentReplyTarget(comment: SquareStatementCommentDTO): TinyUserDTO | null {
  if (!comment.parent_id || comment.parent_id === comment.root_id || !comment.reply_to_user) return null;
  const targetAlreadyMentioned = comment.mentions?.some(
    (mention) => mention.user_id === comment.reply_to_user?.user_id,
  );
  return targetAlreadyMentioned ? null : comment.reply_to_user;
}
