import type { AccessPayload } from "../types";

export function mergeSessionUser(previous: AccessPayload, refreshed: AccessPayload): AccessPayload {
  if (previous.user_id !== refreshed.user_id || previous.space_id !== refreshed.space_id) return refreshed;
  return applySessionUserPatch(previous, refreshed);
}

export function applySessionUserPatch(previous: AccessPayload, patch: Partial<AccessPayload>): AccessPayload {
  const next = { ...previous, ...patch };
  if (patch.avatar_uri !== undefined && patch.avatar_uri !== previous.avatar_uri && !("avatar_cache_key" in patch)) {
    next.avatar_cache_key = undefined;
  }
  return next;
}
