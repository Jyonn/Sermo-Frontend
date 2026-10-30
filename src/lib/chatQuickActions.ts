export const DEFAULT_CHAT_ACTIONS = ["locked", "calendar", "copy", "status"] as const;
export const CHAT_ACTION_OPTIONS = [...DEFAULT_CHAT_ACTIONS, "search"] as const;
export type ChatQuickAction = typeof CHAT_ACTION_OPTIONS[number];
export type ChatActionKind = "direct" | "group";
export const CHAT_ACTIONS_BY_KIND: Record<ChatActionKind, readonly ChatQuickAction[]> = { direct: ["locked", "calendar", "search"], group: ["locked", "copy", "status", "search"] };
export function actionsForKind(value: unknown, kind: ChatActionKind): ChatQuickAction[] {
  const source = Array.isArray(value) ? value : (value as Partial<Record<ChatActionKind, unknown>> | null)?.[kind];
  const allowed = CHAT_ACTIONS_BY_KIND[kind];
  const valid = Array.isArray(source) ? [...new Set(source.filter((item): item is ChatQuickAction => allowed.includes(item)))].slice(0, 4) : [];
  return valid.length ? valid : DEFAULT_CHAT_ACTIONS.filter(key => allowed.includes(key));
}
export function reorderChatActions(actions: ChatQuickAction[], from: ChatQuickAction, to: ChatQuickAction) {
  const start = actions.indexOf(from), end = actions.indexOf(to);
  if (start < 0 || end < 0 || start === end) return actions;
  const next = [...actions]; next.splice(start, 1); next.splice(end, 0, from); return next;
}
export function normalizeChatActions(value: unknown): ChatQuickAction[] {
  if (!Array.isArray(value)) return [...DEFAULT_CHAT_ACTIONS];
  const valid = [...new Set(value.filter((item): item is ChatQuickAction => CHAT_ACTION_OPTIONS.includes(item)))].slice(0, 4);
  return valid.length ? valid : [...DEFAULT_CHAT_ACTIONS];
}
export function availableChatActions(preferences: ChatQuickAction[], available: Partial<Record<ChatQuickAction, boolean>>) {
  return preferences.filter((key) => available[key]);
}
