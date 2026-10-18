export const SITE_ORIGINS = [
  { key: "friendenPrimary", origin: "https://frienden.jyonn.space", labelKey: "update.friendenPrimary" },
  { key: "friendenMirror", origin: "https://frienden.6-79.cn", labelKey: "update.friendenMirror" },
  { key: "primary", origin: "https://sermo.jyonn.space", labelKey: "update.legacyPrimary" },
  { key: "mirror", origin: "https://sermo.6-79.cn", labelKey: "update.legacyMirror" },
] as const;

export function migrationDestination(hostname: string) {
  if (hostname === "sermo.jyonn.space") return SITE_ORIGINS[0].origin;
  if (hostname === "sermo.6-79.cn") return SITE_ORIGINS[1].origin;
  return null;
}

export function updateSiteLabel(key: string) {
  return SITE_ORIGINS.find((site) => site.key === key)?.labelKey ?? "update.primarySite";
}
