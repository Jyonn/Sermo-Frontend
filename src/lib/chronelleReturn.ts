const PREFIX = 'chronelle:return-context:v1:';
const MAX_AGE = 10 * 60 * 1000;
const validState = (state: string) => /^[A-Za-z0-9_-]{32,256}$/.test(state);
type ReturnContext = { slug: string | null; userId: number; until: number };

export function isChronelleReturn(url: URL) {
  return /^\/(?:[^/]+\/)?app\/research$/.test(url.pathname)
    && url.searchParams.has('state')
    && (url.searchParams.has('code') || url.searchParams.has('error'));
}

export function rememberChronelleReturn(state: string, slug: string | null, userId: number, storage: Storage, now = Date.now()) {
  if (!validState(state) || (slug !== null && !/^[a-z0-9_-]+$/.test(slug)) || !Number.isSafeInteger(userId) || userId <= 0) throw Error('invalid_response');
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    try { if (JSON.parse(storage.getItem(key) || '{}').until > now) continue; } catch { /* Remove malformed or expired routing context. */ }
    storage.removeItem(key);
  }
  // Share only short-lived routing context, never tokens or authorization codes.
  storage.setItem(PREFIX + state, JSON.stringify({ slug, userId, until: now + MAX_AGE }));
}

export function readChronelleReturn(state: string, storage: Storage, now = Date.now()): ReturnContext | null {
  if (!validState(state)) return null;
  try {
    const value = JSON.parse(storage.getItem(PREFIX + state) || 'null');
    if (!value || !Number.isSafeInteger(value.userId) || value.userId <= 0 || !Number.isFinite(value.until) || value.until <= now || value.until > now + MAX_AGE || (value.slug !== null && (typeof value.slug !== 'string' || !/^[a-z0-9_-]+$/.test(value.slug)))) return null;
    return value;
  } catch { return null; }
}

export function chronelleReturnDestination(url: URL, storage: Storage, now = Date.now()) {
  if (url.pathname !== '/app/research' || !isChronelleReturn(url)) return null;
  const context = readChronelleReturn(url.searchParams.get('state') || '', storage, now);
  if (!context?.slug) return null;
  const target = new URL(url);
  target.pathname = `/${encodeURIComponent(context.slug)}/app/research`;
  return target;
}

export function clearChronelleReturn(state: string, storage: Storage) {
  if (validState(state)) storage.removeItem(PREFIX + state);
}
