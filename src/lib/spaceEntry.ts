function looksLikeIp(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

const SPACE_HOST_SUFFIX = "sermo.jyonn.space";

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

  const parts = normalizedHostname.split(".");
  if (parts.length < 4) return null;
  if (parts[0] === "www") return null;
  return parts[0];
}

export function getDetectedSpaceSlug() {
  if (typeof window === "undefined") return null;
  return detectSpaceSlugFromHostname(window.location.hostname);
}

function resolveSpaceBaseHost(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname || normalizedHostname === "localhost" || looksLikeIp(normalizedHostname)) return normalizedHostname;

  if (normalizedHostname.endsWith(".localhost")) return "localhost";
  if (normalizedHostname === SPACE_HOST_SUFFIX || normalizedHostname === `www.${SPACE_HOST_SUFFIX}`) return SPACE_HOST_SUFFIX;

  const detectedSlug = detectSpaceSlugFromHostname(normalizedHostname);
  if (detectedSlug && normalizedHostname.endsWith(`.${SPACE_HOST_SUFFIX}`)) return SPACE_HOST_SUFFIX;
  if (detectedSlug) return normalizedHostname.slice(detectedSlug.length + 1);
  if (normalizedHostname.startsWith("www.")) return normalizedHostname.slice(4);
  return normalizedHostname;
}

function buildUrlForRootHost(pathname: string, search = "") {
  if (typeof window === "undefined") return `${pathname}${search}`;

  const url = new URL(window.location.href);
  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    url.hostname = "localhost";
  } else if (!looksLikeIp(hostname)) {
    url.hostname = resolveSpaceBaseHost(hostname);
  }

  url.pathname = pathname;
  url.search = search;
  url.hash = "";
  return url.toString();
}

export function buildJoinPath(slug: string) {
  return `/space/${encodeURIComponent(normalizeSlug(slug))}`;
}

export function buildJoinHrefForCurrentHost(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  if (typeof window === "undefined") return buildJoinPath(normalizedSlug);

  const url = new URL(window.location.href);
  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    url.hostname = `${normalizedSlug}.localhost`;
  } else if (looksLikeIp(hostname)) {
    url.pathname = buildJoinPath(normalizedSlug);
    url.search = "";
    url.hash = "";
    return url.toString();
  } else {
    const baseHost = resolveSpaceBaseHost(hostname);
    url.hostname = `${normalizedSlug}.${baseHost}`;
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildHomeHrefForCurrentHost() {
  return buildUrlForRootHost("/");
}

export function buildAdminPath(slug?: string | null, mode: "create" | "login" = "login") {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (slug) params.set("slug", normalizeSlug(slug));
  return `/space?${params.toString()}`;
}

export function buildAdminEntryHref(mode: "create" | "login" = "login", slug?: string | null) {
  return buildUrlForRootHost("/space", `?${new URLSearchParams(
    slug
      ? {
          mode,
          slug: normalizeSlug(slug),
        }
      : {
          mode,
        }
  ).toString()}`);
}

export function buildAdminHrefForCurrentHost(slug: string) {
  return buildAdminEntryHref("login", slug);
}
