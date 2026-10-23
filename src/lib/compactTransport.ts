export interface CompactPayload {
  format: "compact-v1";
  kind: "messages" | "growth";
  schemas: string[][];
  records: unknown[][];
  root: unknown;
}

export function decodeCompact<T>(payload: T | CompactPayload, kind: CompactPayload["kind"]): T {
  if (!payload || typeof payload !== "object" || !("format" in payload)) return payload as T;
  const packed = payload as CompactPayload;
  if (packed.format !== "compact-v1" || packed.kind !== kind || !Array.isArray(packed.records) || !Array.isArray(packed.schemas)) throw new Error("Unsupported compact payload");
  const active = new Set<number>();
  const decode = (node: unknown): unknown => {
    if (!Array.isArray(node)) return node;
    if (node[0] === -1) return node.slice(1).map(decode);
    const index = node[1];
    if (node[0] !== -2 || node.length !== 2 || !Number.isInteger(index) || index < 0 || !packed.records[index] || active.has(index)) throw new Error("Invalid compact reference");
    const row = packed.records[index];
    const keys = packed.schemas[row[0] as number];
    if (!keys || keys.length !== row.length - 1 || !keys.every((key) => typeof key === "string")) throw new Error("Invalid compact schema");
    active.add(index);
    const result = Object.fromEntries(keys.map((key, offset) => [key, decode(row[offset + 1])]));
    active.delete(index);
    return result;
  };
  return decode(packed.root) as T;
}
