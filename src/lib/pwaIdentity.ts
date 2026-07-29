import { api } from "./api";
import { i18n } from "./i18n";
import { getDetectedSpaceSlug } from "./spaceEntry";

const fallbackIcon = "/icons/sermo-192.png?v=3";

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
