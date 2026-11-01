import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryPagingIntent } from '../src/lib/historyPagingIntent.ts';

test('initial layout and restored-history positioning never request older pages', () => {
  const intent = new HistoryPagingIntent();
  for (const top of [0, 10, 300, 0]) assert.equal(intent.consume(top, 100), false);
});
test('one upward gesture permits one page only when it reaches the top', () => {
  const intent = new HistoryPagingIntent();
  intent.arm(100);
  assert.equal(intent.consume(90, 200), false);
  assert.equal(intent.consume(24, 300), true);
  assert.equal(intent.consume(0, 400), false);
  intent.arm(500);
  assert.equal(intent.consume(0, 600), true);
});
test('stale gestures and switching or reloading a chat cannot trigger pagination', () => {
  const intent = new HistoryPagingIntent();
  intent.arm(100);
  assert.equal(intent.consume(0, 1400), false);
  intent.arm(1500);
  intent.reset();
  assert.equal(intent.consume(0, 1600), false);
});
