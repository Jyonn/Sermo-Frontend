import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api} from '../lib/api';
import {useI18n, type TranslationKey} from '../lib/language';
import {useFourPlayerRoom} from '../lib/useFourPlayerRoom';
import {GameRoomMinimizeButton} from '../lib/gameRoomDock';
import {cardTableStatus} from '../lib/gameRoomStatus';
import {TABLE_ROOM_PARAM, type FourPlayerGame, type FourPlayerMode, type FourPlayerTable, type GameMove,
  type MahjongBoard, type MahjongChoice, type ShuangkouBoard} from '../lib/tabletop';
import type {ActivityCampaignDTO} from '../types';
import {ActivityTitle} from './ActivityCampaignCard';
import {ChatSharePicker} from './ChatSharePicker';
import {MahjongTile} from './MahjongTile';
import {PlayingCard, PlayingCardStack, SelectableHand, playingCardRank} from './PlayingCards';
import {GameTableTools, GameExitDialog, GameSeatClock, useGameExit, type GameExitHandler} from './GameTableControls';
import {GameQuickVoiceCaption} from './GameQuickVoice';
import {useGameQuickVoice} from '../lib/useGameQuickVoice';
import {GameLeaderboard} from './GameLeaderboard';
import {CardRuleGuide, MahjongRuleGuide} from './GameRules';
import {isLegalPlay} from '../lib/cardPatterns';
import {SettingsDialog} from './SettingsDialog';
import {TableModePicker} from './TableModePicker';
import {UserAvatar} from './UserAvatar';
import './FourPlayerActivity.css';

const MODE_NAMES = {classic:'tabletop.classicShuangkou', firefight:'tabletop.firefight', standard:'tabletop.standard'} as const;
const CARD_MODES: ReadonlyArray<readonly [FourPlayerMode, TranslationKey]> = [['classic',MODE_NAMES.classic], ['firefight',MODE_NAMES.firefight]];
const OUTCOMES: Record<string, TranslationKey> = {double:'tabletop.double', single:'tabletop.single', even:'tabletop.even',
  draw:'tabletop.draw', self_draw:'tabletop.selfDraw', discard_win:'tabletop.discardWin', rob_kong:'tabletop.robKong', forfeit:'game.finishedByForfeit'};
const CALLS = {chi:'tabletop.chi', pong:'tabletop.pong', kong:'tabletop.kong', hu:'tabletop.hu',
  concealed_kong:'tabletop.concealedKong', added_kong:'tabletop.addedKong'} as const;
const WINDS = ['tabletop.east','tabletop.south','tabletop.west','tabletop.north'] as const;
const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;

function TableSeat({table, position, game, side, seconds, quickVoice}: {
  table: FourPlayerTable; position: number; game: FourPlayerGame; side: string; seconds: number; quickVoice: ReturnType<typeof useGameQuickVoice>;
}) {
  const {t} = useI18n();
  const seat = table.seats.find(item => item.position === position);
  if (!seat) return <div className={`four-player-seat is-${side} is-empty`}>{icon('person_add')}{t('landlord.openSeat')}</div>;
  const self = position === table.your_seat;
  const board = table.board;
  const placing = board && 'placements' in board ? board.placements.indexOf(position) : -1;
  const role = game === 'shuangkou' ? (position + 2) % 4 === table.your_seat ? t('tabletop.partner') : null
    : board && 'dealer' in board ? t(WINDS[(position - board.dealer + 4) % 4]) : null;
  const status = table.status === 'playing' ? seat.trustee ? t('landlord.trustee') : placing >= 0 ? t('tabletop.place', {count:placing + 1})
    : t('landlord.cardCount', {count:seat.remaining}) : t(seat.ready ? 'landlord.ready' : 'landlord.notReady');
  const pending = board && 'pending' in board ? board.pending : null;
  const active = pending ? self && Boolean(pending.choices?.length) : position === board?.turn;
  return <div className={`four-player-seat game-seat is-${side}${active ? ' is-turn' : ''}${seat.ready ? ' is-ready' : ''}`}>
    <GameQuickVoiceCaption message={quickVoice.messageFor(seat.member.user_id)} />
    <UserAvatar className="four-player-avatar" name={seat.member.name} uri={seat.member.avatar_uri} />
    <div><strong>{self ? t('common.you') : seat.member.name}{position === table.host && <small title={t('landlord.host')}>{icon('key')}</small>}</strong>
      <span>{role && `${role} · `}{status}</span></div>
    {table.status === 'finished' && seat.score !== null && <b className="four-player-points">{seat.score > 0 ? '+' : ''}{seat.score}</b>}
    <GameSeatClock seconds={active ? seconds : null} />
  </div>;
}

