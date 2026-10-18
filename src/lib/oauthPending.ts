const KEY = "sermo:oauth-pending";
const ADMIN_KEY = "sermo:oauth-admin-pending";

export function rememberAdminOAuthRequest(search: string) {
  rememberOAuthRequest(search);
  try { sessionStorage.setItem(ADMIN_KEY, `/oauth/authorize${search}`); } catch { /* Optional recovery. */ }
}

export function readAdminOAuthRequest(): string | null {
  try { const pending = readOAuthRequest(); return pending && sessionStorage.getItem(ADMIN_KEY) === pending ? pending : null; } catch { return null; }
}

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
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(ADMIN_KEY); } catch { /* Storage may be unavailable. */ }
}
