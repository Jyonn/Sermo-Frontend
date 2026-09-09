export type SquareFeedMode = "all" | "friends" | "mine" | "user";

export interface SquareFeedItem {
  statement_id: number;
  created_at?: number;
}

export interface SquareFeedSnapshot<T> {
  version: 2;
  items: T[];
  hasMore: boolean;
}

export interface NormalizedSquareFeedSnapshot<T> {
  items: T[];
  hasMore: boolean;
  trusted: boolean;
}

export function squareFeedCacheKey(mode: SquareFeedMode, userId: number | null, date?: string | null, keyword?: string | null) {
  const base = mode !== "user"
    ? `square:${mode}`
    : userId ? `square:user:${userId}` : "square:all";
  const dateKey = date ? `${base}:date:${date}` : base;
  return keyword ? `${dateKey}:keyword:${encodeURIComponent(keyword)}` : dateKey;
}

export function normalizeSquareFeedSnapshot<T>(
  cached: T[] | SquareFeedSnapshot<T> | null | undefined,
): NormalizedSquareFeedSnapshot<T> | null {
  if (!cached) return null;
  if (Array.isArray(cached)) {
    return {
      items: cached,
      hasMore: cached.length >= 20,
      trusted: false,
    };
  }
  if (!Array.isArray(cached.items)) return null;
  return {
    items: cached.items,
    hasMore: Boolean(cached.hasMore),
    trusted: cached.version === 2,
  };
}

export function mergeSquareFeedRefresh<T extends SquareFeedItem>(cached: T[], latest: T[]) {
  if (!cached.length) return { items: latest, connected: true };
  if (!latest.length) return { items: latest, connected: false };

  const latestIds = new Set(latest.map((item) => item.statement_id));
  const connected = cached.some((item) => latestIds.has(item.statement_id));
  if (!connected) return { items: latest, connected: false };

  const merged = new Map(cached.map((item) => [item.statement_id, item]));
  latest.forEach((item) => merged.set(item.statement_id, item));
  return {
    items: [...merged.values()].sort((left, right) => {
      if (typeof left.created_at === "number" && typeof right.created_at === "number" && left.created_at !== right.created_at) {
        return right.created_at - left.created_at;
      }
      return right.statement_id - left.statement_id;
    }),
    connected: true,
  };
}
