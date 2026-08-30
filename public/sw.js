importScripts("/sw-release.js");

const CACHE_NAME = "sermo-shell-v8";
const MEDIA_CACHE_NAME = "sermo-media-v1";
const MEDIA_DB_NAME = "sermo-media-metadata";
const MEDIA_DB_STORE = "entries";
const MEDIA_MAX_BYTES = 256 * 1024 * 1024;
const MEDIA_MAX_ITEM_BYTES = 128 * 1024 * 1024;
const SHELL = ["/", "/manifest.json", "/icons/sermo-192.png?v=4", "/icons/sermo-512.png?v=4", "/fonts/material-symbols-outlined.woff2?v=1"];
const blockedMediaSlugs = new Set();

function mediaIdentity(value) {
  const url = new URL(value, self.location.origin);
  const revision = url.searchParams.get("variant") === "playback" ? "-playback" : "";
  const messageMatch = url.pathname.match(/\/(?:api\/)?messages\/blob\/([a-z0-9-]+)(\/thumbnail)?\/?$/i);
  if (messageMatch) {
    return {
      slug: messageMatch[1].toLowerCase(),
      variant: `${messageMatch[2] ? "thumbnail" : "original"}${revision}`,
    };
  }
  const squareMatch = url.pathname.match(/\/(?:api\/)?square\/media\/([a-z0-9-]+)(\/thumbnail)?\/?$/i);
  if (squareMatch) {
    return {
      slug: squareMatch[1].toLowerCase(),
      variant: `${squareMatch[2] ? "thumbnail" : "original"}${revision}`,
    };
  }
  const stickerMatch = url.pathname.match(/\/(?:api\/)?stickers\/assets\/(\d+)\/?$/i);
  if (!stickerMatch) return null;
  return {
    slug: `sticker-${stickerMatch[1]}`,
    variant: "display",
  };
}

