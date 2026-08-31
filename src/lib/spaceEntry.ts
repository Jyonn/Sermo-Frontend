const ROOT_PATH_SEGMENTS = new Set([
  "",
  "entry",
  "space",
  "app",
  "friend-invite",
  "official-login",
  "account-switch",
  "pwa",
  "admin",
  "api",
  "assets",
  "icons",
  "labs",
  "design",
]);

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function detectSpaceSlugFromPathname(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (!firstSegment || ROOT_PATH_SEGMENTS.has(firstSegment) || firstSegment.includes(".")) return null;
  return normalizeSlug(decodeURIComponent(firstSegment));
}

export function getDetectedSpaceSlug() {
  if (typeof window === "undefined") return null;
  const pathSlug = detectSpaceSlugFromPathname(window.location.pathname);
  if (pathSlug) {
    if (document.documentElement.dataset.wechatMini === "true") window.sessionStorage.setItem("sermo:wechat-mini-space", pathSlug);
    return pathSlug;
  }
  const querySlug = normalizeSlug(new URLSearchParams(window.location.search).get("space") || "");
  if (querySlug) {
    window.sessionStorage.setItem("sermo:wechat-mini-space", querySlug);
    return querySlug;
  }
  return window.sessionStorage.getItem("sermo:wechat-mini-space") || null;
}

export function getSpaceRouterBasename() {
  if (typeof window === "undefined") return "/";
  const slug = detectSpaceSlugFromPathname(window.location.pathname);
  return slug ? `/${encodeURIComponent(slug)}` : "/";
}

function buildRootUrl(pathname: string, search = "", hash = "") {
  if (typeof window === "undefined") return `${pathname}${search}${hash}`;
  const url = new URL(window.location.href);
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
