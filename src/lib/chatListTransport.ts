import type { ChatDTO } from "../types";

interface RecordTable {
  schemas: string[][];
  rows: Array<[number, unknown[]]>;
}
export interface CompactChatList {
  format: "compact-v1";
  users: RecordTable;
  chats: RecordTable;
}

function unpack(table: RecordTable): Record<string, unknown>[] {
  return table.rows.map(([schema, values]) => {
    const keys = table.schemas[schema];
    if (!keys || keys.length !== values.length) throw new Error("Invalid chat list schema");
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  });
}

export function decodeChatList(payload: ChatDTO[] | CompactChatList): ChatDTO[] {
  if (Array.isArray(payload)) return payload;
  if (payload.format !== "compact-v1") throw new Error("Unsupported chat list format");
  const users = unpack(payload.users);
  const user = (index: unknown): Record<string, unknown> | null => {
    if (index === null) return null;
    if (typeof index !== "number" || !Number.isInteger(index) || !users[index]) throw new Error("Invalid chat user reference");
    // Each consumer receives independent objects, like the legacy JSON response.
    return structuredClone(users[index]);
  };
  const message = (value: unknown): unknown => {
    if (value === null) return null;
    const row = { ...value as Record<string, unknown> };
    if ("user" in row) row.user = user(row.user);
    if ("mentions" in row) row.mentions = (row.mentions as unknown[]).map(user);
    if (row.reply_to && typeof row.reply_to === "object") row.reply_to = message(row.reply_to);
    return row;
  };
  return unpack(payload.chats).map((chat) => ({
    ...chat,
    owner: user(chat.owner),
    members: (chat.members as Array<[number, Record<string, unknown>]>).map(([index, context]) => ({ ...user(index), ...structuredClone(context) })),
    last_message: message(chat.last_message),
  })) as unknown as ChatDTO[];
}
