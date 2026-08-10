function looksLikeIp(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

const SPACE_HOST_SUFFIX = "sermo.jyonn.space";
const ROOT_PATH_SEGMENTS = new Set([
  "",
  "entry",
  "space",
  "app",
  "friend-invite",
  "official-login",
  "account-switch",
  "pwa",
  "api",
  "assets",
  "icons",
  "labs",
]);

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function detectSpaceSlugFromHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname || normalizedHostname === "localhost" || looksLikeIp(normalizedHostname)) return null;

  if (normalizedHostname.endsWith(".localhost")) {
    const parts = normalizedHostname.split(".");
    return parts.length > 1 ? parts[0] : null;
  }

  if (normalizedHostname === SPACE_HOST_SUFFIX || normalizedHostname === `www.${SPACE_HOST_SUFFIX}`) return null;
  if (normalizedHostname.endsWith(`.${SPACE_HOST_SUFFIX}`)) {
    const prefix = normalizedHostname.slice(0, -(`.${SPACE_HOST_SUFFIX}`).length);
    if (!prefix) return null;
    return prefix.split(".")[0] || null;
  }

  return null;
}

export function detectSpaceSlugFromPathname(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (!firstSegment || ROOT_PATH_SEGMENTS.has(firstSegment) || firstSegment.includes(".")) return null;
  return normalizeSlug(decodeURIComponent(firstSegment));
}

export function getDetectedSpaceSlug() {
  if (typeof window === "undefined") return null;
  return detectSpaceSlugFromPathname(window.location.pathname)
    ?? detectSpaceSlugFromHostname(window.location.hostname);
}

export function getSpaceRouterBasename() {
  const slug = getDetectedSpaceSlug();
  return slug ? `/${encodeURIComponent(slug)}` : "/";
}

function buildRootUrl(pathname: string, search = "", hash = "") {
  if (typeof window === "undefined") return `${pathname}${search}${hash}`;
  const url = new URL(window.location.href);
  if (url.hostname.endsWith(".localhost")) url.hostname = "localhost";
  else if (url.hostname.endsWith(`.${SPACE_HOST_SUFFIX}`)) url.hostname = SPACE_HOST_SUFFIX;
  url.pathname = pathname;
  url.search = search;
  url.hash = hash;
  return url.toString();
}

export function buildJoinPath(slug: string) {
  return `/${encodeURIComponent(normalizeSlug(slug))}/`;
}

export function buildSpaceHrefForCurrentHost(slug: string, pathname = "/", search = "", hash = "") {
  const normalizedSlug = normalizeSlug(slug);
  const childPath = pathname === "/" ? "" : `/${pathname.replace(/^\/+/, "")}`;
  return buildRootUrl(`/${encodeURIComponent(normalizedSlug)}${childPath || "/"}`, search, hash);
}

export function buildJoinHrefForCurrentHost(slug: string) {
  return buildSpaceHrefForCurrentHost(slug, "/");
}

export function buildHomeHrefForCurrentHost() {
  return buildRootUrl("/");
}

export function buildAdminPath(slug?: string | null, mode: "create" | "login" = "login") {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (slug) params.set("slug", normalizeSlug(slug));
  return `/space?${params.toString()}`;
}

export function buildAdminEntryHref(mode: "create" | "login" = "login", slug?: string | null) {
  const [pathname, search = ""] = buildAdminPath(slug, mode).split("?");
  return buildRootUrl(pathname, search ? `?${search}` : "");
}

export function buildAdminHrefForCurrentHost(slug: string) {
  return buildAdminEntryHref("login", slug);
}
