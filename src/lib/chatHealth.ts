export const CHAT_HEALTH_EVENT = "sermo:chat-health";

export interface ChatHealthSnapshot {
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
}

const snapshots = new Map<string, ChatHealthSnapshot>();

export function getChatHealth(scope: string | null) {
  if (!scope) return { lastFailureAt: null, lastSuccessAt: null } satisfies ChatHealthSnapshot;
  return snapshots.get(scope) ?? { lastFailureAt: null, lastSuccessAt: null };
}

export function recordChatHealth(scope: string, success: boolean) {
  const current = getChatHealth(scope);
  const snapshot: ChatHealthSnapshot = success
    ? { ...current, lastSuccessAt: Date.now() }
    : { ...current, lastFailureAt: Date.now() };
  snapshots.set(scope, snapshot);
  window.dispatchEvent(new CustomEvent(CHAT_HEALTH_EVENT, { detail: { scope, snapshot } }));
}

export function resolveChatHealth(snapshot: ChatHealthSnapshot, now = Date.now()) {
  const minute = 60_000;
  if (snapshot.lastFailureAt && now - snapshot.lastFailureAt <= minute) return "warning" as const;
  if (snapshot.lastFailureAt && (!snapshot.lastSuccessAt || snapshot.lastFailureAt > snapshot.lastSuccessAt)) return "offline" as const;
  if (snapshot.lastSuccessAt && now - snapshot.lastSuccessAt <= minute) return "healthy" as const;
  return snapshot.lastSuccessAt ? "warning" as const : "offline" as const;
}
