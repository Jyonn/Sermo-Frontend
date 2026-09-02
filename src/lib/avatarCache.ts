import { normalizeStableResourceUri, resolveStableResourceUri } from "./stableResource";
import { rewritePublicAssetUrl } from "./siteConfig";

const CACHE_NAME = "sermo-avatar-v1";
const MAX_PERSISTED_AVATARS = 600;

interface CachedAvatar {
  objectUrl: string;
  decodedImage: HTMLImageElement;
}

const memoryCache = new Map<string, CachedAvatar>();
const pendingLoads = new Map<string, Promise<string>>();

export function avatarResourceKey(uri?: string | null, explicitKey?: string | null) {
  const version = explicitKey?.trim();
  if (version) return `v:${version}`;
  const normalized = normalizeStableResourceUri(rewritePublicAssetUrl(uri));
  return normalized ? `u:${normalized}` : "";
}

export function peekAvatarSource(uri?: string | null, explicitKey?: string | null) {
  const key = avatarResourceKey(uri, explicitKey);
  return key ? memoryCache.get(key)?.objectUrl : undefined;
}

function cacheRequest(key: string) {
  const encoded = Array.from(new TextEncoder().encode(key), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`${window.location.origin}/__avatar_cache__/${encoded}`);
}

async function decodeBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Avatar decode failed"));
    });
  }
  return { objectUrl, decodedImage: image };
}

async function trimCache(cache: Cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_PERSISTED_AVATARS;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)));
}

async function readPersistedAvatar(key: string) {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheRequest(key));
    if (!response) return null;
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

async function persistAvatar(key: string, blob: Blob) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheRequest(key), new Response(blob, { headers: { "Content-Type": blob.type || "image/*" } }));
    await trimCache(cache);
  } catch {
    // Safari private browsing and storage pressure can disable CacheStorage.
  }
}

async function fetchAvatar(uri: string) {
  const response = await fetch(uri, { cache: "force-cache", credentials: "omit", mode: "cors" });
  if (!response.ok) throw new Error(`Avatar request failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.size) throw new Error("Avatar response is empty");
  return blob;
}

export async function loadAvatarSource(uri?: string | null, explicitKey?: string | null) {
  const source = resolveStableResourceUri(rewritePublicAssetUrl(uri));
  const key = avatarResourceKey(uri, explicitKey);
  if (!source || !key) return source;

  const cached = memoryCache.get(key);
  if (cached) return cached.objectUrl;

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  const load = (async () => {
    const persisted = await readPersistedAvatar(key);
    const blob = persisted ?? await fetchAvatar(source);
    const decoded = await decodeBlob(blob);
    memoryCache.set(key, decoded);
    if (!persisted) void persistAvatar(key, blob);
    return decoded.objectUrl;
  })().finally(() => pendingLoads.delete(key));

  pendingLoads.set(key, load);
  return load;
}

export function preloadAvatar(uri?: string | null, explicitKey?: string | null) {
  if (!uri) return;
  void loadAvatarSource(uri, explicitKey).catch(() => undefined);
}
