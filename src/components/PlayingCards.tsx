import {useRef, useState, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import {isLegalPlay, playingCardRank, type CardGame} from '../lib/cardPatterns';
import {useI18n} from '../lib/language';
import './PlayingCards.css';

const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits = ['♠', '♥', '♣', '♦'];

export {playingCardRank};

export function PlayingCard({id, selected, preview, disabled, resolvedRank, onClick}: {
  id?: number; selected?: boolean; preview?: boolean; disabled?: boolean; resolvedRank?: number; onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const {t} = useI18n();
  if (id === undefined) return <span className="playing-card is-backed" aria-hidden="true">♦</span>;
  const face = id % 54;
  const joker = face >= 52;
  const rank = joker ? (face === 53 ? '★★' : '★') : ranks[playingCardRank(id)];
  const suit = joker ? '✦' : suits[face % 4];
  const label = joker ? t(face === 53 ? 'landlord.bigJoker' : 'landlord.smallJoker') : `${rank} ${suit}`;
  const className = `playing-card${face === 53 || suit === '♥' || suit === '♦' ? ' is-red' : ''}${joker ? ' is-joker' : ''}`;
  const wildcard = resolvedRank !== undefined && resolvedRank !== playingCardRank(id);
  const content = <><b aria-hidden="true">{rank}</b>{joker ? <img aria-hidden="true" src="/icons/frienden-app-32-v3.png" alt="" draggable={false} /> : <span aria-hidden="true">{suit}</span>}
    {wildcard && <small className="playing-card-wild" title={label}>{ranks[resolvedRank] ?? '☆'}</small>}</>;
  return onClick
    ? <button type="button" className={className} data-preview={preview || undefined} data-suit={suit} aria-label={label} aria-pressed={Boolean(selected)} disabled={disabled} onClick={onClick}>{content}</button>
    : <span className={className} data-suit={suit} role="img" aria-label={label}>{content}</span>;
}

export function SelectableHand({cards, last, game, selected, disabled, suggested, onSelect}: {
  cards: number[]; last: number[]; game: CardGame; selected: number[]; disabled: boolean; suggested: number[]; onSelect: (cards: number[]) => void;
}) {
  const {t} = useI18n();
  const gesture = useRef<{pointer: number; start: number; end: number; coordinate: number; vertical: boolean; stops: number[]; moving: boolean}>();
  const [preview,setPreview] = useState<number[]>([]);
  const [rejected,setRejected] = useState(false);
  const legal = (candidate: number[]) => !candidate.length || isLegalPlay(candidate,last,game);

  function commit(range: number[], tap: boolean) {
    const removing = range.every(id => selected.includes(id));
    const combined = removing ? selected.filter(id => !range.includes(id)) : [...new Set([...selected,...range])];
    const choices = [combined];
    if (!removing) choices.push(range);
    if (tap && !removing) {
      const same = cards.filter(id => id !== range[0] && playingCardRank(id) === playingCardRank(range[0]));
      for (let count=1; count <= same.length; count++) choices.push([...range,...same.slice(0,count)]);
      if (suggested.includes(range[0])) choices.push(suggested);
    }
    const next = choices.find(legal);
    setRejected(!next);
    if (next) onSelect(next);
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    const items = [...event.currentTarget.querySelectorAll('button.playing-card')];
    const index = items.indexOf((event.target as HTMLElement).closest('button.playing-card') as HTMLButtonElement);
    if (index < 0) return;
    const rects = items.map(item => item.getBoundingClientRect());
    const lastRect = rects[rects.length - 1];
    const vertical = rects.length > 1 && Math.abs(lastRect.top - rects[0].top) > Math.abs(lastRect.left - rects[0].left);
    const coordinate = vertical ? event.clientY : event.clientX;
    const stops = rects.map(rect => vertical ? rect.top : rect.left);
    gesture.current = {pointer:event.pointerId,start:index,end:index,coordinate,vertical,stops,moving:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const coordinate = active.vertical ? event.clientY : event.clientX;
    if (!active.moving && Math.abs(coordinate - active.coordinate) < 5) return;
    active.moving = true;
    let index = 0;
    active.stops.forEach((stop, candidate) => {if (stop <= coordinate) index = candidate;});
    active.end = Math.max(0,index);
    setPreview(cards.slice(Math.min(active.start,active.end), Math.max(active.start,active.end) + 1));
    setRejected(false);
  }
  function finish(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    gesture.current = undefined;
    setPreview([]);
    if (!cancel && !disabled) {
      const range = cards.slice(Math.min(active.start,active.end), Math.max(active.start,active.end) + 1);
      if (range.length) commit(range, !active.moving);
    }
  }
  return <div className="selectable-hand">
    <div className="playing-card-stack is-selectable" role="group" aria-label={t('landlord.yourHand')}
      style={{'--card-overlaps':Math.max(1,cards.length-1)} as CSSProperties}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finish} onPointerCancel={event => finish(event,true)}
      onLostPointerCapture={event => finish(event,true)}>
      {cards.map(id => <PlayingCard id={id} key={id} selected={selected.includes(id)} disabled={disabled}
        preview={preview.includes(id)} onClick={event => {if (!event.detail) commit([id],true);}} />)}
    </div>
    {rejected && !disabled && <span className="game-hand-hint" role="status">{t('game.invalidSelection')}</span>}
  </div>;
}

export function PlayingCardStack({count, label, children, compact = false}: {count: number; label?: string; children: ReactNode; compact?: boolean}) {
  return <div className={`playing-card-stack${compact ? ' is-compact' : ''}`} role="group" aria-label={label}
    style={{'--card-overlaps': Math.max(1, count - 1)} as CSSProperties}>
    {children}
  </div>;
}
