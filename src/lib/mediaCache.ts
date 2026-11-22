const MEDIA_BLOB_PATTERN = /\/(?:api\/)?messages\/blob\/([a-z0-9-]+)(?:\/(?:thumbnail|display))?\/?$/i;
const SQUARE_MEDIA_PATTERN = /\/(?:api\/)?square\/media\/([a-z0-9-]+)(?:\/(?:thumbnail|display))?\/?$/i;
const STICKER_ASSET_PATTERN = /\/(?:api\/)?stickers\/assets\/(\d+)\/?$/i;
const thumbnails = new Map<string, HTMLCanvasElement>();
const THUMBNAIL_CACHE_LIMIT = 96;
const THUMBNAIL_PIXEL_LIMIT = 160;

export function readMediaThumbnail(uri: string) {
  const cached = thumbnails.get(uri);
  if (cached) {
    thumbnails.delete(uri);
    thumbnails.set(uri, cached);
  }
  return cached;
}

export function rememberMediaThumbnail(uri: string, image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight || readMediaThumbnail(uri)) return;
  try {
    const scale = Math.min(1, THUMBNAIL_PIXEL_LIMIT / Math.max(image.naturalWidth, image.naturalHeight));
    const thumbnail = document.createElement("canvas");
    thumbnail.width = Math.max(1, Math.round(image.naturalWidth * scale));
    thumbnail.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = thumbnail.getContext("2d");
    if (context) {
      context.drawImage(image, 0, 0, thumbnail.width, thumbnail.height);
      thumbnails.set(uri, thumbnail);
      if (thumbnails.size > THUMBNAIL_CACHE_LIMIT) {
        const oldest = thumbnails.keys().next().value;
        if (oldest) thumbnails.delete(oldest);
      }
    }
  } catch {
    // The image remains usable if the browser cannot allocate a thumbnail.
  }
  if (mediaBlobSlug(uri) && /\/thumbnail\/?(?:[?#]|$)/.test(uri)) cacheMediaLocally([uri]);
}

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
  for (const uri of thumbnails.keys()) {
    if (values.includes(uri) || slugs.includes(mediaBlobSlug(uri) ?? "")) thumbnails.delete(uri);
  }
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
