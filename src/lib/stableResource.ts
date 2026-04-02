const stableResourceMap = new Map<string, string>();

export function normalizeStableResourceUri(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const [path] = trimmed.split("?");
    return path ?? trimmed;
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
