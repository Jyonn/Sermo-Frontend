const ORIGIN = "https://stillfolio.jyonn.space";
const SHARE_PATH = /^\/share\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

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
    let selected: URL;
    try { selected = new URL(value.url); } catch { return; }
    if (selected.origin !== ORIGIN || selected.username || selected.password || selected.hash || selected.search || !SHARE_PATH.test(selected.pathname)) return;
    stop();
    onSelection(selected.href);
  }
  window.addEventListener("message", receive);
  const expires = Date.now() + 10 * 60 * 1000;
  const timer = window.setInterval(() => { if (popup.closed || Date.now() > expires) stop(); }, 2000);
  return stop;
}
