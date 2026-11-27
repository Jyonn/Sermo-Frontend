import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {api} from './api';
import {useAuth} from './auth';
import type {PersonalTheme} from './personalThemePolicy';
import type {SquareFeedLayout} from './squareFeedLayout';

export type AppearancePreference = 'system' | 'light' | 'dark';
export type MobileVoiceInputMode = 'hold' | 'tap';
export type SquareEntryChannel = 'friends' | 'explore';
export type SquareLayoutChannel = 'explore' | 'friends' | 'user';

export interface InterfacePreferences {
  appearance?: AppearancePreference;
  mobile_voice_input?: MobileVoiceInputMode;
  square_entry?: SquareEntryChannel;
  square_layout_mode?: 'unified' | 'per-channel';
  square_layout_explore?: SquareFeedLayout;
  square_layout_friends?: SquareFeedLayout;
  square_layout_user?: SquareFeedLayout;
  personal_theme?: {theme: PersonalTheme; period: string};
  christmas_background_override?: boolean;
  seen_theme_tokens?: string[];
}

export interface InterfacePreferencesSnapshot {
  values: InterfacePreferences;
  revision: number;
}

const empty: InterfacePreferences = {};
const context = createContext<{
  scope: string | null;
  loaded: boolean;
  loading: boolean;
  preferences: InterfacePreferences;
  save: (values: InterfacePreferences) => Promise<void>;
} | null>(null);

function legacyPreferences(scope: string) {
  const values: InterfacePreferences = {};
  const keys: string[] = [];
  const read = (key: string) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) keys.push(key);
    return raw;
  };
  try {
    const appearance = read('sermo:theme-preference');
    if (appearance === 'light' || appearance === 'dark') values.appearance = appearance;
    const voice = read('frienden:mobile-voice-input-mode');
    if (voice === 'hold' || voice === 'tap') values.mobile_voice_input = voice;
    const square = `frienden:square-layout:v2:${scope}:`;
    const entry = read(square + 'entry');
    if (entry === 'friends' || entry === 'explore') values.square_entry = entry;
    const layoutMode = read(square + 'mode');
    if (layoutMode === 'unified' || layoutMode === 'per-channel') values.square_layout_mode = layoutMode;
    const legacyExplore = read(`frienden:square-layout:v1:${scope}`);
    for (const channel of ['explore', 'friends', 'user'] as const) {
      const layout = read(square + channel) ?? (channel === 'explore' ? legacyExplore : null);
      if (layout === 'list' || layout === 'masonry') values[`square_layout_${channel}`] = layout;
    }
    const theme = JSON.parse(read(`frienden:personal-theme:${scope}`) || '{}');
    if (typeof theme?.christmasBackgroundOverride === 'boolean') {
      values.christmas_background_override = theme.christmasBackgroundOverride;
    }
    const validToken = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(token);
    if (['default', 'christmas-2026', 'birthday-botanical'].includes(theme?.theme) &&
        typeof theme?.period === 'string' && theme.period.length <= 365 && theme.period.split('|').every(validToken)) {
      values.personal_theme = {theme: theme.theme, period: theme.period};
    }
    if (Array.isArray(theme?.seen)) values.seen_theme_tokens = theme.seen.filter(validToken).slice(-20);
  } catch { /* Continue with any preferences read successfully. */ }
  return {values, keys};
}

export function InterfacePreferencesProvider({children}: {children: ReactNode}) {
  const {session} = useAuth();
  const scope = session ? `${session.user.space_id}:${session.user.user_id}` : null;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const saveQueue = useRef<{scope: string; job: Promise<void>}>();
  const [snapshot, setSnapshot] = useState<{scope: string; data: InterfacePreferencesSnapshot}>();
  const [failedScope, setFailedScope] = useState<string>();
  const current = snapshot?.scope === scope ? snapshot.data : undefined;
  const accept = useCallback((account: string, data: InterfacePreferencesSnapshot) => {
    setSnapshot(previous => activeScope.current !== account || (previous?.scope === account && data.revision <= previous.data.revision)
      ? previous : {scope: account, data});
  }, []);

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      const {keys, values} = legacyPreferences(scope);
      try {
        const data = Object.keys(values).length
          ? await api.saveInterfacePreferences(scope, {migrate: values}, controller.signal)
          : await api.getInterfacePreferences(scope, controller.signal);
        if (controller.signal.aborted) return;
        accept(scope, data);
        setFailedScope(undefined);
        try { keys.forEach(key => localStorage.removeItem(key)); } catch { /* Migration is idempotent. */ }
      } catch {
        if (!controller.signal.aborted) setFailedScope(scope);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [scope, accept]);

  const save = useCallback((values: InterfacePreferences) => {
    if (!scope) return Promise.reject(new DOMException('No signed-in account', 'AbortError'));
    const previous = saveQueue.current?.scope === scope ? saveQueue.current.job.catch(() => undefined) : Promise.resolve();
    const job = previous.then(async () => {
      const data = await api.saveInterfacePreferences(scope, {patch: values});
      accept(scope, data);
    });
    saveQueue.current = {scope, job};
    return job;
  }, [scope, accept]);

  return <context.Provider value={{
    scope, preferences: current?.values ?? empty, loaded: Boolean(current),
    loading: Boolean(scope && !current && failedScope !== scope), save,
  }}>{children}</context.Provider>;
}

export function useInterfacePreferences() {
  const value = useContext(context);
  if (!value) throw new Error('InterfacePreferencesProvider is required');
  return value;
}
