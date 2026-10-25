import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { growthLevelLabel } from '../src/lib/growth-stage.ts';

test('level labels preserve custom space names without a dangling separator', () => {
  assert.equal(growthLevelLabel(16, '盛放'), 'LV 16·盛放');
  assert.equal(growthLevelLabel(1, ' First '), 'LV 1·First');
  assert.equal(growthLevelLabel(18, ''), 'LV 18');
  assert.equal(growthLevelLabel(99), 'LV 18');
});
test('public profiles display translated annual medals and all Square badges receive names', async () => {
  const profile = await readFile(new URL('../src/components/UserProfileCard.tsx', import.meta.url), 'utf8');
  const square = await readFile(new URL('../src/pages/SquarePage.tsx', import.meta.url), 'utf8');
  assert.match(profile, /t\("profile.founderMedal", \{ year \}\)/);
  assert.match(square, /name=\{statement.user.growth_level_name\}/);
  assert.match(square, /name=\{comment.user.growth_level_name\}/);
});
test('the founder poster uses server acknowledgement before the level ceremony', async () => {
  const source = await readFile(new URL('../src/components/GrowthLevelCelebration.tsx', import.meta.url), 'utf8');
  assert.match(source, /growthToken === session\?\.accessToken/);
  assert.match(source, /api.acknowledgeFounderMedal\(pendingFounderYear\)/);
  assert.ok(source.indexOf('if (pendingFounderYear) return') < source.indexOf('if (!growth || !pendingLevel || !level) return null'));
});
