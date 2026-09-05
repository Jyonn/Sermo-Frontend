import type { Chat, ChatMessage } from "../types";

const DB_NAME = "sermo-chat-cache";
const DB_VERSION = 3;
const LIST_STORE = "chat-lists";
const THREAD_STORE = "chat-threads";
const MAX_PERSISTED_MESSAGES = 200;
const MAX_MEMORY_MESSAGES = 400;

interface ChatListRecord {
  key: string;
  chats: Chat[];
  updatedAt: number;
}

interface ChatThreadRecord {
  key: string;
  messages: ChatMessage[];
  hasOlderMessages: boolean;
  hasNewerMessages: false;
  scrollTop: number;
  updatedAt: number;
}

export interface ChatThreadSnapshot {
  messages: ChatMessage[];
  hasOlderMessages: boolean;
  hasNewerMessages: boolean;
  scrollTop: number;
  updatedAt: number;
}

const memoryLists = new Map<string, ChatListRecord>();
const memoryThreads = new Map<string, ChatThreadRecord>();

export const CHAT_LIST_UPDATED_EVENT = "sermo:chat-list-updated";

function normalizeMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
    const leftId = typeof left.id === "number" ? left.id : Number.MAX_SAFE_INTEGER;
    const rightId = typeof right.id === "number" ? right.id : Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  });
}

function withoutTransientMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.status !== "pending");
}

function withoutLocalPreviews(messages: ChatMessage[]) {
  return messages.map(({ localPreviewUri: _localPreviewUri, ...message }) => message);
}

function trimMessages(messages: ChatMessage[], limit: number) {
  const normalized = normalizeMessages(messages);
  if (normalized.length <= limit) return { messages: normalized, trimmed: false };
  return {
    messages: normalized.slice(normalized.length - limit),
    trimmed: true,
  };
}

function listKey(scope: string) {
  return `list:${scope}`;
}

function threadKey(scope: string, chatId: number) {
  return `thread:${scope}:${chatId}`;
}

function runRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(storeName: string, key: string) {
  return openDatabase().then(async (database) => {
    if (!database) return;
    try {
      const transaction = database.transaction(storeName, "readwrite");
      await runRequest(transaction.objectStore(storeName).delete(key));
    } catch {
      // Persistent cache is best-effort.
    }
  });
}

function emitChatListUpdated(scope: string, chats: Chat[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHAT_LIST_UPDATED_EVENT, {
      detail: {
        scope,
        chats,
      },
    })
  );
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LIST_STORE)) {
        database.createObjectStore(LIST_STORE, { keyPath: "key" });
      }
      if (event.oldVersion < 3 && database.objectStoreNames.contains(THREAD_STORE)) {
        database.deleteObjectStore(THREAD_STORE);
      }
      if (!database.objectStoreNames.contains(THREAD_STORE)) {
        database.createObjectStore(THREAD_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

async function readRecord<T>(storeName: string, key: string) {
  const database = await openDatabase();
  if (!database) return null;

  try {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    return (await runRequest(store.get(key))) as T | undefined;
  } catch {
    return null;
  }
}

async function writeRecord<T>(storeName: string, value: T) {
  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await runRequest(store.put(value));
  } catch {
    // Persistent cache is best-effort.
  }
}

export function buildChatCacheScope(spaceId: number, userId: number) {
  return `${spaceId}:${userId}`;
}

export const chatCache = {
  getChatList(scope: string) {
    return memoryLists.get(listKey(scope)) ?? null;
  },

  setChatList(scope: string, chats: Chat[]) {
    const record: ChatListRecord = {
      key: listKey(scope),
      chats: [...chats],
      updatedAt: Date.now(),
    };
    memoryLists.set(record.key, record);
    emitChatListUpdated(scope, record.chats);
  },

  async hydrateChatList(scope: string) {
    const record = await readRecord<ChatListRecord>(LIST_STORE, listKey(scope));
    if (!record) return null;
    memoryLists.set(record.key, record);
    return record;
  },

  async persistChatList(scope: string, chats: Chat[]) {
    const record: ChatListRecord = {
      key: listKey(scope),
      chats: [...chats],
      updatedAt: Date.now(),
    };
    memoryLists.set(record.key, record);
    emitChatListUpdated(scope, record.chats);
    await writeRecord(LIST_STORE, record);
  },

  getThread(scope: string, chatId: number) {
    return memoryThreads.get(threadKey(scope, chatId)) ?? null;
  },

  setThread(scope: string, chatId: number, snapshot: ChatThreadSnapshot) {
    if (snapshot.hasNewerMessages) return;
    const trimmed = trimMessages(snapshot.messages, MAX_MEMORY_MESSAGES);
    const record: ChatThreadRecord = {
      key: threadKey(scope, chatId),
      messages: trimmed.messages,
      hasOlderMessages: snapshot.hasOlderMessages || trimmed.trimmed,
      hasNewerMessages: false,
      scrollTop: snapshot.scrollTop,
      updatedAt: snapshot.updatedAt,
    };
    memoryThreads.set(record.key, record);
  },

  updateThreadScroll(scope: string, chatId: number, scrollTop: number) {
    const key = threadKey(scope, chatId);
    const current = memoryThreads.get(key);
    if (!current) return;
    memoryThreads.set(key, {
      ...current,
      scrollTop,
    });
  },

  async hydrateThread(scope: string, chatId: number) {
    const record = await readRecord<ChatThreadRecord>(THREAD_STORE, threadKey(scope, chatId));
    if (!record) return null;
    const messages = normalizeMessages(withoutTransientMessages(record.messages));
    const sanitized = { ...record, messages };
    memoryThreads.set(record.key, sanitized);
    if (messages.length !== record.messages.length) void writeRecord(THREAD_STORE, sanitized);
    return sanitized;
  },

  async persistThread(scope: string, chatId: number, snapshot: ChatThreadSnapshot) {
    if (snapshot.hasNewerMessages) return;
    const memoryTrimmed = trimMessages(snapshot.messages, MAX_MEMORY_MESSAGES);
    const memoryRecord: ChatThreadRecord = {
      key: threadKey(scope, chatId),
      messages: memoryTrimmed.messages,
      hasOlderMessages: snapshot.hasOlderMessages || memoryTrimmed.trimmed,
      hasNewerMessages: false,
      scrollTop: snapshot.scrollTop,
      updatedAt: snapshot.updatedAt,
    };
    memoryThreads.set(memoryRecord.key, memoryRecord);

    const persistedTrimmed = trimMessages(withoutLocalPreviews(withoutTransientMessages(snapshot.messages)), MAX_PERSISTED_MESSAGES);
    const persistedRecord: ChatThreadRecord = {
      ...memoryRecord,
      messages: persistedTrimmed.messages,
      hasOlderMessages: snapshot.hasOlderMessages || persistedTrimmed.trimmed,
    };
    await writeRecord(THREAD_STORE, persistedRecord);
  },

  async clearThread(scope: string, chatId: number) {
    const key = threadKey(scope, chatId);
    memoryThreads.delete(key);
    await deleteRecord(THREAD_STORE, key);
  },
};
