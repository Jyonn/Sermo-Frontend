import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('research invitations reuse the shared invitation skin and message grouping',()=>{
  assert.match(read('components/ResearchChat.tsx'),/message-submission-invite-card message-research-invite-card is-\$\{invitation.status\} \$\{groupClassName\}/);
  const css=read('styles/app/80-chat-messages.css');
  for(const skin of ['typewriter','receipt','newspaper','fufu'])assert.ok(css.includes(`bubble-style-${skin}`));
  assert.match(css,/\.message-group\.self:not\(\.bubble-style-default\) \.message-submission-invite-card/);
  assert.match(css,/\.message-group\.other:not\(\.bubble-style-default\) \.message-submission-invite-card/);
});
test('research layout uses skin tokens rather than fixed icon, footer and byline colors',()=>{
  const css=read('components/ResearchInvitationCard.css');
  for(const token of ['background: var(--invite-surface)','color: var(--invite-text)','color: var(--invite-muted)','border-radius: var(--invite-radius)','var(--invite-accent) 58%'])assert.ok(css.includes(token));
  assert.ok(!css.includes('color: var(--brand-primary);'));
});
