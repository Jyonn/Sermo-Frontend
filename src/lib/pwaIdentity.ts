import { api } from "./api";
import { i18n } from "./i18n";
import { getDetectedSpaceSlug } from "./spaceEntry";

const fallbackIcon = "/icons/sermo-192.png?v=3";
const LAST_SPACE_KEY = "sermo:pwa:last-space";

function updateIconLink(selector: string, attributes: Record<string, string>) {
  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    document.head.appendChild(link);
  }
  Object.entries(attributes).forEach(([key, value]) => link?.setAttribute(key, value));
}

function updateMetaContent(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export async function setupSpacePwaIdentity() {
  const slug = getDetectedSpaceSlug();
  if (!slug) return;
  window.localStorage.setItem(LAST_SPACE_KEY, slug);

  try {
    const space = await api.getSpaceBySlug(slug);
    const icon = space.official_user?.avatar_uri || fallbackIcon;
    const appName = `${space.name} - ${i18n.t("brand.yanlang")}`;
    updateIconLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: icon });
    updateMetaContent("apple-mobile-web-app-title", appName);
  } catch {
    // Keep the static Sermo Yanlang identity when the space cannot be resolved.
  }
}

export function restoreLastInstalledSpace() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (!standalone) return false;
  const slug = window.localStorage.getItem(LAST_SPACE_KEY);
  if (!slug) return false;
  const shortcut = new URLSearchParams(window.location.search).get("shortcut");
  const destination = shortcut === "notifications"
    ? "notifications"
    : shortcut === "menu"
      ? "menu"
      : "chats";
  window.location.replace(`/${encodeURIComponent(slug)}/app/${destination}?source=pwa`);
  return true;
}
