import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file: string) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('research project panels preserve a real embedded conversation and onboarding', () => {
  const page=source('pages/ResearchPage.tsx');
  assert.match(page,/historyKey="research-project"/);
  assert.match(page,/historyKey="research-chat"/);
  assert.match(page,/<EmbeddedChats embeddedChat=/);
  assert.match(page,/setOnboarding\(true\)/);
  assert.match(page,/pending_invitee_ids\?\.includes/);
  const chats=source('pages/ChatsPage.tsx');
  assert.match(chats,/embedded=\{!!embeddedChat\}/);
  assert.match(chats,/if \(embeddedChat\) \{ embeddedChat.onClose\(\); return; \}/);
  assert.match(chats,/result.invitation.project.id/);
});

test('calendar consent is global and explicit, and empty views reuse the same component', () => {
  const calendar=source('components/ResearchCalendar.tsx');
  assert.match(calendar,/default_busy:defaultBusy/);
  assert.match(calendar,/onboarding.*!value.policy_configured/);
  assert.match(calendar,/research.finePermissions/);
  assert.match(source('pages/SquarePage.tsx'),/<QuietState icon="forum" title=\{t\("square.noComments"\)\}/);
  assert.match(source('components/SquareExperience.css'),/grid-template-columns:minmax\(0,1fr\) 24px minmax\(0,1fr\)/);
});

test('project details reuse chat sections and shared settings groups', () => {
  const text = source('components/ResearchProjectDetails.tsx');
  assert.match(text, /chat-detail-panel research-project-details/);
  assert.match(text, /chat-detail-people-section/);
  assert.match(text, /chat-detail-danger-section/);
  assert.match(text, /<ResearchMemberGrid/);
  assert.match(text, /<SettingGroup>/);
  assert.match(text, /tone="danger"/);
  assert.doesNotMatch(text, /research-form|ghost-button|<h2/);
  assert.match(source('pages/ResearchPage.tsx'), /limit=\{1\} allowEmpty=\{false\}/);
});

test('research and Square share date summaries and date wheels', () => {
  assert.match(source('components/SquareSearchDialog.tsx'), /<DateRangeSummary/);
  const range = source('components/DateRangeField.tsx');
  assert.match(range, /<DateWheelPicker/);
  assert.match(range, /name="start" value=\{range.from\}/);
  assert.match(range, /name="end" value=\{range.to\}/);
  assert.match(range, /next.to < next.from/);
  const page = source('pages/ResearchPage.tsx');
  assert.match(page, /<DateRangeField\/>/);
  assert.doesNotMatch(page, /type="date"/);
});

test('research uses framed avatars and one member picker rather than initial placeholders', () => {
  for (const file of ['components/ResearchPeople.tsx', 'components/MemberPickerSheet.tsx', 'components/ResearchCalendar.tsx', 'pages/ResearchPage.tsx']) {
    const text = source(file);
    assert.match(text, /<UserAvatar/);
    assert.match(text, /frame=\{/);
    assert.doesNotMatch(text, /research-person-initial/);
    assert.match(text, /MemberPickerSheet/);
  }
  const people = source('components/ResearchPeople.tsx');
  assert.match(people, /chat-detail-member-grid/);
  assert.match(people, /name="member" value=\{id\}/);
  assert.match(source('components/ResearchWorkspace.tsx'), /<ResearchMemberGrid/);
});
