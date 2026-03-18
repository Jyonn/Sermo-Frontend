const SUPPORTED_LANGUAGES = new Set(["en", "zh-CN"] as const);

type SupportedLanguage = "en" | "zh-CN";

export function resolveJoinLanguage(input?: string | null): SupportedLanguage {
  const raw = (input ?? "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase().replace(/_/g, "-");
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh" || lower === "zh-cn" || lower.startsWith("zh-cn")) return "zh-CN";

  return SUPPORTED_LANGUAGES.has(raw as SupportedLanguage) ? (raw as SupportedLanguage) : "en";
}

export function getBrowserJoinLanguage() {
  if (typeof navigator === "undefined") return "en";
  return resolveJoinLanguage(navigator.language);
}
