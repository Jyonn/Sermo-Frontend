export const SQUARE_NOTIFICATIONS_UPDATED_EVENT = "sermo:square-notifications-updated";

export type SquareBadgeStatus = {
  unreadCount: number;
  hasFreshContent: boolean;
  claimableActivityKeys: string[];
};

export function squareBadgeUpdate(unreadCount: number, status?: Partial<SquareBadgeStatus>) {
  return {
      unreadCount: Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0,
      ...(status?.hasFreshContent !== undefined ? { hasFreshContent: Boolean(status.hasFreshContent) } : {}),
      ...(status?.claimableActivityKeys !== undefined ? { claimableActivityKeys: status.claimableActivityKeys } : {}),
  };
}

export function announceSquareUnread(unreadCount: number, status?: Partial<SquareBadgeStatus>) {
  window.dispatchEvent(new CustomEvent(SQUARE_NOTIFICATIONS_UPDATED_EVENT, {
    detail: squareBadgeUpdate(unreadCount, status),
  }));
}
