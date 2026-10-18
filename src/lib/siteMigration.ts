import { migrationDestination } from "./siteOrigins.ts";

export const MIGRATION_NOTICE_KEY = "sermo:frienden-migration:last-shown";
export const MIGRATION_NOTICE_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_ORIGINS = ["https://frienden.jyonn.space", "https://frienden.6-79.cn"];

export function approvedMigrationDestination(hostname: string, policy: unknown) {
  const destination = migrationDestination(hostname);
  if (!destination || !policy || typeof policy !== "object") return null;
  const config = policy as { enabled?: unknown; readyOrigins?: unknown };
  if (config.enabled !== true || !Array.isArray(config.readyOrigins)) return null;
  const readyOrigins: unknown[] = config.readyOrigins;
  return REQUIRED_ORIGINS.every((origin) => readyOrigins.includes(origin)) ? destination : null;
}

export function claimMigrationNotice(storage: Pick<Storage, "getItem" | "setItem">, now = Date.now()) {
  try {
    const stored = storage.getItem(MIGRATION_NOTICE_KEY);
    const previous = stored === null ? null : Number(stored);
    if (previous !== null && Number.isFinite(previous) && now - previous < MIGRATION_NOTICE_INTERVAL) return false;
    storage.setItem(MIGRATION_NOTICE_KEY, String(now));
    return true;
  } catch {
    // Without persistent storage we cannot enforce the weekly limit.
    return false;
  }
}
