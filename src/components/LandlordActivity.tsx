import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api, ApiError} from '../lib/api';
import {useI18n, type TranslationKey} from '../lib/language';
import {showToast} from '../lib/toast';
import {LANDLORD_ART, LANDLORD_ROOM_CODE, LANDLORD_ROOM_PARAM, type LandlordAction, type LandlordLobby, type LandlordRanking, type LandlordRankingMetric, type LandlordTableView} from '../lib/landlord';
import type {ActivityCampaignDTO} from '../types';
import {ActivityTitle} from './ActivityCampaignCard';
import {ChatSharePicker} from './ChatSharePicker';
import {ConfirmDialog} from './ConfirmDialog';
import {PlayingCard, PlayingCardStack, playingCardRank} from './PlayingCards';
import {SettingsDialog} from './SettingsDialog';
import {UserAvatar} from './UserAvatar';
import './LandlordActivity.css';

const icon = (name: string) => <span aria-hidden="true" className="material-symbols-outlined">{name}</span>;

function Seat({table, position, self = false}: {table: LandlordTableView; position: number; self?: boolean}) {
  const {t} = useI18n();
  const seat = table.seats.find(item => item.position === position);
  if (!seat) return <div className="landlord-seat is-empty"><span className="landlord-seat-avatar">{icon('person_add')}</span><small>{t('landlord.openSeat')}</small></div>;
  const bid = table.bids[position];
  const move = table.moves[position];
  const finished = table.status === 'finished';
  const isLandlord = !finished && position === table.landlord;
  const label = finished ? t(seat.ready ? 'landlord.ready' : 'landlord.notReady') : table.landlord !== null && !isLandlord ? t('landlord.farmer')
    : table.status === 'bidding' && typeof bid === 'number' ? t(bid ? 'landlord.bidPoints' : 'landlord.noBid', {points: bid}) : '';
  return <div className={`landlord-seat${position === table.turn ? ' is-turn' : ''}${isLandlord ? ' is-landlord' : ''}${seat.ready ? ' is-ready' : ''}`}>
    <div className="landlord-seat-portrait">
      <UserAvatar className="landlord-seat-avatar" name={seat.member.name} uri={seat.member.avatar_uri} />
      {isLandlord && <span className="landlord-role-seal">{icon('workspace_premium')}{t('landlord.landlord')}</span>}
    </div>
    <div className="landlord-seat-copy">
      <b>{self ? t('common.you') : seat.member.name}{position === table.host && <i className="landlord-host-mark" title={t('landlord.host')} aria-label={t('landlord.host')}>{icon('key')}</i>}</b>
      <small>{[label, table.status === 'playing' && t('landlord.cardCount', {count: seat.remaining}), seat.trustee && t('landlord.trustee')].filter(Boolean).join(' · ')}</small>
    </div>
    {seat.doubled && ['doubling', 'playing'].includes(table.status) && <span className="landlord-passed" aria-label={t('landlord.double')}>×2</span>}
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
  const invitation = new URLSearchParams(location.search).get(LANDLORD_ROOM_PARAM);
  const openedInvitation = useRef<string | null>(null);
  const [lobby, setLobby] = useState<LandlordLobby>();
  const [table, setTable] = useState<LandlordTableView | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [dialog, setDialog] = useState<'ranking' | 'rules' | 'leave' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [clockOffset, setClockOffset] = useState(0);
  const tableRef = useRef<LandlordTableView | null>(null);
  const actionRequest = useRef<AbortController>();
  const pollRequest = useRef<AbortController>();
  const canPlay = activity.active && activity.verified;
  const title = language.startsWith('zh') ? activity.title : activity.title_en || activity.title;

  const receiveTable = (next: LandlordTableView | null) => {
    if (next?.code !== tableRef.current?.code || next?.status !== 'playing') setSelected([]);
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
        const interval = status === 'playing' || status === 'bidding' || status === 'doubling' ? 1000 : status === 'finished' ? 1400 : status === 'waiting' ? 2200 : 5000;
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
      setFailed(false);
    } catch (error) {
      if (request.signal.aborted) return;
      const key = error instanceof ApiError ? actionErrors[error.identifier.split('@').pop() ?? ''] : undefined;
      showToast(t(key ?? 'landlord.actionFailed'), 'error');
    } finally {
      if (actionRequest.current === request) {
        actionRequest.current = undefined;
        setBusy(false);
      }
    }
  };
  const join = (code: string) => void perform({action: 'join', code});
  useEffect(() => {
    if (!invitation) openedInvitation.current = null;
    if (!canPlay || !invitation || !LANDLORD_ROOM_CODE.test(invitation) || openedInvitation.current === invitation || busy) return;
    const scheduled = window.setTimeout(() => {
      openedInvitation.current = invitation;
      join(invitation);
    }, 0);
    return () => window.clearTimeout(scheduled);
  }, [invitation, canPlay, busy]);
  const returnToLobby = () => {
    pollRequest.current?.abort();
    receiveTable(null);
    setAttempt(value => value + 1);
  };
  const turn = table?.turn === table?.your_seat;
  const remaining = table?.deadline ? Math.max(0, Math.ceil(table.deadline - now / 1000 - clockOffset)) : 0;
  const openRanking = () => setDialog('ranking');
  const self = table?.seats.find(seat => seat.position === table.your_seat);
  const playing = table?.status === 'playing';
  const bidding = table?.status === 'bidding';
  const doubling = table?.status === 'doubling';
  const lastPlay = table?.last_player != null ? table.moves[table.last_player]?.cards ?? [] : [];
  const hand = table ? [...table.hand].sort((a, b) => playingCardRank(b) - playingCardRank(a)) : [];
  const canAct = turn && !busy && remaining > 0 && !self?.trustee;
  const canShareRoom = table?.status === 'waiting' || (table?.status === 'finished' && table.ready_count < 3);
  useEffect(() => { if (!canShareRoom) setShareOpen(false); }, [canShareRoom]);

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
    </> : <div className={`landlord-room is-${table.status}`}>
      <div className="landlord-board">
        <div className="landlord-table-nav">
          <span className="landlord-round-no">{t('landlord.round', {count:table.round})}</span>
          <span>{table.base ? t('landlord.tableStakes', {base: table.base, multiplier: table.multiplier}) : t('landlord.table')}</span>
          <button className="landlord-text-button" type="button" onClick={() => setDialog('rules')}>{t('landlord.rules')}</button>
        </div>
        <div className="landlord-arena">
          <Seat table={table} position={(table.your_seat + 2) % 3} />
        <div className="landlord-center">
          {table.status === 'waiting' ? <>
            <img className="landlord-table-art" src={LANDLORD_ART} alt="" />
            <strong>{t('landlord.waiting')}</strong><span>{t('landlord.seated', {count: table.ready_count})}</span>
          </> : table.status === 'finished' || table.status === 'abandoned' ? <>
            {icon(table.status === 'abandoned' ? 'door_open' : 'emoji_events')}
            <strong>{t(table.status === 'abandoned' ? 'landlord.abandoned' : !self?.score ? 'landlord.prepareNext' : self.won ? 'landlord.win' : 'landlord.loss')}</strong>
            {table.status === 'finished' && !!self?.score && <>
              <span>{t(table.winner === table.landlord ? 'landlord.landlordWon' : 'landlord.farmersWon')}{table.spring ? ` · ${t('landlord.spring')}` : ''}</span>
              <div className="landlord-settlement">{table.seats.map(seat => <span key={seat.position}><b>{seat.score > 0 ? '+' : ''}{seat.score}</b>{seat.position === table.your_seat ? t('common.you') : seat.member.name}</span>)}</div>
            </>}
          </> : <>
            <PlayingCardStack count={3} label={t('landlord.bottomCards')} compact>{Array.from({length:3}, (_, index) => <PlayingCard id={table.bottom_cards[index]} key={index} />)}</PlayingCardStack>
            <div className="landlord-turn-row"><strong className="landlord-turn" role="status">{t(doubling ? 'landlord.doubling' : bidding ? (turn ? 'landlord.yourBid' : 'landlord.otherBid') : (turn ? 'landlord.yourPlay' : 'landlord.otherPlay'), {name: table.seats.find(seat => seat.position === table.turn)?.member.name ?? ''})}</strong>
              <span className="landlord-clock">{t('landlord.seconds', {count: remaining})}</span></div>
            {table.last_player !== null && <div className="landlord-last-play">
              <small>{t('landlord.lastPlay', {name: table.seats.find(seat => seat.position === table.last_player)?.member.name ?? ''})}</small>
              <PlayingCardStack count={lastPlay.length} compact>{lastPlay.map(id => <PlayingCard id={id} key={id} />)}</PlayingCardStack>
            </div>}
          </>}
        </div>
          <Seat table={table} position={(table.your_seat + 1) % 3} />
        </div>
      </div>
      <div className="landlord-play-controls">
        {bidding || doubling || playing ? <>
          <PlayingCardStack count={hand.length} label={t('landlord.yourHand')}>
            {hand.map(id => <PlayingCard id={id} key={id} selected={selected.includes(id)} disabled={!playing || busy || self?.trustee}
              onClick={() => setSelected(cards => cards.includes(id) ? cards.filter(card => card !== id) : [...cards, id])} />)}
          </PlayingCardStack>
          {bidding ? <div className="landlord-controls">
            {turn && table.bid_options.map(value => <button key={value} className={value ? 'landlord-primary' : 'landlord-secondary'}
              disabled={!canAct} type="button" onClick={() => void perform({action:'bid', code:table.code, version:table.version, value})}>
              {t(value ? 'landlord.bidPoints' : 'landlord.noBid', {points:value})}
            </button>)}
          </div> : doubling ? <div className="landlord-controls">
            {self?.doubled != null ? <span className="landlord-choice" role="status">{t('landlord.doubleReady')}</span>
              : [false, true].map(value => <button key={String(value)} className={value ? 'landlord-primary' : 'landlord-secondary'}
                disabled={busy || remaining <= 0} type="button" onClick={() => void perform({action:'double', code:table.code, version:table.version, value})}>
                {t(value ? 'landlord.double' : 'landlord.noDouble')}
              </button>)}
          </div> : <div className="landlord-controls">
            <button className="landlord-secondary" type="button" disabled={!canAct || !table.can_pass}
              onClick={() => void perform({action:'pass', code:table.code, version:table.version})}>{t('landlord.pass')}</button>
            <button className="landlord-secondary" type="button" disabled={!canAct}
              onClick={() => table.suggested_cards.length ? setSelected(table.suggested_cards) : showToast(t('landlord.noHint'), 'info')}>{t('landlord.hint')}</button>
            <button className="landlord-primary" type="button" disabled={!canAct || !selected.length}
              onClick={() => void perform({action:'play', code:table.code, version:table.version, cards:selected})}>{t('landlord.play')}</button>
          </div>}
          <div className="landlord-controls landlord-table-actions">
            <Seat table={table} position={table.your_seat} self />
            <button className="landlord-text-button" type="button" disabled={busy} aria-pressed={self?.trustee ?? false}
              onClick={() => void perform({action:'trustee', code:table.code, version:table.version, value:!self?.trustee})}>
              {icon('smart_toy')}{t(self?.trustee ? 'landlord.stopTrustee' : 'landlord.trustee')}
            </button>
            <button className="landlord-text-button" type="button" disabled={busy} onClick={() => setDialog('leave')}>{t('landlord.leave')}</button>
          </div>
        </> : table.status === 'waiting' ? <div className="landlord-controls">
          <button className="landlord-secondary" type="button" disabled={busy} onClick={() => void perform({action:'leave', code:table.code, version:table.version})}>{t('landlord.leave')}</button>
          <button className="landlord-primary" type="button" onClick={() => setShareOpen(true)}>{icon('share')}{t('landlord.invite')}</button>
        </div> : table.status === 'finished' ? <div className="landlord-rematch">
          <span className="landlord-choice">{t('landlord.readyCount', {count:table.seats.filter(seat => seat.ready).length})}</span>
          <div className="landlord-controls">
            <button className={self?.ready ? 'landlord-secondary' : 'landlord-primary'} type="button" disabled={busy} aria-pressed={self?.ready ?? false}
              onClick={() => void perform({action:'ready', code:table.code, version:table.version, round:table.round, value:!self?.ready})}>{t(self?.ready ? 'landlord.cancelReady' : 'landlord.readyUp')}</button>
            {table.your_seat === table.host && <button className="landlord-primary" type="button" disabled={busy || !table.can_start}
              onClick={() => void perform({action:'start', code:table.code, version:table.version, round:table.round})}>{t('landlord.startNext')}</button>}
            {table.ready_count < 3 && <button className="landlord-secondary" type="button" onClick={() => setShareOpen(true)}>{icon('share')}{t('landlord.invite')}</button>}
          </div>
          <div className="landlord-controls landlord-table-actions">
            <button className="landlord-text-button" type="button" onClick={openRanking}>{icon('emoji_events')}{t('landlord.ranking')}</button>
            <button className="landlord-text-button" type="button" disabled={busy} onClick={() => void perform({action:'leave', code:table.code, version:table.version})}>{t('landlord.leave')}</button>
          </div>
        </div> : <div className="landlord-controls">
          <button className="landlord-secondary" type="button" onClick={returnToLobby}>{t('landlord.backLobby')}</button>
          <button className="landlord-primary" type="button" onClick={openRanking}>{icon('emoji_events')}{t('landlord.ranking')}</button>
        </div>}
        {failed && <p className="landlord-reconnecting" role="status">{t('landlord.reconnecting')}</p>}
      </div>
    </div>}
    <SettingsDialog open={dialog === 'rules'} title={t('landlord.rules')} onClose={() => setDialog(null)}>
      <ol className="landlord-rules">{(['ruleBid','ruleDouble','rulePlay','ruleResult'] as const).map(key => <li key={key}>{t(`landlord.${key}`)}</li>)}</ol>
    </SettingsDialog>
    <SettingsDialog open={dialog === 'ranking'} title={t('landlord.ranking')} onClose={() => setDialog(null)}>
      {dialog === 'ranking' && <Ranking activityKey={activity.key} />}
    </SettingsDialog>
    <ConfirmDialog open={dialog === 'leave'} title={t('landlord.leave')} description={t('landlord.leaveConfirm')}
      confirmLabel={t('landlord.leave')} busy={busy} onClose={() => setDialog(null)}
      onConfirm={() => {if (table) void perform({action:'leave', code:table.code, version:table.version});}} />
    {table && canShareRoom && <ChatSharePicker open={shareOpen} title={t('landlord.chooseChat')} onClose={() => setShareOpen(false)}
      sendToChat={(chatId, clientId) => api.sendMessage(chatId, 11, JSON.stringify({kind:'landlord_room', activity_key:activity.key,
        room_code:table.code, title}), undefined, clientId)} />}
  </section>;
}

