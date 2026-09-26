import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/translation.json";

export const SUPPORTED_LANGUAGE_CODES = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export type TranslationKey = keyof typeof en;

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(SUPPORTED_LANGUAGE_CODES);
type TranslationResource = Record<string, string>;
const languageLoaders: Record<Exclude<SupportedLanguage, "en">, () => Promise<{ default: TranslationResource }>> = {
  es: () => import("../locales/es/translation.json"),
  ja: () => import("../locales/ja/translation.json"),
  ko: () => import("../locales/ko/translation.json"),
  "zh-CN": () => import("../locales/zh-CN/translation.json"),
  "zh-TW": () => import("../locales/zh-TW/translation.json"),
};
const languageLoads = new Map<SupportedLanguage, Promise<void>>();

export function isChineseLanguage(language: string) {
  return language === "zh-CN" || language === "zh-TW";
}

export function localeForLanguage(language: string) {
  return ({
    en: "en-US",
    es: "es-ES",
    ja: "ja-JP",
    ko: "ko-KR",
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
  } as Record<string, string>)[language] ?? "en-US";
}

export function resolveJoinLanguage(input?: string | null): SupportedLanguage {
  const raw = (input ?? "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase().replace(/_/g, "-");
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo" || lower === "zh-hant" || lower.startsWith("zh-hant-")) return "zh-TW";
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg" || lower === "zh-hans" || lower.startsWith("zh-hans-")) return "zh-CN";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "es" || lower.startsWith("es-")) return "es";
  return SUPPORTED_LANGUAGES.has(raw as SupportedLanguage) ? (raw as SupportedLanguage) : "en";
}

export function getBrowserJoinLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return "en";
  return resolveJoinLanguage(navigator.language);
}

export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
    load: "currentOnly",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export async function ensureLanguageLoaded(language: SupportedLanguage) {
  await i18nReady;
  if (i18n.hasResourceBundle(language, "translation")) return;
  const existing = languageLoads.get(language);
  if (existing) return existing;
  if (language === "en") return;
  const pending = languageLoaders[language]().then((module) => {
    i18n.addResourceBundle(language, "translation", module.default, true, true);
  }).catch((error) => {
    languageLoads.delete(language);
    throw error;
  });
  languageLoads.set(language, pending);
  return pending;
}

export async function activateLanguage(language: SupportedLanguage) {
  await ensureLanguageLoaded(language);
  await i18n.changeLanguage(language);
}

export function preloadLanguage(language: SupportedLanguage) {
  void ensureLanguageLoaded(language).catch(() => undefined);
}

export function preloadLanguageChoices() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  SUPPORTED_LANGUAGE_CODES.forEach(preloadLanguage);
}

export { i18n };
