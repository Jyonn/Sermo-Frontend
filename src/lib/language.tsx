import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  getBrowserJoinLanguage,
  activateLanguage,
  i18n,
  localeForLanguage,
  resolveJoinLanguage,
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguage,
  type TranslationKey,
} from "./i18n";

export type LanguagePreference = "system" | SupportedLanguage;

interface LanguageContextValue {
  language: SupportedLanguage;
  preference: LanguagePreference;
  locale: string;
  saving: boolean;
  loadingLanguage: SupportedLanguage | null;
  setPreference: (preference: LanguagePreference) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const GUEST_LANGUAGE_STORAGE_KEY = "sermo:guest-language-preference";
let activeLanguage: SupportedLanguage = getBrowserJoinLanguage();

function readGuestLanguagePreference(): LanguagePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(GUEST_LANGUAGE_STORAGE_KEY);
  return stored === "system" || SUPPORTED_LANGUAGE_CODES.includes(stored as SupportedLanguage)
    ? stored as LanguagePreference
    : "system";
}

export function getActiveLanguage() {
  return activeLanguage;
}

export function getActiveLocale() {
  return localeForLanguage(activeLanguage);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { session, patchSessionUser } = useAuth();
  const systemLanguage = getBrowserJoinLanguage();
  const [preference, setPreferenceState] = useState<LanguagePreference>(readGuestLanguagePreference);
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolveJoinLanguage(session?.user.language ?? (readGuestLanguagePreference() === "system" ? systemLanguage : readGuestLanguagePreference()))
  );
  const [saving, setSaving] = useState(false);
  const [loadingLanguage, setLoadingLanguage] = useState<SupportedLanguage | null>(null);

  const applyLanguage = async (nextLanguage: SupportedLanguage) => {
    setLoadingLanguage(nextLanguage);
    try {
      await activateLanguage(nextLanguage);
      activeLanguage = nextLanguage;
      document.documentElement.lang = nextLanguage;
      setLanguage(nextLanguage);
    } finally {
      setLoadingLanguage(null);
    }
  };

  useEffect(() => {
    if (!session) {
      const guestPreference = readGuestLanguagePreference();
      setPreferenceState(guestPreference);
      void applyLanguage(resolveJoinLanguage(guestPreference === "system" ? systemLanguage : guestPreference));
      return;
    }

    let cancelled = false;
    void api.getUserMe().then((user) => {
      if (cancelled) return;
      const nextPreference = user.language_preference ?? "system";
      setPreferenceState(nextPreference);
      void applyLanguage(resolveJoinLanguage(user.language ?? systemLanguage));
      patchSessionUser({
        language: user.language,
        language_preference: nextPreference,
      });
    }).catch(() => {
      if (cancelled) return;
      void applyLanguage(resolveJoinLanguage(session.user.language ?? systemLanguage));
    });
    return () => {
      cancelled = true;
    };
  }, [patchSessionUser, session?.accessToken, session?.user.user_id, systemLanguage]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    preference,
    locale: localeForLanguage(language),
    saving,
    loadingLanguage,
    async setPreference(nextPreference) {
      if (saving || nextPreference === preference) return;
      const previousPreference = preference;
      const previousLanguage = language;
      const nextLanguage = nextPreference === "system" ? systemLanguage : nextPreference;
      setSaving(true);
      try {
        await applyLanguage(nextLanguage);
        setPreferenceState(nextPreference);
        if (!session) {
          window.localStorage.setItem(GUEST_LANGUAGE_STORAGE_KEY, nextPreference);
          return;
        }
        const user = await api.setLanguagePreference(nextPreference, systemLanguage);
        const effectiveLanguage = resolveJoinLanguage(user.language ?? nextLanguage);
        if (effectiveLanguage !== nextLanguage) await applyLanguage(effectiveLanguage);
        setPreferenceState(user.language_preference ?? nextPreference);
        patchSessionUser({
          language: effectiveLanguage,
          language_preference: user.language_preference ?? nextPreference,
        });
      } catch (error) {
        setPreferenceState(previousPreference);
        await applyLanguage(previousLanguage);
        throw error;
      } finally {
        setSaving(false);
      }
    },
  }), [language, loadingLanguage, patchSessionUser, preference, saving, session, systemLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  const { t } = useTranslation();
  if (!context) throw new Error("useI18n must be used within LanguageProvider");
  return { ...context, t };
}

export {
  getBrowserJoinLanguage,
  i18n,
  localeForLanguage,
  resolveJoinLanguage,
  type SupportedLanguage,
  type TranslationKey,
};
