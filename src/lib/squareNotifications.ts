export const SQUARE_NOTIFICATIONS_UPDATED_EVENT = "sermo:square-notifications-updated";

export function announceSquareUnread(unreadCount: number) {
  window.dispatchEvent(new CustomEvent(SQUARE_NOTIFICATIONS_UPDATED_EVENT, {
    detail: { unreadCount: Math.max(0, unreadCount) },
  }));
}
