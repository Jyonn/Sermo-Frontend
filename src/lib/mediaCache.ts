const MEDIA_BLOB_PATTERN = /\/(?:api\/)?messages\/blob\/([a-z0-9-]+)(?:\/thumbnail)?\/?$/i;
const SQUARE_MEDIA_PATTERN = /\/(?:api\/)?square\/media\/([a-z0-9-]+)(?:\/thumbnail)?\/?$/i;
const STICKER_ASSET_PATTERN = /\/(?:api\/)?stickers\/assets\/(\d+)\/?$/i;

export function mediaBlobSlug(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const pathname = new URL(trimmed, window.location.origin).pathname;
    const mediaSlug = pathname.match(MEDIA_BLOB_PATTERN)?.[1]?.toLowerCase();
    if (mediaSlug) return mediaSlug;
    const squareMediaSlug = pathname.match(SQUARE_MEDIA_PATTERN)?.[1]?.toLowerCase();
    if (squareMediaSlug) return squareMediaSlug;
    const stickerId = pathname.match(STICKER_ASSET_PATTERN)?.[1];
    return stickerId ? `sticker-${stickerId}` : null;
  } catch {
    const pathname = trimmed.split("?")[0];
    const mediaSlug = pathname.match(MEDIA_BLOB_PATTERN)?.[1]?.toLowerCase();
    if (mediaSlug) return mediaSlug;
    const squareMediaSlug = pathname.match(SQUARE_MEDIA_PATTERN)?.[1]?.toLowerCase();
    if (squareMediaSlug) return squareMediaSlug;
    const stickerId = pathname.match(STICKER_ASSET_PATTERN)?.[1];
    return stickerId ? `sticker-${stickerId}` : null;
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

export function cacheMediaLocally(values: Array<string | null | undefined>) {
  const urls = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  if (!urls.length || !("serviceWorker" in navigator)) return;
  const message = { type: "CACHE_MEDIA", urls };
  navigator.serviceWorker.controller?.postMessage(message);
  void navigator.serviceWorker.ready.then((registration) => {
    if (registration.active !== navigator.serviceWorker.controller) {
      registration.active?.postMessage(message);
    }
  });
}
