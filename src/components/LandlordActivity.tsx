import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api, ApiError} from '../lib/api';
import {useI18n, type TranslationKey} from '../lib/language';
import {copyText} from '../lib/presentation';
import {showToast} from '../lib/toast';
import {LANDLORD_ART, LANDLORD_ROOM_CODE, LANDLORD_ROOM_PARAM, type LandlordAction, type LandlordLobby, type LandlordRanking, type LandlordTableView} from '../lib/landlord';
import type {ActivityCampaignDTO} from '../types';
import {ActivityTitle} from './ActivityCampaignCard';
import {ConfirmDialog} from './ConfirmDialog';
import {SettingsDialog} from './SettingsDialog';
import {UserAvatar} from './UserAvatar';
import './LandlordActivity.css';

const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const pips = ['♠', '♥', '♣', '♦'];
const icon = (name: string) => <span aria-hidden="true" className="material-symbols-outlined">{name}</span>;

function Card({id, selected, onClick}: {id?: number; selected?: boolean; onClick?: () => void}) {
  const {t} = useI18n();
  if (id === undefined) return <span className="landlord-card is-backed" aria-hidden="true">♦</span>;
  const joker = id >= 52;
  const rank = joker ? (id === 53 ? t('landlord.bigJoker') : t('landlord.smallJoker')) : ranks[Math.floor(id / 4)];
  const suit = joker ? '✦' : pips[id % 4];
  const label = joker ? rank : rank + ' ' + suit;
  const className = `landlord-card${suit === '♥' || suit === '♦' || id === 53 ? ' is-red' : ''}${joker ? ' is-joker' : ''}`;
  const content = <><b>{rank}</b><span aria-hidden="true">{suit}</span></>;
  return onClick
    ? <button type="button" className={className} aria-label={label} aria-pressed={Boolean(selected)} onClick={onClick}>{content}</button>
    : <span className={className} aria-label={label}>{content}</span>;
}

function Seat({table, position, self = false}: {table: LandlordTableView; position: number; self?: boolean}) {
  const {t} = useI18n();
  const seat = table.seats.find(item => item.position === position);
  if (!seat) return <div className="landlord-seat is-empty"><span className="landlord-seat-avatar">{icon('person_add')}</span><small>{t('landlord.openSeat')}</small></div>;
  const bid = table.bids[position];
  const move = table.moves[position];
  const label = table.landlord !== null ? t(position === table.landlord ? 'landlord.landlord' : 'landlord.farmer')
    : table.status === 'bidding' && typeof bid === 'number' ? t(bid ? 'landlord.bidPoints' : 'landlord.noBid', {points: bid}) : '';
  return <div className={`landlord-seat${position === table.turn ? ' is-turn' : ''}${position === table.landlord ? ' is-landlord' : ''}`}>
    <UserAvatar className="landlord-seat-avatar" name={seat.member.name} uri={seat.member.avatar_uri} />
    <div className="landlord-seat-copy">
      <b>{self ? t('common.you') : seat.member.name}</b>
      <small>{label}{label && table.status === 'playing' ? ' · ' : ''}{table.status === 'playing' && t('landlord.cardCount', {count: seat.remaining})}</small>
    </div>
    {table.status === 'playing' && move && !move.cards.length && <span className="landlord-passed">{t('landlord.pass')}</span>}
  </div>;
}

const actionErrors: Record<string, TranslationKey> = {
  CLOSED: 'landlord.closed', ACCOUNT: 'landlord.verifiedOnly', TABLE: 'landlord.tableUnavailable',
  BUSY: 'landlord.alreadySeated', TURN: 'landlord.waitTurn', CARDS: 'landlord.invalidPlay', INVALID: 'landlord.actionFailed',
};

