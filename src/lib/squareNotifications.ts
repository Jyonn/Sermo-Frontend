export const SQUARE_NOTIFICATIONS_UPDATED_EVENT = "sermo:square-notifications-updated";

export type SquareBadgeStatus = {
  unreadCount: number;
  hasFreshContent: boolean;
  claimableActivityKeys: string[];
};

export function announceSquareUnread(unreadCount: number, status?: Partial<SquareBadgeStatus>) {
  window.dispatchEvent(new CustomEvent(SQUARE_NOTIFICATIONS_UPDATED_EVENT, {
    detail: {
      unreadCount: Math.max(0, unreadCount),
      hasFreshContent: Boolean(status?.hasFreshContent),
      claimableActivityKeys: status?.claimableActivityKeys ?? [],
    },
  }));
}
