import {useSyncExternalStore} from 'react';

export type MobileVoiceInputMode = 'hold' | 'tap';
const key = 'frienden:mobile-voice-input-mode';
const changed = 'frienden:mobile-voice-input-mode-changed';
let fallback: MobileVoiceInputMode = 'hold';
let sessionOnly = false;

export function readMobileVoiceInputMode(): MobileVoiceInputMode {
  if (typeof window === 'undefined') return 'hold';
  if (sessionOnly) return fallback;
  try { return window.localStorage.getItem(key) === 'tap' ? 'tap' : 'hold'; }
  catch { return fallback; }
}

export function setMobileVoiceInputMode(mode: MobileVoiceInputMode) {
  fallback = mode;
  try { window.localStorage.setItem(key, mode); sessionOnly = false; }
  catch { sessionOnly = true; }
  window.dispatchEvent(new Event(changed));
}

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) { sessionOnly = false; listener(); } };
  window.addEventListener(changed, listener);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage); };
}

export function useMobileVoiceInputMode() {
  return [useSyncExternalStore(subscribe, readMobileVoiceInputMode, () => 'hold' as const), setMobileVoiceInputMode] as const;
}
