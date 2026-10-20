import type { ChatMessage } from "../types";

// Measured independently on each half of the 1983 x 793 sprite.
export const BGM_KEY_CENTERS = {
  blue: [[39.5, 38], [58.2, 36.8], [76.6, 38.1], [44.3, 72.8], [62.6, 73.2], [79.6, 71.5]],
  pink: [[37.6, 38], [55.8, 37.4], [74.1, 38.2], [36.8, 71.8], [53.6, 73.1], [71.7, 73]],
} as const;

export function mergeBgmEntranceMessages(messages: ChatMessage[]): ChatMessage[] {
  const systems = new Map(messages.filter((message) => message.kind === "system" && message.payload?.event === "bgm_entrance").map((message) => [message.id, message]));
  const paired = new Map<ChatMessage["id"], ChatMessage>();
  for (const audio of messages) {
    const target = audio.payload?.bgm_entrance && audio.payload.uri && typeof audio.payload.system_message_id === "number"
      ? systems.get(audio.payload.system_message_id) : undefined;
    if (target && target.userId === audio.userId) paired.set(target.id, audio);
  }
  const hidden = new Set(Array.from(paired.values(), (audio) => audio.id));
  return messages.filter((message) => !hidden.has(message.id)).map((message) => {
    const audio = paired.get(message.id);
    return audio ? { ...message, payload: { ...message.payload!, bgm_entrance: true, uri: audio.payload!.uri, song_title: audio.payload!.song_title } } : message;
  });
}

export function newBgmEntrances(messages: ChatMessage[], seen: Set<string>, mountedAt: number, now: number, userId?: number) {
  return messages.filter((message) => message.payload?.bgm_entrance && message.payload.uri && message.userId !== userId
    && !seen.has(String(message.id)) && message.createdAt > mountedAt && now >= message.createdAt && now - message.createdAt < 15);
}