function mediaCacheRequest(identity) {
  return new Request(`${self.location.origin}/__sermo_media_cache__/${identity.slug}/${identity.variant}`);
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_DB_STORE)) {
        db.createObjectStore(MEDIA_DB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withMediaStore(mode, operation) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEDIA_DB_STORE, mode);
    const request = operation(transaction.objectStore(MEDIA_DB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function mediaEntryKey(identity) {
  return `${identity.slug}:${identity.variant}`;
}

async function touchMediaEntry(identity, size) {
  await withMediaStore("readwrite", (store) => store.put({
    key: mediaEntryKey(identity),
    slug: identity.slug,
    variant: identity.variant,
    size,
    lastAccess: Date.now(),
  }));
}

async function listMediaEntries() {
  return withMediaStore("readonly", (store) => store.getAll());
}

async function deleteMediaEntry(identity) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  await Promise.all([
    cache.delete(mediaCacheRequest(identity)),
    withMediaStore("readwrite", (store) => store.delete(mediaEntryKey(identity))),
  ]);
}

async function deleteMediaSlug(slug) {
  const entries = await listMediaEntries();
  await Promise.all(entries.filter((entry) => entry.slug === slug).map((entry) => deleteMediaEntry(entry)));
}

async function enforceMediaLimit() {
  const entries = await listMediaEntries();
  let total = entries.reduce((sum, entry) => sum + Number(entry.size || 0), 0);
  if (total <= MEDIA_MAX_BYTES) return;
  const oldestFirst = [...entries].sort((left, right) => left.lastAccess - right.lastAccess);
  for (const entry of oldestFirst) {
    if (total <= MEDIA_MAX_BYTES) break;
    await deleteMediaEntry({ slug: entry.slug, variant: entry.variant });
    total -= Number(entry.size || 0);
  }
}

async function persistMediaResponse(request, identity, response) {
  if (blockedMediaSlugs.has(identity.slug)) return;
  if (!response.ok || response.type === "opaque" || response.status === 206) return;
  const contentLength = Number(response.headers.get("Content-Length") || 0);
  let size = contentLength;
  if (!size && response.type !== "opaque") {
    size = (await response.clone().blob()).size;
  }
  if (size > MEDIA_MAX_ITEM_BYTES) return;
  if (blockedMediaSlugs.has(identity.slug)) return;
  const cache = await caches.open(MEDIA_CACHE_NAME);
  await cache.put(mediaCacheRequest(identity), response);
  await touchMediaEntry(identity, size);
  await enforceMediaLimit();
}

async function rangedMediaResponse(cached, rangeHeader) {
  if (!rangeHeader || cached.type === "opaque") return cached;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return cached;
  const blob = await cached.blob();
  if (!blob.size) return cached;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= blob.size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${blob.size}` },
    });
  }
  const body = blob.slice(start, end + 1, blob.type);
  return new Response(body, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(body.size),
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Content-Type": blob.type || cached.headers.get("Content-Type") || "application/octet-stream",
    },
  });
}

async function fetchFullMedia(request, identity) {
  let response;
  try {
    response = await fetch(request.url, { credentials: "omit", mode: "cors" });
  } catch {
    response = await fetch(request.url, { credentials: "omit", mode: "no-cors" });
  }
  await persistMediaResponse(request, identity, response);
}

async function handleMediaRequest(request, identity) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const key = mediaCacheRequest(identity);
  const cached = await cache.match(key);
  if (cached) {
    return {
      response: rangedMediaResponse(cached, request.headers.get("Range")),
      maintenance:
      withMediaStore("readonly", (store) => store.get(mediaEntryKey(identity)))
        .then((entry) => touchMediaEntry(identity, entry?.size || 0))
        .catch(() => undefined),
    };
  }
  const response = await fetch(request);
  return {
    response,
    maintenance:
    (response.status === 206 || response.type === "opaque"
      ? fetchFullMedia(request, identity)
      : persistMediaResponse(request, identity, response.clone())
    ).catch(() => undefined),
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "PURGE_MEDIA" && Array.isArray(event.data.slugs)) {
    event.data.slugs.forEach((slug) => blockedMediaSlugs.add(slug));
    event.waitUntil(Promise.all(event.data.slugs.map(deleteMediaSlug)));
  }
  if (event.data?.type === "CACHE_MEDIA" && Array.isArray(event.data.urls)) {
    event.waitUntil(Promise.all(event.data.urls.map(async (url) => {
      const identity = mediaIdentity(url);
      if (!identity) return;
      if (identity.variant === "display") blockedMediaSlugs.delete(identity.slug);
      if (blockedMediaSlugs.has(identity.slug)) return;
      const cache = await caches.open(MEDIA_CACHE_NAME);
      if (await cache.match(mediaCacheRequest(identity))) {
        const entry = await withMediaStore("readonly", (store) => store.get(mediaEntryKey(identity)));
        await touchMediaEntry(identity, entry?.size || 0);
        return;
      }
      await fetchFullMedia(new Request(url), identity);
    })));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== MEDIA_CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const identity = mediaIdentity(url);
  if (identity) {
    const task = handleMediaRequest(event.request, identity);
    event.respondWith(task.then((result) => result.response));
    event.waitUntil(task.then((result) => result.maintenance));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }
  if (!["script", "style", "image", "font"].includes(event.request.destination)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "你收到了一条新消息" };
  }
  const spacePrefix = payload.space_slug ? `/${encodeURIComponent(payload.space_slug)}` : "";
  const url = payload.chat_id ? `${spacePrefix}/app/chats/${payload.chat_id}` : `${spacePrefix}/app/chats`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const hasVisibleClient = clients.some((client) => client.visibilityState === "visible");
      if (hasVisibleClient) return undefined;
      return self.registration.showNotification(payload.title || "Sermo 言浪", {
        body: payload.body || "你收到了一条新消息",
        icon: payload.icon || "/icons/sermo-192.png?v=4",
        badge: "/icons/sermo-192.png?v=4",
        tag: payload.chat_id ? `chat-${payload.chat_id}` : undefined,
        data: { url },
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app/chats", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const current = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (current) {
        await current.navigate(target);
        return current.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
