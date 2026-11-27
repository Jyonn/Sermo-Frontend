import type {LandlordMember} from './landlord';

export type FourPlayerGame = 'shuangkou' | 'mahjong';
export type FourPlayerMode = 'classic' | 'firefight' | 'standard';
export const TABLE_ROOM_PARAM = 'table_room';

export function isFourPlayerGame(value: unknown): value is FourPlayerGame {
  return value === 'shuangkou' || value === 'mahjong';
}

export function isTabletopGame(value: unknown): boolean {
  return value === 'landlord' || isFourPlayerGame(value);
}

interface Board {
  hand: number[];
  turn: number | null;
  winners: number[];
  outcome: string | null;
  forfeited_position?: number | null;
}

export interface ShuangkouBoard extends Board {
  last: number[];
  last_player: number | null;
  last_pattern: {kind: string; stars: number; ranks: number[]} | null;
  can_pass: boolean;
  passed: number[];
  suggested: number[];
  placements: number[];
  opening: number | null;
  contributions: number[];
}

export type MahjongChoiceKind = 'chi' | 'pong' | 'kong' | 'hu' | 'concealed_kong' | 'added_kong';
export interface MahjongChoice {
  kind: MahjongChoiceKind;
  face?: number;
  faces?: number[];
}
export interface MahjongBoard extends Board {
  drawn: number | null;
  dealer: number;
  wall_count: number;
  rivers: number[][];
  melds: Array<Array<{kind: MahjongChoiceKind; tiles: Array<number | null>}>>;
  own_choices: MahjongChoice[];
  pending: {source: number; tile: number; kind: 'discard' | 'added_kong'; decision: number; choices: MahjongChoice[] | null} | null;
}

export interface FourPlayerTable {
  code: string;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
  mode: FourPlayerMode;
  version: number;
  round: number;
  host: number;
  your_seat: number;
  seats: Array<{position: number; member: LandlordMember; remaining: number; ready: boolean; trustee: boolean; score: number | null}>;
  deadline: number | null;
  server_now: number;
  can_start: boolean;
  board: ShuangkouBoard | MahjongBoard | null;
}

export interface FourPlayerLobby {
  table: FourPlayerTable | null;
  rooms: Array<{code: string; mode: FourPlayerMode; host: LandlordMember; count: number}>;
}

export type GameMove =
  | {action: 'leave' | 'start' | 'pass'}
  | {action: 'ready' | 'trustee'; value: boolean}
  | {action: 'mode'; value: FourPlayerMode}
  | {action: 'play'; cards: number[]}
  | {action: 'discard'; tile: number}
  | {action: 'mahjong_action'; index: number}
  | {action: 'claim'; index: number; decision: number};

export type FourPlayerAction = {action: 'create'} | {action: 'join'; code: string}
  | (GameMove & {code: string; version: number; round: number; mode: FourPlayerMode});
