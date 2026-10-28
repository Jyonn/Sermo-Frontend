import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('research invitations have a theme-aware surface and the shared invitation footer',()=>{
  const source=readFileSync(new URL('../src/pages/ChatsPage.tsx',import.meta.url),'utf8');
  const branch=source.slice(source.indexOf('if (invitation.project) return'),source.indexOf('const authorNames = invitation.submission'));
  assert.match(branch,/message-research-invite-card/);
  assert.doesNotMatch(branch,/message-submission-invite-card|message-submission-invite-status/);
  assert.match(branch,/message-submission-invite-footer/);
  assert.match(branch,/submission.viewInvite/);
  assert.match(branch,/sermo:submission-invite/);
  const css=readFileSync(new URL('../src/components/ResearchInvitationCard.css',import.meta.url),'utf8');
  assert.match(css,/background: var\(--bg-panel-strong\)/);
  assert.match(css,/padding: 12px 18px/);
  assert.match(css,/overflow-wrap: anywhere/);
  assert.match(css,/:focus-visible/);
});
