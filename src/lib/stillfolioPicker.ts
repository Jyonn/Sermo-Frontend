const ORIGIN = "https://stillfolio.jyonn.space";
const SHARE_PATH = /^\/share\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export type StillfolioAlbum = { id: string; name: string; description: string; share_url: string | null };

export function stillfolioShareUrl(value: string) {
  try {
    const url = new URL(value);
    if (value === url.href && url.origin === ORIGIN && !url.username && !url.password && !url.hash && !url.search
        && SHARE_PATH.test(url.pathname)) return url.href;
  } catch { /* Invalid share address. */ }
}

export function openStillfolioPicker(onSelection: (url: string) => void, loginHint?: string) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), (value) => value.toString(16).padStart(2, "0")).join("");
  const url = new URL("/frienden/pick/", ORIGIN);
  url.searchParams.set("state", state);
  url.searchParams.set("origin", location.origin);
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  const popup = window.open(url.href, "_blank");
  if (!popup) return null;

  const stop = () => {
    window.removeEventListener("message", receive);
    window.clearInterval(timer);
  };
  function receive(event: MessageEvent) {
    if (event.origin !== ORIGIN || event.source !== popup) return;
    const value = event.data;
    if (value?.type !== "frienden.stillfolio.selection" || value.state !== state || typeof value.url !== "string") return;
    const selected = stillfolioShareUrl(value.url);
    if (!selected) return;
    stop();
    onSelection(selected);
  }
  window.addEventListener("message", receive);
  const expires = Date.now() + 10 * 60 * 1000;
  const timer = window.setInterval(() => { if (popup.closed || Date.now() > expires) stop(); }, 2000);
  return stop;
}
