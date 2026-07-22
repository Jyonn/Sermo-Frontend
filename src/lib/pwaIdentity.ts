import { api } from "./api";
import { getDetectedSpaceSlug } from "./spaceEntry";

const fallbackIcon = "/icons/sermo-192.png?v=3";
let manifestObjectUrl: string | null = null;

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
    const officialIcon = icon.toLowerCase().includes(".svg")
      ? { src: icon, sizes: "any", type: "image/svg+xml", purpose: "any" }
      : { src: icon, sizes: "400x400", purpose: "any" };
    const appName = `${space.name} - 言浪`;
    const manifest = {
      name: appName,
      short_name: appName,
      description: `${space.name}：一方空间，尽兴开聊。`,
      id: "/",
      start_url: "/app/chats",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      orientation: "any",
      background_color: "#f7f4ec",
      theme_color: "#f7f4ec",
      categories: ["social", "communication"],
      prefer_related_applications: false,
      launch_handler: { client_mode: "navigate-existing" },
      icons: [
        officialIcon,
        { src: "/icons/sermo-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icons/sermo-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      shortcuts: [
        { name: "聊天", short_name: "聊天", url: "/app/chats", icons: [{ src: icon }] },
        { name: "通讯", short_name: "通讯", url: "/app/notifications", icons: [{ src: icon }] },
        { name: "菜单", short_name: "菜单", url: "/app/menu", icons: [{ src: icon }] },
      ],
    };

    if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
    manifestObjectUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    updateIconLink('link[rel="manifest"]', { rel: "manifest", href: manifestObjectUrl });
    updateIconLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: icon });
    updateMetaContent("apple-mobile-web-app-title", appName);
  } catch {
    // Keep the static Sermo Yanlang identity when the space cannot be resolved.
  }
}
