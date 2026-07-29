import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/translation.json";
import zhCN from "../locales/zh-CN/translation.json";

export type SupportedLanguage = "en" | "zh-CN";
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

export { i18n };
