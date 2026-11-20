import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { ActivityCampaignDTO } from '../types';
import { bgmDeadlineDelay, bgmRunAvailable } from './bgmPolicy';

export function useBgmRunActive(activity: ActivityCampaignDTO | null | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const delay = bgmDeadlineDelay(activity, current);
      if (delay !== null && bgmRunAvailable(activity, current)) timer = window.setTimeout(tick, delay);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => { if (timer !== undefined) window.clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, [activity?.active, activity?.starts_at, activity?.ends_at]);
  return bgmRunAvailable(activity, Math.max(now, Date.now()));
}

const Playback = createContext({ available: false, refresh: async () => {} });

export function BgmPlaybackProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const scope = session ? `${session.user.space_id}:${session.user.user_id}` : '';
  const [state, setState] = useState<{ scope: string; activity: ActivityCampaignDTO | null }>({ scope: '', activity: null });
  const pending = useRef<AbortController>();
  const refresh = useCallback(async () => {
    if (!scope || document.hidden) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const activity = await api.getMyBgm(controller.signal);
      if (!controller.signal.aborted) setState({ scope, activity: bgmRunAvailable(activity) ? activity : null });
    } catch {
      if (!controller.signal.aborted) setState({ scope, activity: null });
    }
  }, [scope]);
  useEffect(() => {
    setState({ scope, activity: null });
    void refresh();
    const foreground = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', foreground);
    return () => { pending.current?.abort(); document.removeEventListener('visibilitychange', foreground); };
  }, [scope, refresh]);
  const runActive = useBgmRunActive(state.scope === scope ? state.activity : null);
  const available = Boolean(scope && state.scope === scope && runActive);
  useEffect(() => {
    if (!available) return;
    // Discover administrative closure too; the local deadline handles expiry exactly.
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [available, refresh]);
  return <Playback.Provider value={{ available, refresh }}>{children}</Playback.Provider>;
}

export const useBgmPlayback = () => useContext(Playback);
