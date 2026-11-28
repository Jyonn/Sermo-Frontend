import type {LandlordTableView} from './landlord';
import type {DuelMatch} from './numberDuel';
import type {FourPlayerTable} from './tabletop';

export type GameRoomPhase = 'waiting' | 'playing' | 'turn' | 'start' | 'finished' | 'closed';
export type GameRoomStatus = {phase: GameRoomPhase; revision: string | number};

export const closedRoom: GameRoomStatus = {phase: 'closed', revision: 'closed'};

export function cardTableStatus(table: LandlordTableView | FourPlayerTable): GameRoomStatus {
  if (table.status === 'abandoned') return closedRoom;
  const self = table.seats.find(seat => seat.position === table.your_seat);
  let phase: GameRoomPhase;
  if (table.can_start) phase = 'start';
  else if (table.status === 'waiting' || table.status === 'finished') phase = table.status;
  else {
    let mustAct: boolean;
    if ('board' in table) {
      const board = table.board;
      const pending = board && 'pending' in board ? board.pending : null;
      mustAct = pending ? Boolean(pending.choices?.length) : board?.turn === table.your_seat;
    } else {
      mustAct = table.status === 'doubling'
        ? self != null && 'doubled' in self && self.doubled === null
        : table.turn === table.your_seat;
    }
    phase = mustAct && !self?.trustee ? 'turn' : 'playing';
  }
  return {phase, revision: table.version};
}

export function duelRoomStatus(match: DuelMatch): GameRoomStatus {
  const guesses = match.guesses.filter(guess => guess.round === match.round);
  const mustAct = match.status === 'choosing' ? match.own_tier === null
    : match.status === 'secrets' ? !match.own_secret
      : match.status === 'playing' && !guesses.some(guess => guess.mine);
  const phase = match.status === 'waiting' || match.status === 'finished'
    ? match.status : mustAct ? 'turn' : 'playing';
  return {
    phase,
    revision: JSON.stringify([match.status, match.round, match.opponent?.user_id, match.own_tier,
      match.opponent_tier, Boolean(match.own_secret), match.opponent_locked,
      guesses.map(guess => guess.mine).sort(), match.outcome, match.reason]),
  };
}
