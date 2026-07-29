import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "../locales/en/translation.json";
import zhCN from "../locales/zh-CN/translation.json";
import { api } from "./api";
import { useAuth } from "./auth";

export type SupportedLanguage = "en" | "zh-CN";
export type LanguagePreference = "system" | SupportedLanguage;
export type TranslationKey = keyof typeof en;

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(["en", "zh-CN"]);

export function resolveJoinLanguage(input?: string | null): SupportedLanguage {
  const raw = (input ?? "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase().replace(/_/g, "-");
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh" || lower === "zh-cn" || lower.startsWith("zh-cn")) return "zh-CN";
  return SUPPORTED_LANGUAGES.has(raw as SupportedLanguage) ? (raw as SupportedLanguage) : "en";
}

export function getBrowserJoinLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return "en";
  return resolveJoinLanguage(navigator.language);
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
    },
    lng: getBrowserJoinLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN"],
    load: "currentOnly",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

interface LanguageContextValue {
  language: SupportedLanguage;
  preference: LanguagePreference;
  locale: string;
  saving: boolean;
  setPreference: (preference: LanguagePreference) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
let activeLanguage: SupportedLanguage = getBrowserJoinLanguage();

export function getActiveLanguage() {
  return activeLanguage;
}

export function getActiveLocale() {
  return activeLanguage === "zh-CN" ? "zh-CN" : "en-US";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { session, patchSessionUser } = useAuth();
  const systemLanguage = getBrowserJoinLanguage();
  const [preference, setPreferenceState] = useState<LanguagePreference>("system");
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolveJoinLanguage(session?.user.language ?? systemLanguage)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) {
      setPreferenceState("system");
      setLanguage(systemLanguage);
      return;
    }

    let cancelled = false;
    void api.getUserMe().then((user) => {
      if (cancelled) return;
      const nextPreference = user.language_preference ?? "system";
      setPreferenceState(nextPreference);
      setLanguage(resolveJoinLanguage(user.language ?? systemLanguage));
      patchSessionUser({
        language: user.language,
        language_preference: nextPreference,
      });
    }).catch(() => {
      if (cancelled) return;
      setLanguage(resolveJoinLanguage(session.user.language ?? systemLanguage));
    });
    return () => {
      cancelled = true;
    };
  }, [patchSessionUser, session?.accessToken, session?.user.user_id, systemLanguage]);

  useEffect(() => {
    activeLanguage = language;
    document.documentElement.lang = language;
    void i18n.changeLanguage(language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    preference,
    locale: language === "zh-CN" ? "zh-CN" : "en-US",
    saving,
    async setPreference(nextPreference) {
      if (!session || saving || nextPreference === preference) return;
      const previousPreference = preference;
      const previousLanguage = language;
      const nextLanguage = nextPreference === "system" ? systemLanguage : nextPreference;
      setPreferenceState(nextPreference);
      setLanguage(nextLanguage);
      setSaving(true);
      try {
        const user = await api.setLanguagePreference(nextPreference, systemLanguage);
        const effectiveLanguage = resolveJoinLanguage(user.language ?? nextLanguage);
        setPreferenceState(user.language_preference ?? nextPreference);
        setLanguage(effectiveLanguage);
        patchSessionUser({
          language: effectiveLanguage,
          language_preference: user.language_preference ?? nextPreference,
        });
      } catch (error) {
        setPreferenceState(previousPreference);
        setLanguage(previousLanguage);
        throw error;
      } finally {
        setSaving(false);
      }
    },
  }), [language, patchSessionUser, preference, saving, session, systemLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  const { t } = useTranslation();
  if (!context) throw new Error("useI18n must be used within LanguageProvider");
  return { ...context, t };
}

export { i18n };
