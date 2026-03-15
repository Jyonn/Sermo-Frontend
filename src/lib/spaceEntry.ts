function looksLikeIp(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function detectSpaceSlugFromHostname(hostname: string) {
  if (!hostname || hostname === "localhost" || looksLikeIp(hostname)) return null;

  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    return parts.length > 1 ? parts[0] : null;
  }

  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  if (parts[0] === "www") return null;
  return parts[0];
}

export function getDetectedSpaceSlug() {
  if (typeof window === "undefined") return null;
  return detectSpaceSlugFromHostname(window.location.hostname);
}

export function buildJoinPath(slug: string) {
  return `/space/${encodeURIComponent(normalizeSlug(slug))}`;
}

export function buildAdminPath(slug?: string | null, mode: "create" | "login" = "login") {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (slug) params.set("slug", normalizeSlug(slug));
  return `/space?${params.toString()}`;
}

export function buildAdminHrefForCurrentHost(slug: string) {
  if (typeof window === "undefined") return buildAdminPath(slug, "login");

  const url = new URL(window.location.href);
  const hostname = url.hostname;

  if (hostname.endsWith(".localhost")) {
    url.hostname = "localhost";
  } else {
    const parts = hostname.split(".");
    if (parts.length > 2) {
      url.hostname = parts.slice(-2).join(".");
    }
  }

  url.pathname = "/space";
  url.search = new URLSearchParams({
    slug: normalizeSlug(slug),
    mode: "login",
  }).toString();
  url.hash = "";
  return url.toString();
}
