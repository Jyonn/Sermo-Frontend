import {useEffect, useState, useSyncExternalStore} from 'react';

const birthdays = new Map<number, number>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => {listeners.delete(listener);}; };
export function rememberPublicBirthday(row: Record<string, unknown>) {
  if (typeof row.user_id !== 'number' || !('birthday_until' in row)) return;
  const until = typeof row.birthday_until === 'number' ? row.birthday_until : 0;
  if ((birthdays.get(row.user_id) ?? 0) === until) return;
  birthdays.set(row.user_id, until);
  queueMicrotask(() => listeners.forEach(listener => listener()));
}
export function usePublicBirthday(userId?: number) {
  const until = useSyncExternalStore(subscribe, () => birthdays.get(userId ?? 0) ?? 0, () => 0);
  const [, refresh] = useState(0);
  useEffect(() => {
    const delay = until * 1000 - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => refresh(value => value + 1), Math.min(delay + 50, 2147483647));
    return () => window.clearTimeout(timer);
  }, [until]);
  return until > Date.now() / 1000;
}
