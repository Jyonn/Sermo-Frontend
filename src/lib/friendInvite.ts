const PENDING_FRIEND_INVITE_TOKEN_KEY = "sermo.pending.friend-invite-token";

export function readPendingFriendInviteToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PENDING_FRIEND_INVITE_TOKEN_KEY) ?? "";
}

export function storePendingFriendInviteToken(token: string) {
  if (typeof window === "undefined") return;
  const normalized = token.trim();
  if (!normalized) {
    window.sessionStorage.removeItem(PENDING_FRIEND_INVITE_TOKEN_KEY);
    return;
  }
  window.sessionStorage.setItem(PENDING_FRIEND_INVITE_TOKEN_KEY, normalized);
}

export function clearPendingFriendInviteToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_FRIEND_INVITE_TOKEN_KEY);
}
