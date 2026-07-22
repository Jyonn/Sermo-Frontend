import { api } from "./api";
import { getDetectedSpaceSlug } from "./spaceEntry";

const fallbackIcon = "/icons/sermo-192.png";
let manifestObjectUrl: string | null = null;

function updateIconLink(selector: string, attributes: Record<string, string>) {
  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    document.head.appendChild(link);
  }
  Object.entries(attributes).forEach(([key, value]) => link?.setAttribute(key, value));
}

export async function setupSpacePwaIdentity() {
  const slug = getDetectedSpaceSlug();
  if (!slug) return;

  try {
    const space = await api.getSpaceBySlug(slug);
    const icon = space.official_user?.avatar_uri || fallbackIcon;
    const manifest = {
      name: `${space.name} · Sermo`,
      short_name: space.name,
      description: `来自 ${space.name} 的聊天空间`,
      id: "/",
      start_url: "/app/chats",
      scope: "/",
      display: "standalone",
      background_color: "#f7f4ec",
      theme_color: "#f7f4ec",
      icons: [
        { src: icon, sizes: "192x192", purpose: "any" },
        { src: icon, sizes: "512x512", purpose: "any" },
      ],
    };

    if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
    manifestObjectUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    updateIconLink('link[rel="manifest"]', { rel: "manifest", href: manifestObjectUrl });
    updateIconLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: icon });
  } catch {
    // Keep the static Sermo identity when the space cannot be resolved.
  }
}
