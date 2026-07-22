const TAB_CACHE_PREFIX = "sermo:tab-cache:v1";

interface TabCacheRecord<T> {
  data: T;
  updatedAt: number;
}

export function buildTabCacheScope(spaceId?: number, userId?: number) {
  return spaceId && userId ? `${spaceId}:${userId}` : null;
}

export function readTabCache<T>(scope: string | null, tab: string) {
  if (!scope || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${TAB_CACHE_PREFIX}:${scope}:${tab}`);
    return raw ? (JSON.parse(raw) as TabCacheRecord<T>) : null;
  } catch {
    return null;
  }
}

export function writeTabCache<T>(scope: string | null, tab: string, data: T) {
  if (!scope || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TAB_CACHE_PREFIX}:${scope}:${tab}`, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch {
    // Cache writes are best-effort.
  }
}
