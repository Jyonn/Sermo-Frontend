import test from 'node:test';
import assert from 'node:assert/strict';
import { bgmDeadlineDelay, bgmRunAvailable } from '../src/lib/bgmPolicy.ts';

test('BGM closes at the exact space deadline regardless of a saved auto setting', () => {
  const activity = { active: true, starts_at: 100, ends_at: 200, bgm: { mode: 'auto', joined: true } };
  assert.equal(bgmRunAvailable(activity, 199_999), true);
  assert.equal(bgmRunAvailable(activity, 200_000), false);
  assert.equal(bgmRunAvailable(activity, 200_001), false);
  assert.equal(bgmRunAvailable({ ...activity, active: false }, 150_000), false);
});

test('missing, future, disabled and malformed activities never grant playback', () => {
  assert.equal(bgmRunAvailable(null), false);
  assert.equal(bgmRunAvailable(undefined), false);
  assert.equal(bgmRunAvailable({ active: true, starts_at: 200, ends_at: 300 }, 100_000), false);
  assert.equal(bgmRunAvailable({ active: true, starts_at: 100, ends_at: NaN }, 150_000), false);
  assert.equal(bgmRunAvailable({ active: true, starts_at: 100, ends_at: null }, 150_000), true);
});

test('expiry timer supports long campaigns without overflowing browser timeouts', () => {
  const activity = { active: true, starts_at: 100, ends_at: 200 };
  assert.equal(bgmDeadlineDelay(activity, 199_000), 1001);
  assert.equal(bgmDeadlineDelay(activity, 200_001), 0);
  assert.equal(bgmDeadlineDelay({ ...activity, ends_at: 4_000_000 }, 0), 2_147_483_647);
  assert.equal(bgmDeadlineDelay({ ...activity, ends_at: null }), null);
});