export function LandlordActivity({activity}: {activity: ActivityCampaignDTO}) {
  const {t, language} = useI18n();
  const location = useLocation();
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get(LANDLORD_ROOM_PARAM)?.toUpperCase().slice(0, 8) ?? '');
  const [lobby, setLobby] = useState<LandlordLobby>();
  const [table, setTable] = useState<LandlordTableView | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [dialog, setDialog] = useState<'ranking' | 'rules' | 'leave' | null>(null);
  const [now, setNow] = useState(Date.now);
  const [clockOffset, setClockOffset] = useState(0);
  const tableRef = useRef<LandlordTableView | null>(null);
  const actionRequest = useRef<AbortController>();
  const pollRequest = useRef<AbortController>();
  const canPlay = activity.active && activity.verified;
  const title = language.startsWith('zh') ? activity.title : activity.title_en || activity.title;

  const receiveTable = (next: LandlordTableView | null) => {
    if (next?.code !== tableRef.current?.code || next?.turn !== next?.your_seat) setSelected([]);
    else if (next?.version !== tableRef.current?.version) setSelected(current => current.filter(id => next?.hand.includes(id)));
    tableRef.current = next;
    setTable(next);
    if (next) {
      const timestamp = Date.now();
      setNow(timestamp);
      setClockOffset(next.server_now - timestamp / 1000);
    }
  };

  useEffect(() => {
    if (!canPlay) return;
    let stopped = false;
    let timer: number | undefined;
    const refresh = async () => {
      window.clearTimeout(timer);
      if (stopped) return;
      if (!document.hidden && !pollRequest.current && !actionRequest.current) {
        const request = new AbortController();
        pollRequest.current = request;
        try {
          const response = await api.getLandlordLobby(activity.key, tableRef.current?.code, request.signal);
          if (!request.signal.aborted) {
            setLobby(response);
            receiveTable(response.table);
            setFailed(false);
          }
        } catch {
          if (!request.signal.aborted) setFailed(true);
        } finally {
          if (pollRequest.current === request) pollRequest.current = undefined;
        }
      }
      if (!stopped) {
        const status = tableRef.current?.status;
        const interval = status === 'playing' || status === 'bidding' ? 1200 : status === 'waiting' ? 2200 : 5000;
        timer = window.setTimeout(refresh, interval);
      }
    };
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      pollRequest.current?.abort();
      pollRequest.current = undefined;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activity.key, attempt, canPlay]);

  useEffect(() => () => actionRequest.current?.abort(), []);
  useEffect(() => {
    if (!table?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [table?.deadline]);

  const perform = async (action: LandlordAction) => {
    if (!canPlay || actionRequest.current) return;
    pollRequest.current?.abort();
    const request = new AbortController();
    actionRequest.current = request;
    setBusy(true);
    try {
      const result = await api.landlordAction(activity.key, action, request.signal);
      if (request.signal.aborted) return;
      receiveTable(result.table);
      setSelected([]);
      if (result.changed) showToast(t('landlord.tableUpdated'), 'info');
      if (action.action === 'leave') setDialog(null);
      if (action.action === 'join') setJoinCode('');
      setFailed(false);
    } catch (error) {
      if (request.signal.aborted) return;
      const key = error instanceof ApiError ? actionErrors[error.identifier.split('@').pop() ?? ''] : undefined;
      showToast(t(key ?? 'landlord.actionFailed'), 'error');
    } finally {
      if (actionRequest.current === request) actionRequest.current = undefined;
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const join = (code: string) => void perform({action: 'join', code});
  const invite = async () => {
    if (!table) return;
    const url = new URL('/app/menu', window.location.origin);
    url.searchParams.set('panel', 'activities');
    url.searchParams.set('activity', activity.key);
    url.searchParams.set(LANDLORD_ROOM_PARAM, table.code);
    showToast(t(await copyText(url.href) ? 'landlord.inviteCopied' : 'landlord.copyFailed'));
  };
  const returnToLobby = () => {
    pollRequest.current?.abort();
    receiveTable(null);
    setAttempt(value => value + 1);
  };
  const turn = table?.turn === table?.your_seat;
  const remaining = table?.deadline ? Math.max(0, Math.ceil(table.deadline - now / 1000 - clockOffset)) : 0;
  const openRanking = () => setDialog('ranking');

  return <section className="landlord-activity">
    {!table ? <>
      <div className="landlord-hero">
        <img className="landlord-hero-art" src={LANDLORD_ART} alt="" draggable={false} />
        <div className="landlord-hero-copy">
          <small>{t('landlord.permanent')}</small>
          <ActivityTitle activity={activity} title={title} />
          <p>{t('landlord.heroCopy')}</p>
        </div>
      </div>
      <div className="landlord-lobby">
        {canPlay ? <>
          <div className="landlord-lobby-actions">
            <button className="landlord-primary" disabled={busy} type="button" onClick={() => void perform({action:'create'})}>{icon('add_circle')}{t('landlord.create')}</button>
            <button className="landlord-secondary" type="button" onClick={openRanking}>{icon('emoji_events')}{t('landlord.ranking')}</button>
          </div>
          <form className="landlord-join" onSubmit={event => {event.preventDefault(); if (LANDLORD_ROOM_CODE.test(joinCode)) join(joinCode);}}>
            <input value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t('landlord.roomCode')} aria-label={t('landlord.roomCode')} />
            <button className="landlord-secondary" disabled={busy || !LANDLORD_ROOM_CODE.test(joinCode)} type="submit">{t('landlord.join')}</button>
          </form>
          <div className="landlord-open-heading"><h3>{t('landlord.openTables')}</h3><button className="landlord-text-button" type="button" onClick={() => setDialog('rules')}>{t('landlord.rules')}</button></div>
          {failed ? <div className="landlord-empty"><p>{t('landlord.lobbyFailed')}</p><button className="landlord-text-button" type="button" onClick={() => setAttempt(value => value + 1)}>{t('common.retry')}</button></div>
            : !lobby ? <p role="status" className="landlord-empty">{t('common.loading')}</p>
            : lobby.rooms.length ? <ul className="landlord-rooms">{lobby.rooms.map(room => <li key={room.code}>
              <UserAvatar className="landlord-list-avatar" name={room.host.name} uri={room.host.avatar_uri} />
              <div><b>{t('landlord.hostTable', {name:room.host.name})}</b><small>{t('landlord.seated', {count:room.count})}</small></div>
              <button type="button" className="landlord-secondary" disabled={busy} onClick={() => join(room.code)}>{t('landlord.join')}{icon('chevron_right')}</button>
            </li>)}</ul> : <p className="landlord-empty">{t('landlord.noTables')}</p>}
        </> : <div className="landlord-restricted">
          <p>{t(activity.active ? 'landlord.verifiedOnly' : 'landlord.closed')}</p>
          {activity.active && <button type="button" className="landlord-secondary" onClick={openRanking}>{icon('emoji_events')}{t('landlord.ranking')}</button>}
        </div>}
      </div>
    </> : <>
      <div className="landlord-board">
        <div className="landlord-table-nav">
          <span>{t('landlord.table')} <b>{table.code}</b></span>
          <button className="landlord-text-button" type="button" onClick={() => setDialog('rules')}>{t('landlord.rules')}</button>
        </div>
        <div className="landlord-opponents">
          <Seat table={table} position={(table.your_seat + 2) % 3} />
          <Seat table={table} position={(table.your_seat + 1) % 3} />
        </div>
        <div className="landlord-center">
          {table.status === 'waiting' ? <>
            <img className="landlord-table-art" src={LANDLORD_ART} alt="" />
            <strong>{t('landlord.waiting')}</strong><span>{t('landlord.seated', {count: table.ready_count})}</span>
          </> : table.status === 'finished' || table.status === 'abandoned' ? <>
            {icon(table.status === 'abandoned' ? 'door_open' : 'emoji_events')}
            <strong>{t(table.status === 'abandoned' ? 'landlord.abandoned' : table.seats.find(seat => seat.position === table.your_seat)?.won ? 'landlord.win' : 'landlord.loss')}</strong>
            {table.status === 'finished' && <span>{t(table.winner === table.landlord ? 'landlord.landlordWon' : 'landlord.farmersWon')}</span>}
          </> : <>
            <div className="landlord-bottom-cards" aria-label={t('landlord.bottomCards')}>{Array.from({length:3}, (_, index) => <Card id={table.bottom_cards[index]} key={index} />)}</div>
            <strong className="landlord-turn" role="status">{t(table.status === 'bidding' ? (turn ? 'landlord.yourBid' : 'landlord.otherBid') : (turn ? 'landlord.yourPlay' : 'landlord.otherPlay'), {name: table.seats.find(seat => seat.position === table.turn)?.member.name ?? ''})}</strong>
            <span className="landlord-clock">{t('landlord.seconds', {count: remaining})}</span>
            {table.last_player !== null && <div className="landlord-last-play">
              <small>{t('landlord.lastPlay', {name: table.seats.find(seat => seat.position === table.last_player)?.member.name ?? ''})}</small>
              <div>{table.moves[table.last_player]?.cards.map(id => <Card id={id} key={id} />)}</div>
            </div>}
          </>}
        </div>
        <div className="landlord-your-seat"><Seat table={table} position={table.your_seat} self /></div>
      </div>
      <div className="landlord-play-controls">
        {table.status === 'bidding' || table.status === 'playing' ? <>
          <div className="landlord-hand" role="group" aria-label={t('landlord.yourHand')}>
            {table.hand.map(id => <Card id={id} key={id} selected={selected.includes(id)} onClick={() => {
              if (table.status === 'playing' && !busy) setSelected(cards => cards.includes(id) ? cards.filter(card => card !== id) : [...cards, id]);
            }} />)}
          </div>
          {table.status === 'bidding' ? <div className="landlord-controls">
            {turn && table.bid_options.map(value => <button key={value} className={value ? 'landlord-primary' : 'landlord-secondary'}
              disabled={busy || remaining <= 0} type="button" onClick={() => void perform({action:'bid', code:table.code, version:table.version, value})}>
              {t(value ? 'landlord.bidPoints' : 'landlord.noBid', {points:value})}
            </button>)}
          </div> : <div className="landlord-controls">
            <button className="landlord-secondary" type="button" disabled={!turn || busy || remaining <= 0 || !table.can_pass}
              onClick={() => void perform({action:'pass', code:table.code, version:table.version})}>{t('landlord.pass')}</button>
            <button className="landlord-secondary" type="button" disabled={!turn || busy || remaining <= 0}
              onClick={() => table.suggested_cards.length ? setSelected(table.suggested_cards) : showToast(t('landlord.noHint'), 'info')}>{t('landlord.hint')}</button>
            <button className="landlord-primary" type="button" disabled={!turn || busy || remaining <= 0 || !selected.length}
              onClick={() => void perform({action:'play', code:table.code, version:table.version, cards:selected})}>{t('landlord.play')}</button>
          </div>}
          <button className="landlord-text-button landlord-leave" type="button" disabled={busy} onClick={() => setDialog('leave')}>{t('landlord.leave')}</button>
        </> : table.status === 'waiting' ? <div className="landlord-controls">
          <button className="landlord-secondary" type="button" disabled={busy} onClick={() => void perform({action:'leave', code:table.code, version:table.version})}>{t('landlord.leave')}</button>
          <button className="landlord-primary" type="button" onClick={() => void invite()}>{icon('link')}{t('landlord.invite')}</button>
        </div> : <div className="landlord-controls">
          <button className="landlord-secondary" type="button" onClick={returnToLobby}>{t('landlord.backLobby')}</button>
          <button className="landlord-primary" type="button" onClick={openRanking}>{icon('emoji_events')}{t('landlord.ranking')}</button>
        </div>}
        {failed && <p className="landlord-reconnecting" role="status">{t('landlord.reconnecting')}</p>}
      </div>
    </>}
    <SettingsDialog open={dialog === 'rules'} title={t('landlord.rules')} onClose={() => setDialog(null)}>
      <ol className="landlord-rules">{(['ruleBid','rulePlay','ruleResult'] as const).map(key => <li key={key}>{t(`landlord.${key}`)}</li>)}</ol>
    </SettingsDialog>
    <SettingsDialog open={dialog === 'ranking'} title={t('landlord.ranking')} onClose={() => setDialog(null)}>
      {dialog === 'ranking' && <Ranking activityKey={activity.key} />}
    </SettingsDialog>
    <ConfirmDialog open={dialog === 'leave'} title={t('landlord.leave')} description={t('landlord.leaveConfirm')}
      confirmLabel={t('landlord.leave')} busy={busy} onClose={() => setDialog(null)}
      onConfirm={() => {if (table) void perform({action:'leave', code:table.code, version:table.version});}} />
  </section>;
}

function Ranking({activityKey}: {activityKey: string}) {
  const {t} = useI18n();
  const [year, setYear] = useState<number>();
  const [data, setData] = useState<LandlordRanking>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    setFailed(false);
    void api.getLandlordRanking(activityKey, year, request.signal).then(result => {
      if (!request.signal.aborted) setData(result);
    }).catch(() => {if (!request.signal.aborted) setFailed(true);});
    return () => request.abort();
  }, [activityKey, year, attempt]);
  const waiting = !data || (year !== undefined && year !== data.year);
  return <div className="landlord-ranking">
    {data && <header><span>{t('landlord.rankPolicy')}</span><select aria-label={t('landlord.rankYear')} value={year ?? data.year}
      onChange={event => setYear(Number(event.target.value))}>{data.years.map(value => <option key={value} value={value}>{t('landlord.yearLabel', {year:value})}</option>)}</select></header>}
    {failed ? <div className="landlord-empty"><p>{t('landlord.rankFailed')}</p><button className="landlord-text-button" onClick={() => setAttempt(value => value + 1)} type="button">{t('common.retry')}</button></div>
      : waiting ? <p className="landlord-empty" role="status">{t('common.loading')}</p>
      : !data.rows.length ? <p className="landlord-empty">{t('landlord.noRanks')}</p>
      : <>
        {data.mine && <p className="landlord-rank-mine">{t('landlord.myRank', {...data.mine})}</p>}
        <ol>{data.rows.map(row => <li key={row.member.user_id}>
          <span className="landlord-rank-number">{row.rank}</span>
          <UserAvatar className="landlord-list-avatar" name={row.member.name} uri={row.member.avatar_uri} />
          <b>{row.member.name}</b><span>{t('landlord.wins', {count:row.wins})}<small>{t('landlord.games', {count:row.games})}</small></span>
        </li>)}</ol>
      </>}
  </div>;
}