function MahjongCenter({board, yourSeat}: {board: MahjongBoard; yourSeat: number}) {
  const {t} = useI18n();
  return <div className="mahjong-board">
    <div className="mahjong-wall"><span>{t('tabletop.wall', {count:board.wall_count})}</span>
      {board.pending && <span className="mahjong-latest"><MahjongTile tile={board.pending.tile} />
        {t(board.pending.kind === 'added_kong' ? 'tabletop.addedKong' : 'tabletop.lastDiscard')}</span>}
    </div>
    <div className="mahjong-rivers">
      {[2,3,1,0].map(relative => {
        const position = (yourSeat + relative) % 4;
        return <div key={position} className="mahjong-river">
          <small>{t(WINDS[(position - board.dealer + 4) % 4])}</small>
          <div className="mahjong-discarded" tabIndex={0}>{board.rivers[position].map(tile => <MahjongTile key={tile} tile={tile} />)}</div>
          {!!board.melds[position].length && <div className="mahjong-melds">{board.melds[position].map((meld,index) => <span key={index} aria-label={t(CALLS[meld.kind])}>
            {meld.tiles.map((tile, slot) => <MahjongTile key={slot} tile={tile} />)}
          </span>)}</div>}
        </div>;
      })}
    </div>
  </div>;
}

function MahjongChoiceButton({choice, disabled, onClick}: {choice: MahjongChoice; disabled: boolean; onClick: () => void}) {
  const {t} = useI18n();
  const faces = choice.kind === 'chi' ? choice.faces ?? [] : choice.face === undefined ? [] : [choice.face];
  return <button className={choice.kind === 'hu' ? 'landlord-primary' : 'landlord-secondary'} type="button" disabled={disabled} onClick={onClick}>
    {t(CALLS[choice.kind])}{faces.map((face,index) => <MahjongTile key={index} tile={face * 4} />)}
  </button>;
}

