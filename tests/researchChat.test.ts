import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import type { SubmissionInviteDTO } from "../src/types.ts";

const source = readFileSync(new URL("../src/components/ResearchChat.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} as any };
const nativeRequire = createRequire(import.meta.url);
const t = (key: string) => key;
const events: CustomEvent[] = [];
const stubs: Record<string, unknown> = {
  "../lib/api": {}, "../lib/toast": {}, "./BottomSheet": {}, "./FeedbackState": {},
  "../lib/language": { i18n: { t }, useI18n: () => ({ t }) },
  "./SettingRow": { SettingGroup: "section", SettingRow: "button" },
  "./ResearchInvitationCard.css": {},
};
runInNewContext(compiled, {
  module, exports: module.exports, CustomEvent,
  require: (name: string) => name in stubs ? stubs[name] : nativeRequire(name),
  window: { dispatchEvent: (event: CustomEvent) => events.push(event) },
});
const { ResearchInvitationCard, ResearchChatProjectLink, researchInvitationDestination, researchInvitationPreview } = module.exports;
const invitation: SubmissionInviteDTO = {
  project: { id: 7, title: "Project Alpha" }, invite_id: 8, chat_id: 9, role: "author",
  status: "pending", inviter: { user_id: 1, name: "Owner" }, invitee: { user_id: 2, name: "Member" },
  created_at: 100, expires_at: 200, accepted_at: null, can_accept: true,
  submission: { title: "Project Alpha", status: "draft", authors: [], reviewers: [] },
};

test("research cards retain project context and emit the shared invitation event", () => {
  const card = ResearchInvitationCard({ invitation, groupClassName: "self" });
  const html = renderToStaticMarkup(card);
  assert.match(html, /message-research-invite-card is-pending self/);
  assert.match(html, /Project Alpha/);
  assert.match(html, /message-submission-invite-footer/);
  let stopped = false;
  card.props.onClick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(events.at(-1)?.type, "sermo:submission-invite");
  assert.equal(events.at(-1)?.detail, invitation);
});

test("research previews and onboarding routes exclude ordinary submission invitations", () => {
  assert.equal(researchInvitationPreview(invitation), "research.invitation");
  assert.equal(researchInvitationDestination(invitation), "/app/research?project=7&onboarding=1");
  const ordinary = { ...invitation, project: undefined };
  assert.equal(researchInvitationPreview(ordinary), null);
  assert.equal(researchInvitationPreview(null), null);
  assert.equal(researchInvitationDestination(ordinary), null);
  assert.equal(ResearchInvitationCard({ invitation: ordinary, groupClassName: "" }), null);
});

test("project links prioritize embedded details and use the same route from both entry points", () => {
  const routes: string[] = [];
  const navigate = (path: string) => routes.push(path);
  let opened = 0;
  ResearchChatProjectLink({ chatId: 9, navigate, onProjectDetails: () => opened++ }).props.onClick();
  assert.equal(opened, 1);
  assert.equal(routes.length, 0);
  ResearchChatProjectLink({ chatId: 9, navigate }).props.onClick();
  const settings = ResearchChatProjectLink({ chatId: 9, navigate, settings: true });
  settings.props.children.props.children.props.onClick();
  assert.deepEqual(routes, ["/app/research?chat=9&details=1", "/app/research?chat=9&details=1"]);
});
