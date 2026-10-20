const origins = new Set(["https://sermo.jyonn.space", "https://frienden.jyonn.space", "https://sermo.6-79.cn", "https://frienden.6-79.cn"]);

// The same event clips ship to every origin, so mirror users need not fetch Pages.
export function localBgmUri(uri: string, currentOrigin: string) {
  try {
    const source = new URL(uri, currentOrigin);
    if (origins.has(source.origin) && /^\/activity\/bgm\/\d{2}\.mp3$/.test(source.pathname)) {
      return new URL(source.pathname, currentOrigin).href;
    }
  } catch { /* Keep API media URLs and other resources untouched. */ }
  return uri;
}
