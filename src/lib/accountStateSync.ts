import type { FriendshipRequestDTO, UserDTO } from "../types";

export const ACCOUNT_STATE_CHANGED_EVENT = "sermo:account-state-changed";

export interface AccountStateChange {
  chats: boolean;
  friends: boolean;
  friendRequests: boolean;
  friendRows?: UserDTO[];
  requestRows?: {
    incoming: FriendshipRequestDTO[];
    outgoing: FriendshipRequestDTO[];
  };
}

export function emitAccountStateChanged(detail: AccountStateChange) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AccountStateChange>(ACCOUNT_STATE_CHANGED_EVENT, { detail }));
}
