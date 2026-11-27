export type CardGame = 'landlord' | 'classic' | 'firefight';

export function playingCardRank(id: number) {
  const face = id % 54;
  return face < 52 ? Math.floor(face / 4) : face - 39;
}

type Pattern = {kind: string; high: number; size: number; stars: number; special: number};

function shape(ranks: number[], game: CardGame): Pattern | undefined {
  if (!ranks.length) return;
  const counts = Array(15).fill(0) as number[];
  ranks.forEach(rank => counts[rank]++);
  const used = counts.map((count, rank) => count ? rank : -1).filter(rank => rank >= 0);
  const high = used[used.length - 1];
  const size = ranks.length;
  const pattern = (kind: string, top = high, stars = 0, special = 0) => ({kind, high: top, size, stars, special});
  if (game === 'landlord' && size === 2 && counts[13] === 1 && counts[14] === 1) return pattern('rocket', high, 10);
  if (used.length === 1) {
    if (size <= 3) return pattern(['single','pair','triple'][size - 1]);
    if (high < 13 && size <= (game === 'landlord' ? 4 : 8)) return pattern('bomb', high, size);
  }
  const run = high < 12 && high - used[0] + 1 === used.length;
  const copies = counts[high];
  if (run && used.every(rank => counts[rank] === copies)) {
    if (copies === 1 && used.length >= 5) return pattern('straight');
    if (copies === 2 && used.length >= 3) return pattern('pairs');
    if (copies === 3 && used.length >= (game === 'landlord' ? 2 : 3)) return pattern('plane');
    if (game === 'firefight' && copies >= 4 && copies <= 8 && used.length >= 3 && used.length <= 6) {
      return pattern('chain', high, copies + used.length);
    }
  }
  if (game !== 'landlord') return;
  const wings = (first: number, last: number, count: number, unit: number) => {
    const extra = used.filter(rank => rank < first || rank > last).map(rank => counts[rank]);
    return unit === 2 ? extra.length === count && extra.every(value => value === 2)
      : extra.every(value => value <= 2) && extra.reduce((sum, value) => sum + value, 0) === count;
  };
  for (const rank of used) {
    if (counts[rank] === 3 && size === 4 && wings(rank,rank,1,1)) return pattern('triple_single',rank);
    if (counts[rank] === 3 && size === 5 && wings(rank,rank,1,2)) return pattern('triple_pair',rank);
    if (counts[rank] === 4 && size === 6 && wings(rank,rank,2,1)) return pattern('four_singles',rank);
    if (counts[rank] === 4 && size === 8 && wings(rank,rank,2,2)) return pattern('four_pairs',rank);
  }
  for (const unit of [1,2]) {
    const length = size / (3 + unit);
    if (length < 2 || !Number.isInteger(length)) continue;
    for (let end = 11; end >= length - 1; end--) {
      const start = end - length + 1;
      if (counts.slice(start, end + 1).every(count => count === 3) && wings(start,end,length,unit)) {
        return pattern(unit === 1 ? 'plane_singles' : 'plane_pairs',end);
      }
    }
  }
}

function strength(left: Pattern, right: Pattern) {
  return left.stars - right.stars || left.special - right.special || right.size - left.size || left.high - right.high;
}

function classify(cards: number[], game: CardGame) {
  const ranks = cards.map(playingCardRank);
  if (game !== 'landlord' && ranks.every(rank => rank >= 13)) {
    if (ranks.length === 4) return {kind:'royal', high:14, size:4, stars:game === 'firefight' ? 7 : 9, special:1};
    if (ranks.length === 3 && game === 'firefight') return {kind:'three_jokers', high:14, size:3, stars:6, special:-1};
  }
  const wild = game === 'firefight' ? ranks.filter(rank => rank === 14).length : 0;
  if (!wild || ranks.length < 2) return shape(ranks,game);
  const fixed = ranks.filter(rank => rank !== 14);
  let best: Pattern | undefined;
  for (let first = 0; first <= 14; first++) {
    for (let second = first; second <= (wild === 1 ? first : 14); second++) {
      const next = shape(wild === 1 ? [...fixed,first] : [...fixed,first,second],game);
      if (next && (!best || strength(next,best) > 0)) best = next;
    }
  }
  return best;
}

export function isLegalPlay(cards: number[], last: number[], game: CardGame) {
  if (!cards.length || cards.length !== new Set(cards).size) return false;
  const candidate = classify(cards,game);
  const previous = classify(last,game);
  if (!candidate) return false;
  if (!previous) return true;
  if (candidate.stars || previous.stars) return strength(candidate,previous) > 0;
  return candidate.kind === previous.kind && candidate.size === previous.size && candidate.high > previous.high;
}
