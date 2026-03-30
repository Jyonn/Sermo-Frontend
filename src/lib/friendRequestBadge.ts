export const FRIEND_REQUESTS_UPDATED_EVENT = "sermo:friend-requests-updated";

export function emitFriendRequestsUpdated(incomingCount: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ incomingCount: number }>(FRIEND_REQUESTS_UPDATED_EVENT, {
      detail: { incomingCount: Math.max(0, incomingCount) },
    })
  );
}
