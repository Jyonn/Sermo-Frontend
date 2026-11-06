import type { AvatarFrameStyle } from '../types';
import {rememberPublicBirthday} from './publicBirthday';

const KEY = 'sermo:user-avatar-frames:v1';
const MAX_ENTRIES = 1200;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const styles = new Set<AvatarFrameStyle>(['none','orbit','aurora','polaroid','papercut','mechanical','niko-run','fufu-wave','spider-web','explorer-conan']);
type Entry = { frame: AvatarFrameStyle; at: number };
let entries: Map<number, Entry> | undefined;
const listeners = new Set<() => void>();
let pending = false;

function read() {
  if (entries) return entries;
  entries = new Map();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(stored)) for (const item of stored.slice(-MAX_ENTRIES)) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [id, value] = item;
      if (Number.isSafeInteger(id) && id > 0 && value && styles.has(value.frame) && Number.isFinite(value.at) && value.at <= Date.now() && Date.now() - value.at < MAX_AGE) entries.set(id, value);
    }
  } catch { /* Storage may be unavailable or contain an older invalid value. */ }
  return entries;
}

export function cachedAvatarFrame(userId?: number): AvatarFrameStyle | undefined {
  if (!userId) return undefined;
  const entry = read().get(userId);
  return entry && Date.now() - entry.at < MAX_AGE ? entry.frame : undefined;
}

export const subscribeAvatarFrames = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// Observe complete server user records; omitted fields must not erase a known frame.
export function rememberAvatarFrames<T>(payload: T): T {
  const cache = read();
  let changed = false;
  let touched = false;
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const row = value as Record<string, unknown>;
    rememberPublicBirthday(row);
    const id = row.user_id;
    const frame = row.avatar_frame_style as AvatarFrameStyle;
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && styles.has(frame)) {
      changed ||= cache.get(id)?.frame !== frame;
      cache.delete(id);
      cache.set(id, { frame, at: Date.now() });
      touched = true;
    }
    Object.values(row).forEach(visit);
  };
  visit(payload);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  if (touched && !pending) {
    pending = true;
    queueMicrotask(() => {
      pending = false;
      try { localStorage.setItem(KEY, JSON.stringify([...cache])); } catch { /* Best effort. */ }
    });
  }
  if (changed) listeners.forEach(listener => listener());
  return payload;
}
