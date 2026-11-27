import type {LandlordMember} from './landlord';

export type GameRankingMetric = 'points' | 'win_rate';

interface GameResult {
  rank: number;
  wins: number;
  games: number;
  points: number;
  win_rate: number;
}

export interface GameRanking {
  year: number;
  years: number[];
  metric: GameRankingMetric;
  rows: Array<GameResult & {member: LandlordMember}>;
  mine: GameResult | null;
}
