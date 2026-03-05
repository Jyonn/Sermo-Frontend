import { useMemo } from "react"

type Translator = (en: string, zh: string) => string

export const getLocale = () => {
  if (typeof navigator === "undefined") {
    return "en"
  }
  const lang = navigator.language?.toLowerCase() || "en"
  return lang.startsWith("zh") ? "zh" : "en"
}

export const useLocale = () => {
  const locale = useMemo(() => getLocale(), [])
  const t: Translator = (en, zh) => (locale === "zh" ? zh : en)
  return { locale, t }
}
