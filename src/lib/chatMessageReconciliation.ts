import type { ChatMessage } from "../types.ts";
import { normalizeStableResourceUri } from "./stableResource.ts";

function isMediaMessageKind(kind: ChatMessage["kind"]) {
  return kind === "image" || kind === "video" || kind === "audio" || kind === "file";
}

export function sortMessages(items: ChatMessage[]) {
  return [...items].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;

    const leftId = typeof left.id === "number" ? left.id : Number.MAX_SAFE_INTEGER;
    const rightId = typeof right.id === "number" ? right.id : Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  });
}

function isOptimisticSelfMatch(source: ChatMessage, target: ChatMessage) {
  if (source.from !== "self" || target.from !== "self" || source.status === "sent" || target.status !== "sent") return false;
  if (source.kind !== target.kind) return false;
  if (source.kind === "text") {
    return source.text === target.text && Math.abs(source.createdAt - target.createdAt) <= 30;
  }
  if (source.kind === "sticker") {
    return Boolean(source.payload?.content_hash && source.payload.content_hash === target.payload?.content_hash);
  }
  return isMediaMessageKind(source.kind) && source.status === "pending" && Math.abs(source.createdAt - target.createdAt) <= 600;
}

export function preserveStableMediaUri(existing: ChatMessage | undefined, incoming: ChatMessage) {
  if (!existing) return incoming;
  const reconciled = {
    ...incoming,
    clientId: existing.clientId,
    localPreviewUri: existing.localPreviewUri,
    isPermanentVip: incoming.isPermanentVip ?? existing.isPermanentVip,
    chatBubbleStyle: incoming.chatBubbleStyle ?? existing.chatBubbleStyle,
    avatarFrameStyle: incoming.avatarFrameStyle ?? existing.avatarFrameStyle,
    submissionRound: incoming.submissionRound ?? existing.submissionRound,
    submissionVisible: incoming.submissionVisible ?? existing.submissionVisible,
  };
  if (!existing.payload?.uri || !incoming.payload?.uri) return reconciled;
  if (!isMediaMessageKind(existing.kind) || !isMediaMessageKind(incoming.kind)) return reconciled;
  if (existing.kind !== incoming.kind) return reconciled;

  const existingResource = normalizeStableResourceUri(existing.payload.uri);
  const incomingResource = normalizeStableResourceUri(incoming.payload.uri);
  if (!existingResource || existingResource !== incomingResource) return reconciled;
  if (existing.payload.uri === incoming.payload.uri) return reconciled;

  return {
    ...reconciled,
    payload: {
      ...incoming.payload,
      uri: existing.payload.uri,
    },
  };
}

function findMessage(messages: Map<ChatMessage["id"], ChatMessage>, matches: (message: ChatMessage) => boolean) {
  for (const message of messages.values()) {
    if (matches(message)) return message;
  }
  return undefined;
}

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const bucket = new Map<number | string, ChatMessage>();

  current.forEach((message) => bucket.set(message.id, message));
  incoming.forEach((message) => {
    const existingByClientId = findMessage(bucket, (existing) => existing.clientId === message.clientId);
    if (existingByClientId && existingByClientId.id !== message.id) {
      bucket.delete(existingByClientId.id);
    }

    let optimisticMatch: ChatMessage | undefined;
    if (message.status === "sent" && !existingByClientId) {
      optimisticMatch = findMessage(bucket, (existing) => isOptimisticSelfMatch(existing, message));
      if (optimisticMatch) {
        bucket.delete(optimisticMatch.id);
      }
    }

    if (message.status !== "sent") {
      const deliveredMatch = findMessage(bucket, (existing) => isOptimisticSelfMatch(message, existing));
      if (deliveredMatch) return;
    }

    const existingMessage = existingByClientId ?? optimisticMatch ?? bucket.get(message.id);
    bucket.set(message.id, preserveStableMediaUri(existingMessage, message));
  });

  return sortMessages([...bucket.values()]);
}

