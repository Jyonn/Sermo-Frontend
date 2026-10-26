import assert from 'node:assert/strict';
import test from 'node:test';
import { seed, visibleEntries, canWrite } from './model.ts';
test('mentor sees all task records, student cannot see another student’s records', () => {
  assert.equal(visibleEntries(seed[0].tasks[0], 0, true).length, 2);
  assert.equal(visibleEntries(seed[0].tasks[0], 1, false).length, 2);
  assert.equal(visibleEntries(seed[0].tasks[0], 2, false).length, 0);
});
test('completed projects are read-only', () => {
  assert.equal(canWrite(seed[0]), true);
  assert.equal(canWrite(seed[1]), true);
  assert.equal(canWrite(seed[2]), false);
});
test('feedback remains private even on tasks with multiple assignees', () => {
  const sharedTask = { ...seed[0].tasks[0], assignees: [1, 2] };
  assert.equal(visibleEntries(sharedTask, 2, false).length, 0);
  assert.equal(visibleEntries(sharedTask, 1, false).length, 2);
});
