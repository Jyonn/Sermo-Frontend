import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('research invitations have a theme-aware surface and the shared invitation footer',()=>{
  const source=readFileSync(new URL('../src/components/ResearchChat.tsx',import.meta.url),'utf8');
  const branch=source.slice(source.indexOf('export function ResearchInvitationCard'),source.indexOf('export function ResearchChatProjectLink'));
  assert.match(branch,/message-research-invite-card/);
  assert.match(branch,/message-submission-invite-card/);
  assert.doesNotMatch(branch,/message-submission-invite-status/);
  assert.match(branch,/message-submission-invite-footer/);
  assert.match(branch,/submission.viewInvite/);
  assert.match(branch,/sermo:submission-invite/);
  const css=readFileSync(new URL('../src/components/ResearchInvitationCard.css',import.meta.url),'utf8');
  assert.match(css,/--invite-surface: var\(--bg-panel-strong\)/);
  assert.match(css,/background: var\(--invite-surface\)/);
  assert.match(css,/padding: 12px 18px/);
  assert.match(css,/overflow-wrap: anywhere/);
  assert.match(css,/:focus-visible/);
});
