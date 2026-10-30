export const DEFAULT_CHAT_ACTIONS = ["locked", "calendar", "copy", "status"] as const;
export const CHAT_ACTION_OPTIONS = [...DEFAULT_CHAT_ACTIONS, "search"] as const;
export type ChatQuickAction = typeof CHAT_ACTION_OPTIONS[number];
export function normalizeChatActions(value: unknown): ChatQuickAction[] {
  if (!Array.isArray(value)) return [...DEFAULT_CHAT_ACTIONS];
  const valid = [...new Set(value.filter((item): item is ChatQuickAction => CHAT_ACTION_OPTIONS.includes(item)))].slice(0, 4);
  return valid.length ? valid : [...DEFAULT_CHAT_ACTIONS];
}
export function availableChatActions(preferences: ChatQuickAction[], available: Partial<Record<ChatQuickAction, boolean>>) {
  return preferences.filter((key) => available[key]);
}
