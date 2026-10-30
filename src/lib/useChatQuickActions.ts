import { useMemo, useSyncExternalStore } from "react";
import { actionsForKind, type ChatActionKind, type ChatQuickAction } from "./chatQuickActions";
const event = "frienden:chat-quick-actions";
const keyFor = (scope: string) => `frienden:chat-quick-actions:v2:${scope}`;
const read = (scope: string) => { try { return localStorage.getItem(keyFor(scope)) ?? localStorage.getItem(`frienden:chat-quick-actions:v1:${scope}`); } catch { return null; } };
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener); window.addEventListener("storage", listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener("storage", listener); };
};
export function useChatQuickActions(scope: string, kind: ChatActionKind = "group") {
  const raw = useSyncExternalStore(subscribe, () => read(scope), () => null);
  const actions = useMemo(() => { try { return actionsForKind(JSON.parse(raw || "null"), kind); } catch { return actionsForKind(null, kind); } }, [raw, kind]);
  const save = (next: ChatQuickAction[]) => {
    try { let value: unknown; try { value = JSON.parse(read(scope) || "null"); } catch { value = null; } const preferences = { direct: actionsForKind(value, "direct"), group: actionsForKind(value, "group"), [kind]: actionsForKind(next, kind) }; localStorage.setItem(keyFor(scope), JSON.stringify(preferences)); window.dispatchEvent(new Event(event)); return true; } catch { return false; }
  };
  return { actions, save };
}
