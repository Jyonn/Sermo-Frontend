import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/translation.json";
import es from "../locales/es/translation.json";
import ja from "../locales/ja/translation.json";
import ko from "../locales/ko/translation.json";
import zhCN from "../locales/zh-CN/translation.json";
import zhTW from "../locales/zh-TW/translation.json";

export const SUPPORTED_LANGUAGE_CODES = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export type TranslationKey = keyof typeof en;

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(SUPPORTED_LANGUAGE_CODES);

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

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ja: { translation: ja },
      ko: { translation: ko },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
    },
    lng: getBrowserJoinLanguage(),
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
    load: "currentOnly",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export { i18n };
