const configuredPublicOrigin = String(import.meta.env.VITE_PUBLIC_ORIGIN || "").trim().replace(/\/$/, "");
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

export const PUBLIC_ORIGIN = configuredPublicOrigin
  || (typeof window !== "undefined" ? window.location.origin : "https://sermo.jyonn.space");

export const PUBLIC_HOST = (() => {
  try {
    return new URL(PUBLIC_ORIGIN).host;
  } catch {
    return "sermo.jyonn.space";
  }
})();

export const API_BASE_URL = configuredApiBaseUrl || (import.meta.env.DEV ? "/api" : "https://api.sermo.jyonn.space");

export function buildPublicUrl(pathname: string) {
  return `${PUBLIC_ORIGIN}/${pathname.replace(/^\/+/, "")}`;
}

export function rewritePublicAssetUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return source;
  try {
    const parsed = new URL(source);
    if (parsed.hostname === "sermo.jyonn.space" && parsed.pathname.startsWith("/assets/avatars/v2/")) {
      return `${PUBLIC_ORIGIN}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Relative resource URLs already resolve against the active deployment.
  }
  return source;
}
