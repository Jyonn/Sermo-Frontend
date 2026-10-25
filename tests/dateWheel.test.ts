import test from 'node:test';
import assert from 'node:assert/strict';
import { daysInMonth, wheelDate } from '../src/lib/dateWheel.ts';

test('Gregorian leap years include century rules', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2100, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
});
test('wheel changes clamp the day and serialize without timezone shifts', () => {
  assert.equal(wheelDate(2025, 2, 29), '2025-02-28');
  assert.equal(wheelDate(2026, 4, 31), '2026-04-30');
  assert.equal(wheelDate(2026, 12, 31), '2026-12-31');
  assert.equal(wheelDate(2026, 1, 0), '2026-01-01');
});
