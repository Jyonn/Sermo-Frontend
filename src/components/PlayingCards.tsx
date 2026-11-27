import type {CSSProperties, ReactNode} from 'react';
import {useI18n} from '../lib/language';
import './PlayingCards.css';

const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits = ['♠', '♥', '♣', '♦'];

export function playingCardRank(id: number) {
  const face = id % 54;
  return face < 52 ? Math.floor(face / 4) : face - 39;
}

export function PlayingCard({id, selected, disabled, onClick}: {id?: number; selected?: boolean; disabled?: boolean; onClick?: () => void}) {
  const {t} = useI18n();
  if (id === undefined) return <span className="playing-card is-backed" aria-hidden="true">♦</span>;
  const face = id % 54;
  const joker = face >= 52;
  const rank = joker ? (face === 53 ? '★' : '☆') : ranks[playingCardRank(id)];
  const suit = joker ? '✦' : suits[face % 4];
  const label = joker ? t(face === 53 ? 'landlord.bigJoker' : 'landlord.smallJoker') : `${rank} ${suit}`;
  const className = `playing-card${face === 53 || suit === '♥' || suit === '♦' ? ' is-red' : ''}`;
  const content = <><b aria-hidden="true">{rank}</b><span aria-hidden="true">{suit}</span></>;
  return onClick
    ? <button type="button" className={className} data-suit={suit} aria-label={label} aria-pressed={Boolean(selected)} disabled={disabled} onClick={onClick}>{content}</button>
    : <span className={className} data-suit={suit} role="img" aria-label={label}>{content}</span>;
}

export function PlayingCardStack({count, label, children, compact = false}: {count: number; label?: string; children: ReactNode; compact?: boolean}) {
  return <div className={`playing-card-stack${compact ? ' is-compact' : ''}`} role="group" aria-label={label}
    style={{'--card-overlaps': Math.max(1, count - 1)} as CSSProperties}>
    {children}
  </div>;
}
