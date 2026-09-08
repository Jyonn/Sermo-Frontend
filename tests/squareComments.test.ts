import assert from "node:assert/strict";
import test from "node:test";
import { visibleCommentReplyTarget } from "../src/lib/squareComments.ts";
import type { SquareStatementCommentDTO, TinyUserDTO } from "../src/types.ts";

const user = (user_id: number, name: string) => ({ user_id, name }) as TinyUserDTO;
const rootAuthor = user(1, "A");
const participant = user(2, "B");

function reply(overrides: Partial<SquareStatementCommentDTO> = {}) {
  return {
    comment_id: 3,
    statement_id: 1,
    user: participant,
    text: "回复",
    parent_id: 2,
    root_id: 1,
    reply_to_user: rootAuthor,
    like_count: 0,
    reply_count: 0,
    liked: false,
    can_delete: false,
    created_at: 1,
    ...overrides,
  } as SquareStatementCommentDTO;
}

test("hides the relation only when replying to the root comment itself", () => {
  assert.equal(visibleCommentReplyTarget(reply({ parent_id: 1, root_id: 1 })), null);
  assert.equal(visibleCommentReplyTarget(reply())?.user_id, rootAuthor.user_id);
});

test("avoids duplicating an explicit mention of the reply target", () => {
  assert.equal(visibleCommentReplyTarget(reply({ mentions: [rootAuthor] })), null);
});
