const MEDIA_BLOB_PATTERN = /\/(?:api\/)?messages\/blob\/([a-z0-9-]+)(?:\/thumbnail)?\/?$/i;

export function mediaBlobSlug(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, window.location.origin).pathname.match(MEDIA_BLOB_PATTERN)?.[1]?.toLowerCase() ?? null;
  } catch {
    return trimmed.split("?")[0].match(MEDIA_BLOB_PATTERN)?.[1]?.toLowerCase() ?? null;
  }
}

export function purgeCachedMedia(values: Array<string | null | undefined>) {
  const slugs = [...new Set(values.map(mediaBlobSlug).filter((slug): slug is string => Boolean(slug)))];
  if (!slugs.length || !("serviceWorker" in navigator)) return;
  const message = { type: "PURGE_MEDIA", slugs };
  navigator.serviceWorker.controller?.postMessage(message);
  void navigator.serviceWorker.ready.then((registration) => {
    if (registration.active !== navigator.serviceWorker.controller) {
      registration.active?.postMessage(message);
    }
  });
}
