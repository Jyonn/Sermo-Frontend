import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unreadIndicator } from '../src/lib/unreadIndicator.ts';
import { availableSquareQuota } from '../src/lib/squareQuota.ts';
import { legacySquareDateRange } from '../src/lib/squareSearch.ts';
import { squareFeedCacheKey } from '../src/lib/squareFeedCache.ts';
import { announceSquareStatus, SQUARE_NOTIFICATIONS_UPDATED_EVENT, squareBadgeUpdate } from '../src/lib/squareNotifications.ts';

test('unread numbers take precedence over fresh dots and never expose invalid counts', () => {
  assert.equal(unreadIndicator(0), null);
  assert.equal(unreadIndicator(0, true)?.kind, 'dot');
  assert.equal(unreadIndicator(7, true)?.label, '7');
  assert.equal(unreadIndicator(100)?.label, '99+');
  assert.equal(unreadIndicator(NaN), null);
  assert.equal(unreadIndicator(-4), null);
});
test('available interaction quota respects both rolling windows and unlimited limits', () => {
  assert.equal(availableSquareQuota(1, 4, 20, 20), 0);
  assert.equal(availableSquareQuota(0, 4, 19, 20), 1);
  assert.equal(availableSquareQuota(3, 4, 2, 20), 1);
  assert.equal(availableSquareQuota(10, null, 3, 5), 2);
  assert.equal(availableSquareQuota(10, null, 20, null), null);
});
test('date ranges isolate caches and preserve older year/month search links', () => {
  assert.deepEqual(legacySquareDateRange('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(legacySquareDateRange('2026'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(legacySquareDateRange(null), { from: '', to: '' });
  assert.notEqual(squareFeedCacheKey('friends', null, null, 'cat', '2026-10-01', null), squareFeedCacheKey('friends', null, null, 'cat', null, '2026-10-01'));
});
test('notification-only updates preserve fresh content and stale polls cannot overwrite newer events', async () => {
  assert.deepEqual(squareBadgeUpdate(2), { unreadCount: 2 });
  assert.deepEqual(squareBadgeUpdate(0, { hasFreshContent: false }), { unreadCount: 0, hasFreshContent: false });
  assert.deepEqual(squareBadgeUpdate(NaN), { unreadCount: 0 });
  const notifications = await readFile(new URL('../src/lib/squareNotifications.ts', import.meta.url), 'utf8');
  const nav = await readFile(new URL('../src/components/AppBottomNav.tsx', import.meta.url), 'utf8');
  assert.match(notifications, /status\?\.hasFreshContent !== undefined/);
  assert.match(nav, /started === revision/);
  assert.match(nav, /revision\+\+/);
  assert.match(nav, /<UnreadIndicator count=\{squareUnread\} fresh=\{squareHasFreshContent\}/);
});

test('square status keeps the two feed dots and activity keys independent', () => {
  const eventTarget = new EventTarget();
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
  const updates: unknown[] = [];
  eventTarget.addEventListener(SQUARE_NOTIFICATIONS_UPDATED_EVENT, (event) => {
    updates.push((event as CustomEvent).detail);
  });
  try {
    const status = {
      notification_unread: 0,
      explore_unread: true,
      friends_unread: false,
      activity_claimable: true,
      claimable_activity_keys: ['record-shop'],
    };
    announceSquareStatus(status, true);
    announceSquareStatus({ ...status, activity_claimable: false, claimable_activity_keys: [] }, false);
    assert.deepEqual(updates, [
      {
        unreadCount: 0,
        hasFreshContent: true,
        claimableActivityKeys: ['record-shop'],
        feedFresh: { all: true, friends: false },
      },
      {
        unreadCount: 0,
        hasFreshContent: false,
        claimableActivityKeys: [],
        feedFresh: { all: false, friends: false },
      },
    ]);
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
