const TAB_CACHE_PREFIX = "sermo:tab-cache:v1";

export function updateTabCaches(scope: string, update: (tab: string, data: unknown) => unknown) {
  if (typeof window === 'undefined') return;
  const prefix=`${TAB_CACHE_PREFIX}:${scope}:`;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith(prefix)) continue;
      const tab=key.slice(prefix.length);
      const record=readTabCache<unknown>(scope,tab);
      if (!record) continue;
      const next=update(tab,record.data);
      if (next!==record.data) writeTabCache(scope,tab,next);
    }
  } catch { /* Storage is best-effort. */ }
}

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