export function FourPlayerActivity({activity, game, exitHandler, onMinimize}: {activity: ActivityCampaignDTO; game: FourPlayerGame; exitHandler: GameExitHandler; onMinimize: () => void}) {
  const {t, language} = useI18n();
  const {search} = useLocation();
  const invitation = new URLSearchParams(search).get(TABLE_ROOM_PARAM);
  const canPlay = activity.active && activity.verified;
  const {lobby, table, failed, busy, seconds, closeExpired, move, perform, retry} = useFourPlayerRoom(activity.key, canPlay, invitation);
  const quickVoice = useGameQuickVoice(activity.key, table?.code, table?.quick_voice);
  const [selected, setSelected] = useState<number[]>([]);
  const [panel, setPanel] = useState<'rules' | 'share' | 'ranking' | null>(null);
  const board = table?.board;
  const meld = board && 'melds' in board ? board : null;
  const cards = board && 'last' in board ? board : null;
  const self = table?.seats.find(seat => seat.position === table.your_seat);
  const state = table?.status;
  const playing = state === 'playing';
  const myTurn = Boolean(board && board.turn === table?.your_seat);
  const canAct = playing && !busy && !self?.trustee && seconds > 0;
  const cardGame = table?.mode === 'firefight' ? 'firefight' : 'classic';
  const selectedCards = cards ? selected.filter(id => cards.hand.includes(id)) : [];
  const canSubmit = Boolean(canAct && myTurn && cards && isLegalPlay(selectedCards,cards.last,cardGame));
  const exit = useGameExit(Boolean(table && state !== 'abandoned'),playing,exitHandler,async () => Boolean(await move({action:'leave'})));
  const canShare = table && (state === 'waiting' || state === 'finished') && table.seats.length < 4;
  const title = language.startsWith('zh') ? activity.title : activity.title_en || activity.title;
  const hand = cards ? [...cards.hand].sort((a,b) => playingCardRank(b) - playingCardRank(a)) : meld?.hand ?? [];
  const outcome = board?.outcome && OUTCOMES[board.outcome] ? t(OUTCOMES[board.outcome]) : t('landlord.loss');

  useEffect(() => {setSelected([]);}, [table?.code, table?.round, meld?.turn, meld?.pending?.decision]);
  useEffect(() => {if (!canShare && panel === 'share') setPanel(null);}, [canShare, panel]);

  function send(moveToSend: GameMove) {
    setSelected([]);
    void move(moveToSend);
  }

  return <section className={`four-player game-${game}`} data-game-room={table && state !== 'abandoned' ? '' : undefined}>
    {!table ? <div className="four-player-lobby-layout">
      <div className="four-player-hero">
        <div className="four-player-hero-copy"><small>{t('landlord.permanent')}</small><ActivityTitle activity={activity} title={title} />
          <p>{t(game === 'shuangkou' ? 'tabletop.shuangkouIntro' : 'tabletop.mahjongIntro')}</p></div>
        <div className="four-player-art" aria-hidden="true">{game === 'mahjong'
          ? [124,52,20].map(tile => <MahjongTile key={tile} tile={tile} />)
          : [13,53,52].map(id => <PlayingCard key={id} id={id} />)}</div>
      </div>
      <div className="four-player-lobby">
        <div className="four-player-actions"><button className="landlord-primary" type="button" disabled={!canPlay || busy}
          onClick={() => void perform({action:'create'})}>{icon('add_circle')}{t('landlord.create')}</button>
          <button className="landlord-secondary" type="button" onClick={() => setPanel('rules')}>{t('landlord.rules')}</button>
          {activity.active && <button className="landlord-secondary" type="button" onClick={() => setPanel('ranking')}>
            {icon('emoji_events')}{t('landlord.ranking')}</button>}</div>
        {!canPlay ? <p className="four-player-placeholder">{t(activity.active ? 'landlord.verifiedOnly' : 'landlord.closed')}</p>
          : failed ? <p className="four-player-placeholder">{t('landlord.lobbyFailed')} <button type="button" className="landlord-text-button" onClick={retry}>{t('common.retry')}</button></p>
          : !lobby ? <p className="four-player-placeholder" role="status">{t('common.loading')}</p>
          : <><h3>{t('landlord.openTables')}</h3>
            {!lobby.rooms.length ? <p className="four-player-placeholder">{t('landlord.noTables')}</p>
              : <ul className="four-player-open">{lobby.rooms.map(room => <li key={room.code}>
                <UserAvatar className="four-player-avatar" name={room.host.name} uri={room.host.avatar_uri} />
                <div><b>{t('landlord.hostTable', {name:room.host.name})}</b><small>{t(MODE_NAMES[room.mode])} · {t('tabletop.seated', {count:room.count})}</small></div>
                <button className="landlord-secondary" type="button" disabled={busy} onClick={() => void perform({action:'join', code:room.code})}>{t('landlord.join')}</button>
              </li>)}</ul>}
          </>}
      </div>
    </div> : <div className={`four-player-room is-${state}`}>
      <header className="four-player-room-info"><span>{t(MODE_NAMES[table.mode])}{table.round > 0 && ` · ${t('landlord.round', {count:table.round})}`}</span>
        <button className="landlord-text-button" type="button" onClick={() => setPanel('rules')}>{t('landlord.rules')}</button>
        {!playing && <button className="landlord-text-button" type="button" onClick={() => setPanel('ranking')}
          aria-label={t('landlord.ranking')} title={t('landlord.ranking')}>{icon('emoji_events')}</button>}
        <GameTableTools game={game} active={playing} cue={!seconds || self?.trustee ? null : meld?.pending ? meld.pending.choices?.length ? 'claim' : null
          : myTurn ? meld ? 'discard' : 'play' : null} token={table.deadline ?? undefined} quickVoice={quickVoice}>
          <GameRoomMinimizeButton room={{activityKey:activity.key, code:table.code, game,
            title:activity.title, titleEn:activity.title_en, status:cardTableStatus(table)}} disabled={busy} onMinimize={onMinimize} />
        </GameTableTools>
      </header>
      <div className="four-player-arena">
        {(['south','right','north','left'] as const).map((side,index) => <TableSeat key={side} table={table} game={game} side={side} seconds={seconds} quickVoice={quickVoice}
          position={(table.your_seat + index) % 4} />)}
        <div className="four-player-center">
          {state === 'waiting' ? <div className="four-player-announcement"><strong>{t(table.seats.length < 4 ? 'landlord.waiting' : 'tabletop.waitingReady')}</strong><span>{t('tabletop.seated', {count:table.seats.length})}</span></div>
            : state === 'abandoned' ? <div className="four-player-announcement"><strong>{t('landlord.abandoned')}</strong></div>
            : state === 'finished' ? <div className="four-player-announcement"><strong>{outcome}</strong><span>{t('landlord.prepareNext')}</span></div>
            : <><div className="four-player-turn"><strong role="status">{t(meld?.pending ? 'tabletop.waitingCall' : myTurn ? 'landlord.yourPlay' : 'landlord.otherPlay',
                {name:table.seats.find(seat => seat.position === board?.turn)?.member.name ?? ''})}</strong></div>
              {meld ? <MahjongCenter board={meld} yourSeat={table.your_seat} /> : cards && <ShuangkouCenter board={cards} table={table} />}
            </>}
        </div>
      </div>
      <div className="four-player-controls">
        {playing ? <>
          {meld ? <div className="mahjong-hand" role="group" aria-label={t('landlord.yourHand')}>
            {hand.map(tile => <MahjongTile key={tile} tile={tile} selected={selected.includes(tile)} drawn={tile === meld.drawn}
              disabled={!myTurn || !canAct || Boolean(meld.pending)} onClick={() => setSelected(selected[0] === tile ? [] : [tile])} />)}
          </div> : cards && <SelectableHand key={`${table.code}:${table.round}`} cards={hand}
            selected={selectedCards} disabled={busy || Boolean(self?.trustee)} onSelect={setSelected} />}
          <div className="four-player-actions">
            {meld?.pending ? meld.pending.choices && <>
              <button type="button" className="landlord-secondary" disabled={!canAct}
                onClick={() => send({action:'claim', index:-1, decision:meld.pending!.decision})}>{t('tabletop.skipCall')}</button>
              {meld.pending.choices.map((choice,index) => <MahjongChoiceButton key={index} choice={choice} disabled={!canAct}
                onClick={() => send({action:'claim', index, decision:meld.pending!.decision})} />)}
            </> : meld ? <>
              {meld.own_choices.map((choice,index) => <MahjongChoiceButton key={index} choice={choice} disabled={!canAct || !myTurn}
                onClick={() => send({action:'mahjong_action', index})} />)}
              <button className="landlord-primary" type="button" disabled={!canAct || !myTurn || selected.length !== 1}
                onClick={() => send({action:'discard', tile:selected[0]})}>{t('tabletop.discard')}</button>
            </> : cards && <>
              <button className="landlord-secondary" type="button" onClick={() => send({action:'pass'})} disabled={!canAct || !cards.can_pass}>{t('landlord.pass')}</button>
              <button className="landlord-secondary" type="button" disabled={!canAct || !myTurn || !cards.suggested.length}
                onClick={() => setSelected(cards.suggested)}>{t('landlord.hint')}</button>
              <button className="landlord-primary" type="button" onClick={() => send({action:'play', cards:selectedCards})} disabled={!canSubmit}>{t('landlord.play')}</button>
            </>}
            <button className="landlord-text-button four-player-trustee" type="button" disabled={busy} aria-pressed={self?.trustee ?? false}
              onClick={() => send({action:'trustee', value:!self?.trustee})}>{icon('smart_toy')}{t(self?.trustee ? 'landlord.stopTrustee' : 'landlord.trustee')}</button>
          </div>
        </> : state === 'abandoned' ? <div className="four-player-actions"><button className="landlord-secondary" type="button" onClick={closeExpired}>{t('landlord.backLobby')}</button></div>
          : <div className="four-player-management">
            {game === 'shuangkou' && table.host === table.your_seat && <TableModePicker choices={CARD_MODES} mode={table.mode} disabled={busy}
              onChange={value => send({action:'mode',value})} />}
            <div className="four-player-actions">
              <button className={self?.ready ? 'landlord-secondary' : 'landlord-primary'} type="button" disabled={busy}
                onClick={() => send({action:'ready',value:!self?.ready})}>{t(self?.ready ? 'landlord.cancelReady' : 'landlord.readyUp')}</button>
              {table.host === table.your_seat && <button className="landlord-primary" type="button" disabled={busy || !table.can_start}
                onClick={() => send({action:'start'})}>{t(state === 'finished' ? 'landlord.startNext' : 'tabletop.start')}</button>}
              {canShare && <button className="landlord-secondary" type="button" onClick={() => setPanel('share')}>{icon('share')}{t('landlord.invite')}</button>}
            </div>
          </div>}
        {state !== 'abandoned' && <button className="landlord-text-button four-player-leave" type="button" disabled={busy}
          onClick={exit.request}>{t('landlord.leave')}</button>}
        {failed && <p className="four-player-placeholder" role="status">{t('landlord.reconnecting')}</p>}
      </div>
    </div>}

    <SettingsDialog open={panel === 'rules'} title={t('landlord.rules')} onClose={() => setPanel(null)}>
      {game === 'shuangkou' ? <CardRuleGuide game={cardGame} /> : <MahjongRuleGuide />}
      <ol className="landlord-rules">{(game === 'shuangkou'
        ? ['tabletop.ruleTeams','tabletop.ruleClassic','tabletop.ruleFirefight'] : ['tabletop.ruleTiles','tabletop.ruleCalls','tabletop.ruleHu','tabletop.ruleMahjongPoints'])
        .map(key => <li key={key}>{t(key as TranslationKey)}</li>)}</ol>
    </SettingsDialog>
    <GameLeaderboard activityKey={activity.key} open={panel === 'ranking'} onClose={() => setPanel(null)} />
    <GameExitDialog exit={exit} live={playing} busy={busy} />
    {table && canShare && <ChatSharePicker open={panel === 'share'} title={t('landlord.chooseChat')} onClose={() => setPanel(null)}
      sendToChat={(chatId,clientId) => api.sendMessage(chatId, 11, JSON.stringify({kind:'table_room', activity_key:activity.key, room_code:table.code, title}), undefined, clientId)} />}
  </section>;
}

function ShuangkouCenter({board, table}: {board: ShuangkouBoard; table: FourPlayerTable}) {
  const {t} = useI18n();
  if (!board.last.length) return <div className="four-player-announcement">
    {board.opening !== null && <><span>{t('tabletop.opening')}</span><PlayingCard id={board.opening} /></>}
  </div>;
  return <div className="four-player-last">
    <small>{t('landlord.lastPlay', {name:table.seats.find(seat => seat.position === board.last_player)?.member.name ?? ''})}
      {table.mode === 'firefight' && board.last_pattern?.stars ? ` · ${t('tabletop.stars', {count:board.last_pattern.stars})}` : ''}</small>
    <PlayingCardStack count={board.last.length} compact>{board.last.map((id,index) =>
      <PlayingCard id={id} key={id} resolvedRank={board.last_pattern?.ranks[index]} />)}</PlayingCardStack>
    {!!board.passed.length && <small>{t('tabletop.passed', {count:board.passed.length})}</small>}
    {board.contributions[table.your_seat] !== 0 && <small>{t('tabletop.contribution', {score:board.contributions[table.your_seat]})}</small>}
  </div>;
}
