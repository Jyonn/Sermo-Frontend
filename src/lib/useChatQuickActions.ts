import { useMemo, useSyncExternalStore } from "react";
import { normalizeChatActions, type ChatQuickAction } from "./chatQuickActions";
const event = "frienden:chat-quick-actions";
const keyFor = (scope: string) => `frienden:chat-quick-actions:v1:${scope}`;
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener); window.addEventListener("storage", listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener("storage", listener); };
};
export function useChatQuickActions(scope: string) {
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(keyFor(scope)); } catch { return null; } }, () => null);
  const actions = useMemo(() => { try { return normalizeChatActions(JSON.parse(raw || "null")); } catch { return normalizeChatActions(null); } }, [raw]);
  const save = (next: ChatQuickAction[]) => {
    try { localStorage.setItem(keyFor(scope), JSON.stringify(normalizeChatActions(next))); window.dispatchEvent(new Event(event)); return true; } catch { return false; }
  };
  return { actions, save };
}
