import { useState } from "react";

export function useResearchDraft(key: string, initial = "") {
  const storageKey = `research:draft:${key}`;
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(storageKey) ?? initial; }
    catch { return initial; }
  });
  function save(next: string) {
    setText(next);
    try {
      if (next) sessionStorage.setItem(storageKey, next);
      else sessionStorage.removeItem(storageKey);
    } catch { /* The active editor remains usable when storage is unavailable. */ }
  }
  return [text, save] as const;
}
