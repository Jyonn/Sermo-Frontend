import { getDetectedSpaceSlug } from "./spaceEntry";

const LAST_SPACE_KEY = "sermo:pwa:last-space";

export async function setupSpacePwaIdentity() {
  const slug = getDetectedSpaceSlug();
  if (!slug) return;
  window.localStorage.setItem(LAST_SPACE_KEY, slug);

}

export function restoreLastInstalledSpace() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (!standalone) return false;
  const shortcut = new URLSearchParams(window.location.search).get("shortcut");
  const params = new URLSearchParams({ source: "pwa" });
  if (shortcut) params.set("shortcut", shortcut);
  window.location.replace(`/pwa?${params.toString()}`);
  return true;
}
