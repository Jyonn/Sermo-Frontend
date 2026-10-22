import type { ChatMessage } from "../types";

// Both generated housings share the same geometry; buttons are real UI controls.
export const BGM_KEY_CENTERS = {
  blue: [[44, 36], [63, 36], [82, 36], [44, 68], [63, 68], [82, 68]],
  pink: [[44, 36], [63, 36], [82, 36], [44, 68], [63, 68], [82, 68]],
} as const;

export function bgmKeyState(track: { key: string; owned: boolean; uri: string | null } | undefined, playingKey?: string | null) {
  return !track?.owned || !track.uri ? "inactive" : track.key === playingKey ? "playing" : "ready";
}

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

export function bgmSilentMinutes(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

export function newBgmEntrances(messages: ChatMessage[], seen: Set<string>, mountedAt: number, now: number, userId?: number, receiveAudio = true) {
  if (!receiveAudio) return [];
  return messages.filter((message) => message.payload?.bgm_entrance && message.payload.uri && message.userId !== userId
    && !seen.has(String(message.id)) && message.createdAt > mountedAt && now >= message.createdAt && now - message.createdAt < 15);
}
