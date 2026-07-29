import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "sermo:theme-preference";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function fallbackThemeByLocalTime(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= 19 || hour < 7 ? "dark" : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
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
  applyTheme(resolveTheme(readPreference()));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolvedTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
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

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference: setPreferenceState,
  }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
