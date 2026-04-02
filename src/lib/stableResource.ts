const stableResourceMap = new Map<string, string>();

function normalizedSearchKey(search: string) {
  if (!search) return "";
  const params = new URLSearchParams(search);
  params.delete("e");
  params.delete("token");
  const normalized = params.toString();
  return normalized ? `?${normalized}` : "";
}

export function normalizeStableResourceUri(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}${normalizedSearchKey(parsed.search)}`;
  } catch {
    const [path, rawSearch = ""] = trimmed.split("?");
    const search = normalizedSearchKey(rawSearch ? `?${rawSearch}` : "");
    return `${path ?? trimmed}${search}`;
  }
}

export function resolveStableResourceUri(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const key = normalizeStableResourceUri(trimmed);
  if (!key) return trimmed;

  const cached = stableResourceMap.get(key);
  if (cached) return cached;

  stableResourceMap.set(key, trimmed);
  return trimmed;
}

export function forgetStableResourceUri(value?: string | null) {
  const key = normalizeStableResourceUri(value);
  if (!key) return;
  stableResourceMap.delete(key);
}