function Ranking({activityKey}: {activityKey: string}) {
  const {t, language} = useI18n();
  const [year, setYear] = useState<number>();
  const [metric, setMetric] = useState<LandlordRankingMetric>('points');
  const [data, setData] = useState<LandlordRanking>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    setFailed(false);
    void api.getLandlordRanking(activityKey, year, metric, request.signal).then(result => {
      if (!request.signal.aborted) setData(result);
    }).catch(() => {if (!request.signal.aborted) setFailed(true);});
    return () => request.abort();
  }, [activityKey, year, metric, attempt]);
  const waiting = !data || data.metric !== metric || (year !== undefined && year !== data.year);
  const percent = new Intl.NumberFormat(language, {style:'percent', maximumFractionDigits:1});
  const format = (row: {points: number; win_rate: number}) => metric === 'points'
    ? t('landlord.points', {count:row.points}) : percent.format(row.win_rate);
  return <div className="landlord-ranking">
    {data && <header><span>{t('landlord.rankPolicy')}</span><select aria-label={t('landlord.rankYear')} value={year ?? data.year}
      onChange={event => setYear(Number(event.target.value))}>{data.years.map(value => <option key={value} value={value}>{t('landlord.yearLabel', {year:value})}</option>)}</select></header>}
    <div className="landlord-rank-tabs" role="group" aria-label={t('landlord.ranking')}>
      {(['points','win_rate'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)}>
        {t(value === 'points' ? 'landlord.pointsBoard' : 'landlord.winRateBoard')}
      </button>)}
    </div>
    {failed ? <div className="landlord-empty"><p>{t('landlord.rankFailed')}</p><button className="landlord-text-button" onClick={() => setAttempt(value => value + 1)} type="button">{t('common.retry')}</button></div>
      : waiting ? <p className="landlord-empty" role="status">{t('common.loading')}</p>
      : !data.rows.length ? <p className="landlord-empty">{t('landlord.noRanks')}</p>
      : <>
        {data.mine && <p className="landlord-rank-mine">{t('landlord.myRank', {rank:data.mine.rank, score:format(data.mine)})}</p>}
        <ol>{data.rows.map(row => <li key={row.member.user_id}>
          <span className="landlord-rank-number">{row.rank}</span>
          <UserAvatar className="landlord-list-avatar" name={row.member.name} uri={row.member.avatar_uri} />
          <b>{row.member.name}</b><span>{format(row)}<small>{t('landlord.winRecord', {wins:row.wins, games:row.games})}</small></span>
        </li>)}</ol>
      </>}
  </div>;
}
