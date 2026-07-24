const CACHE_NAME = "sermo-shell-v4";
const SHELL = ["/", "/manifest.json", "/icons/sermo-192.png?v=3", "/icons/sermo-512.png?v=3"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
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
  const url = payload.chat_id ? `/app/chats/${payload.chat_id}` : "/app/chats";
  event.waitUntil(self.registration.showNotification(payload.title || "Sermo 言浪", {
    body: payload.body || "你收到了一条新消息",
    icon: payload.icon || "/icons/sermo-192.png?v=3",
    badge: "/icons/sermo-192.png?v=3",
    tag: payload.chat_id ? `chat-${payload.chat_id}` : undefined,
    data: { url },
  }));
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
