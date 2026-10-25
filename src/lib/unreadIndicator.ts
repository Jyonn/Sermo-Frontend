export function unreadIndicator(count: number, fresh = false) {
  const value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return value > 0 ? { kind: "count" as const, label: value > 99 ? "99+" : String(value), count: value } : fresh ? { kind: "dot" as const, label: "", count: 0 } : null;
}
