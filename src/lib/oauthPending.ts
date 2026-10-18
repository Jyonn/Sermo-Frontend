const KEY = "sermo:oauth-pending";

export function rememberOAuthRequest(search: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ search, at: Date.now() }));
  } catch {
    // Login can still be restarted from the requesting app.
  }
}

export function readOAuthRequest(): string | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as { search?: string; at?: number };
    if (typeof value.search !== "string" || !value.search.startsWith("?") || typeof value.at !== "number") return null;
    const lifetime = new URLSearchParams(value.search).has("request_id") ? 30 * 60_000 : 10 * 60_000;
    if (Date.now() < value.at || Date.now() - value.at > lifetime) return null;
    return `/oauth/authorize${value.search}`;
  } catch {
    return null;
  }
}

export function clearOAuthRequest() {
  try { sessionStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}
