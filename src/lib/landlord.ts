export const LANDLORD_KEY = "landlord";
export const LANDLORD_ART = "/activity/landlord/table.webp";
export const LANDLORD_TITLE = "/activity/landlord/title.webp";

export interface LandlordMember {
  user_id: number;
  name: string;
  avatar_uri?: string;
}

export interface LandlordTableView {
  mode?: 'classic' | 'no_shuffle';
  code: string;
  status: "waiting" | "bidding" | "doubling" | "playing" | "finished" | "abandoned";
  version: number;
  host: number;
  round: number;
  your_seat: number;
  turn: number | null;
  landlord: number | null;
  winner: number | null;
  hand: number[];
  ready_count: number;
  seats: Array<{ position: number; member: LandlordMember; remaining: number; won: boolean; doubled: boolean | null; trustee: boolean; score: number; ready: boolean }>;
  bottom_cards: number[];
  bids: Array<number | null>;
  moves: Array<{ cards: number[]; automatic: boolean } | null>;
  last_player: number | null;
  deadline: number | null;
  server_now: number;
  can_start: boolean;
  base: number;
  multiplier: number;
  spring: boolean;
  bid_options: number[];
  can_pass: boolean;
  suggested_cards: number[];
}

export interface LandlordLobby {
  table: LandlordTableView | null;
  rooms: Array<{ code: string; host: LandlordMember; count: number }>;
}

interface LandlordResult {
  rank: number;
  wins: number;
  games: number;
  points: number;
  win_rate: number;
}

export type LandlordRankingMetric = "points" | "win_rate";

export interface LandlordRanking {
  year: number;
  years: number[];
  metric: LandlordRankingMetric;
  rows: Array<LandlordResult & { member: LandlordMember }>;
  mine: LandlordResult | null;
}

interface LandlordTableAction {
  code: string;
  version: number;
}

export type LandlordAction =
  | { action: "create" }
  | { action: "join"; code: string }
  | (LandlordTableAction & ({ action: "bid"; value: number } | { action: "double" | "trustee"; value: boolean }
    | { action: "mode"; value: 'classic' | 'no_shuffle' }
    | { action: "ready"; value: boolean; round: number; mode: LandlordTableView["mode"] } | { action: "start"; round: number }
    | { action: "play"; cards: number[] } | { action: "pass" | "leave" }));

export const LANDLORD_ROOM_CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
export const LANDLORD_ROOM_PARAM = "landlord_room";
