import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {useInterfacePreferences, type AppearancePreference} from './interfacePreferences';
import {authStorage} from './storage';
import {i18n} from './i18n';
import {showToast} from './toast';

export type ThemePreference = AppearancePreference;
export type ResolvedTheme = "light" | "dark";

const GUEST_THEME_STORAGE_KEY = "sermo:guest-theme-preference";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function fallbackThemeByLocalTime(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= 19 || hour < 7 ? "dark" : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(GUEST_THEME_STORAGE_KEY) ?? localStorage.getItem("sermo:theme-preference");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch { return "system"; }
}

function systemTheme(): ResolvedTheme {
  try {
    if (typeof window.matchMedia !== "function") return fallbackThemeByLocalTime();
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    if (typeof media.matches !== "boolean") return fallbackThemeByLocalTime();
    return media.matches ? "dark" : "light";
  } catch {
    return fallbackThemeByLocalTime();
  }
}

function canReadSystemTheme() {
  try {
    return typeof window.matchMedia === "function"
      && typeof window.matchMedia(DARK_MEDIA_QUERY).matches === "boolean";
  } catch {
    return false;
  }
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#111713" : "#f7f4ec",
  );
}

export function initializeTheme() {
  if (typeof document === "undefined") return;
  applyTheme(resolveTheme(authStorage.get() ? "system" : readPreference()));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const {scope, preferences, save} = useInterfacePreferences();
  const [guestPreference, setGuestPreference] = useState<ThemePreference>(readPreference);
  const preference = scope ? preferences.appearance ?? "system" : guestPreference;
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolvedTheme(next);
    applyTheme(next);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    if (!canReadSystemTheme()) {
      const timer = window.setInterval(() => {
        const next = fallbackThemeByLocalTime();
        setResolvedTheme(next);
        applyTheme(next);
      }, 60_000);
      return () => window.clearInterval(timer);
    }
    let media: MediaQueryList;
    try {
      media = window.matchMedia(DARK_MEDIA_QUERY);
    } catch {
      return;
    }
    const sync = () => {
      const next = systemTheme();
      setResolvedTheme(next);
      applyTheme(next);
    };
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, [preference]);

  const setPreference = useCallback(async (next: ThemePreference) => {
    if (scope) {
      try { await save({appearance: next}); }
      catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) showToast(i18n.t('common.saveFailed'), 'error');
      }
      return;
    }
    setGuestPreference(next);
    try { localStorage.setItem(GUEST_THEME_STORAGE_KEY, next); } catch { /* Anonymous visitors may block storage. */ }
  }, [scope, save]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference,
  }), [preference, resolvedTheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
