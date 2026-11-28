export const ROOM_VOICE_PHRASES = ['hello', 'wait', 'good_play', 'close', 'thanks', 'next_round', 'good_hand', 'your_call'] as const;
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
