import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeCompact } from '../src/lib/compactTransport.ts';

const read = (path: string) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
test('profile awards share a compact two-column area', async () => {
  assert.match(await read('components/UserProfileCard.tsx'), /className="user-profile-awards"/);
  assert.match(await read('components/FounderMedals.css'), /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(await read('components/GrowthHonor.tsx'), /honorCopy/);
});
test('growth atlas and ceremony share previews, without timer-driven reward changes', async () => {
  for (const file of ['components/GrowthAtlas.tsx', 'components/GrowthLevelCelebration.tsx']) {
    assert.match(await read(file), /GrowthRewardPreview/);
  }
  const ceremony = await read('components/GrowthLevelCelebration.tsx');
  assert.doesNotMatch(ceremony, /setTimeout\(\(\) => setRewardCursor/);
  assert.match(ceremony, /useModalFocus\(celebrationRoot/);
});
test('preview layout isolates the settings grid and desktop neutral-background override', async () => {
  const css = await read('components/GrowthExperience.css');
  assert.match(css, /\.growth-sample-bubble\.field-chat_bubble_style \{ grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /min-width:600px\) and \(max-height:550px/);
  assert.match(await read('styles/app/20-profile-settings.css'), /chat-detail-scene:not\(\.is-preview-scene\):is/);
  assert.match(await read('pages/ChatsPage.tsx'), /chat-detail-scene is-preview-scene/);
});
test('growth report keeps its own compact response kind', () => {
  const value = decodeCompact({format:'compact-v1' as const,kind:'growth-report' as const,schemas:[['record_count','score']],records:[[0,3,120]],root:[-2,0]},'growth-report');
  assert.deepEqual(value, {record_count:3,score:120});
});
