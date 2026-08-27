import type { SpaceDTO } from "../types";

const RECENT_SPACES_COOKIE = "sermo_recent_spaces";
const MAX_RECENT_SPACES = 8;
const COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export interface RecentSpaceEntry {
  slug: string;
  name: string;
  domain: string;
  lastVisitedAt: number;
}

function looksLikeIp(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function currentHostname() {
  if (typeof window === "undefined") return "";
  return window.location.hostname.trim().toLowerCase();
}

function resolveCookieDomain(hostname: string) {
  if (!hostname || hostname === "localhost" || looksLikeIp(hostname)) return null;
  if (hostname === "sermo.jyonn.space") return ".sermo.jyonn.space";
  return null;
}

function parseCookieValue(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as RecentSpaceEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.slug === "string" && typeof item.name === "string" && typeof item.domain === "string");
  } catch {
    return [];
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return row ? row.slice(prefix.length) : null;
}

function writeCookie(name: string, value: string, domain: string | null) {
  if (typeof document === "undefined") return;
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${COOKIE_MAX_AGE_SECONDS}`, "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  document.cookie = parts.join("; ");
}

function buildDomainForSlug(slug: string) {
  const hostname = currentHostname();
  if (!hostname) return `sermo.jyonn.space/${slug}`;
  if (hostname === "localhost") return `localhost/${slug}`;
  return `${hostname}/${slug}`;
}

export function listRecentSpaces() {
  return parseCookieValue(readCookie(RECENT_SPACES_COOKIE)).sort((left, right) => right.lastVisitedAt - left.lastVisitedAt);
}

export function rememberRecentSpace(space: Pick<SpaceDTO, "slug" | "name">) {
  const slug = (space.slug || "").trim().toLowerCase();
  const name = (space.name || "").trim();
  if (!slug || !name) return;

  const nextEntry: RecentSpaceEntry = {
    slug,
    name,
    domain: buildDomainForSlug(slug),
    lastVisitedAt: Date.now(),
  };

  const nextRows = [nextEntry, ...listRecentSpaces().filter((item) => item.slug !== slug)].slice(0, MAX_RECENT_SPACES);
  writeCookie(RECENT_SPACES_COOKIE, encodeURIComponent(JSON.stringify(nextRows)), resolveCookieDomain(currentHostname()));
}
