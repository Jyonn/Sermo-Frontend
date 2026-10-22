import type { ExplicitUpdateCheckResult } from "./pwaUpdate";
import { SITE_ORIGINS } from "./siteOrigins.ts";

export function updateDestination(result: ExplicitUpdateCheckResult | null, currentOrigin: string): string | null {
  if (!result?.updateAvailable || !result.latestVersion) return null;
  const current = result.sources.find((source) => source.origin === currentOrigin);
  if (current?.status === "ok" && current.releaseId === result.latestVersion) return null;
  const destination = result.sources.find((source) => source.origin !== currentOrigin
    && source.status === "ok" && source.releaseId === result.latestVersion
    && SITE_ORIGINS.some((site) => site.origin === source.origin));
  // Navigate only to a known public origin, without forwarding login parameters.
  return destination ? `${destination.origin}/` : null;
}
