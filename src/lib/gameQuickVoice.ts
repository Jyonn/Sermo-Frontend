export const ROOM_VOICE_COMMON = ['hello', 'wait', 'good_play', 'close', 'thanks', 'next_round'] as const;
export const ROOM_VOICE_PHRASES = [...ROOM_VOICE_COMMON, 'good_hand', 'your_call', 'your_turn', 'your_guess'] as const;
export type RoomVoicePhrase = typeof ROOM_VOICE_PHRASES[number];

export interface RoomVoiceMessage {
  id: number;
  user_id: number;
  phrase: RoomVoicePhrase;
  sent_at: number;
}

export interface RoomVoiceSnapshot {
  enabled: boolean;
  now: number;
  messages: RoomVoiceMessage[];
}
