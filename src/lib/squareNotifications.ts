import type { SquareStatusDTO } from "../types";

export const SQUARE_NOTIFICATIONS_UPDATED_EVENT = "sermo:square-notifications-updated";

export type SquareBadgeStatus = {
  unreadCount: number;
  hasFreshContent: boolean;
  claimableActivityKeys: string[];
  feedFresh: { all: boolean; friends: boolean };
};

export function squareBadgeUpdate(unreadCount: number, status?: Partial<SquareBadgeStatus>) {
  return {
      unreadCount: Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0,
      ...(status?.hasFreshContent !== undefined ? { hasFreshContent: Boolean(status.hasFreshContent) } : {}),
      ...(status?.claimableActivityKeys !== undefined ? { claimableActivityKeys: status.claimableActivityKeys } : {}),
      ...(status?.feedFresh !== undefined ? { feedFresh: status.feedFresh } : {}),
  };
}

export function announceSquareUnread(unreadCount: number, status?: Partial<SquareBadgeStatus>) {
  window.dispatchEvent(new CustomEvent(SQUARE_NOTIFICATIONS_UPDATED_EVENT, {
    detail: squareBadgeUpdate(unreadCount, status),
  }));
}

export function announceSquareStatus(status: SquareStatusDTO, exploreEnabled: boolean) {
  const all = exploreEnabled && status.explore_unread;
  const friends = status.friends_unread;
  announceSquareUnread(status.notification_unread, {
    feedFresh: { all, friends },
    claimableActivityKeys: status.claimable_activity_keys,
    hasFreshContent: all || friends || status.activity_claimable,
  });
}
