export interface DuelMatch {
  id: string; code: string; status: "waiting" | "choosing" | "secrets" | "playing" | "finished";
  tiers: number[]; own_tier: number | null; opponent_tier: number | null;
  funded: boolean; practice_reason: string; balance: number; returned: number;
  stake: number; round: number; deadline: number; host: boolean;
  opponent: { user_id: number; name: string; avatar_uri?: string; avatar_cache_key?: string } | null;
  own_secret: string | null; opponent_locked: boolean; opponent_secret: string | null;
  guesses: { round: number; mine: boolean; value: string | null; exact: number | null; misplaced: number | null }[];
  outcome: "win" | "loss" | "draw" | null; reason: string; points: number; reward_reason: string;
}
export interface DuelLobby {
  room?: DuelRoomSummary | null; current_code?: string | null;
  active: boolean; eligible: boolean; ends_at: number | null; server_time: number;
  daily: { matches: number; points: number; match_limit: number };
  tiers: number[]; max_rounds: number; round_seconds: number; match: DuelMatch | null;
  history: { id: string; code: string; opponent: string; outcome: string; reason: string; finished_at: number }[];
  leaders: { user_id: number; name: string; points: number }[];
}
export interface DuelInvitation { code: string; stake: number; name: string }
export interface DuelRoomSummary { code: string; status: string; name: string; guest_name: string | null; stake: number }
export function validDuelDigits(value: string) { return /^[0-9]{4}$/.test(value) && new Set(value).size === 4; }
export function duelSeconds(deadline: number, now: number) { return Math.max(0, Math.ceil(deadline - now)); }
export function duelLoginReturn(value: unknown) {
  return typeof value === "string" && /^(?:\/app\/square\/activities\/number-duel-2026\?room=|\/app\/number-duel\/)[A-Z2-9]{8}$/.test(value) ? value : "/app";
}
