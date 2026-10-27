import assert from 'node:assert/strict';
import test from 'node:test';
import { seed, visibleEntries, visibleTasks, chatGroups, canLinkChat, canWrite } from './model.ts';
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
test('all project members can browse task briefs without exposing private entries', () => {
  assert.equal(visibleTasks(seed[0], 'all').length, 4);
  const peerTask = visibleTasks(seed[0], 'all').find(task => task.id === 12)!;
  assert.ok(peerTask.description.length > 0);
  assert.equal(visibleEntries(peerTask, 1, false).length, 0);
  assert.equal(visibleEntries(peerTask, 2, false).length, 1);
  assert.equal(visibleEntries(peerTask, 0, true).length, 1);
});
test('mentor can link an existing group without automatically adding project members', () => {
  assert.equal(canLinkChat(seed[0], chatGroups[0]), true);
  assert.equal(canLinkChat(seed[0], chatGroups[2]), true);
  assert.equal(canLinkChat(seed[0], {...chatGroups[0],members:[1,2]}), false);
  assert.deepEqual(chatGroups[2].members,[0,3]);
});
