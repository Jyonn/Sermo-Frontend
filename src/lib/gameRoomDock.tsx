import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {api, ApiError} from './api';
import {useAuth} from './auth';
import {gameRoomReturnState} from './gameNavigation';
import {useI18n, type TranslationKey} from './language';
import {cardTableStatus, closedRoom, duelRoomStatus, type GameRoomPhase, type GameRoomStatus} from './gameRoomStatus';
import '../components/GameRoomDock.css';

type Game = 'landlord' | 'shuangkou' | 'mahjong' | 'duel';

export interface GameRoomDockEntry {
  activityKey: string;
  code: string;
  game: Game;
  title: string;
  titleEn?: string;
  status: GameRoomStatus;
}
type Room = GameRoomDockEntry;

const phaseLabels: Record<GameRoomPhase, TranslationKey> = {
  waiting: 'game.roomWaiting', playing: 'game.roomPlaying', turn: 'game.roomTurn',
  start: 'game.roomStart', finished: 'duel.roomEnded', closed: 'landlord.abandoned',
};

interface DockActions {
  minimize: (room: Room) => void;
  acknowledge: (activityKey: string, code: string) => void;
}

const DockContext = createContext<DockActions | null>(null);

async function readRoom(room: Room, signal: AbortSignal) {
  const {activityKey, code, game} = room;
  if (game === 'duel') {
    const {match} = await api.getNumberDuel(activityKey, undefined, signal, code);
    return match?.code === code ? duelRoomStatus(match) : closedRoom;
  }
  const {table} = game === 'landlord'
    ? await api.getLandlordLobby(activityKey, code, signal)
    : await api.getFourPlayerLobby(activityKey, code, signal);
  return table?.code === code ? cardTableStatus(table) : closedRoom;
}

function RoomChip({room, onOpen, onDismiss}: {room: Room; onOpen: () => void; onDismiss: () => void}) {
  const {t, language} = useI18n();
  const [status, setStatus] = useState(room.status);
  const [updated, setUpdated] = useState(false);
  const [offline, setOffline] = useState(false);
  const title = language.startsWith('zh') ? room.title : room.titleEn || room.title;
  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    let busy = false;
    let current = room.status;
    const complete = () => current.phase === 'closed' || (room.game === 'duel' && current.phase === 'finished');
    const refresh = async () => {
      window.clearTimeout(timer);
      if (controller.signal.aborted || busy || document.hidden || complete()) return;
      busy = true;
      try {
        const next = await readRoom(room, controller.signal);
        if (controller.signal.aborted) return;
        if (next.revision !== current.revision || next.phase !== current.phase) setUpdated(true);
        current = next;
        setStatus(next);
        setOffline(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && (error.status === 403 || error.status === 404 || error.identifier.endsWith('@CLOSED'))) {
          current = closedRoom;
          setStatus(current);
          setUpdated(true);
          setOffline(false);
        } else {
          setOffline(true);
        }
      } finally {
        busy = false;
        if (!controller.signal.aborted && !document.hidden && !complete()) {
          const delay = !navigator.onLine ? 6000 : current.phase === 'playing' || current.phase === 'turn' ? 1500 : 2800;
          timer = window.setTimeout(refresh, delay);
        }
      }
    };
    void refresh();
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [room]);

  const closed = status.phase === 'closed';
  const urgent = !offline && (status.phase === 'turn' || status.phase === 'start');
  const label = t(offline ? 'game.roomReconnecting' : phaseLabels[status.phase]);
  return <button className={`game-room-chip${urgent ? ' is-urgent' : ''}${status.phase === 'turn' ? ' is-my-turn' : ''}`} type="button"
    onClick={closed ? onDismiss : onOpen} title={t(closed ? 'common.close' : 'game.returnToRoom')}
    aria-label={`${t(closed ? 'common.close' : 'game.returnToRoom')} · ${title} · ${label}${updated ? ` · ${t('game.roomUpdate')}` : ''}`}>
    <span className="game-room-chip-icon" aria-hidden="true">
      <span className="material-symbols-outlined">{room.game === 'duel' ? 'pin' : 'playing_cards'}</span>
      {updated && <i key={status.phase} />}
    </span>
    <span className="game-room-chip-copy"><strong>{title}</strong><small aria-live="polite">{label}</small></span>
    <span className="material-symbols-outlined game-room-chip-open" aria-hidden="true">{closed ? 'close' : 'open_in_full'}</span>
  </button>;
}

type DockPosition = {left: number; top: number};
const clamp = (value: number, limit: number) => Math.max(0, Math.min(value, limit));

function GameRoomDock({visible, children}: {visible: boolean; children: ReactNode}) {
  const area = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLElement>(null);
  const drag = useRef<{id: number; x: number; y: number; origin: DockPosition; moved: boolean} | null>(null);
  const suppressClick = useRef(false);
  const [bounds, setBounds] = useState({left: 0, top: 0});
  const [anchor, setAnchor] = useState<{right: boolean; ratio: number} | null>(null);
  const [moving, setMoving] = useState<DockPosition | null>(null);

  useLayoutEffect(() => {
    const boundary = area.current;
    const panel = dock.current;
    if (!visible || !boundary || !panel) return;
    const measure = () => setBounds({
      left: Math.max(0, boundary.clientWidth - panel.offsetWidth),
      top: Math.max(0, boundary.clientHeight - panel.offsetHeight),
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(boundary);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [visible]);

  function startDrag(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current || !area.current) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    const region = area.current.getBoundingClientRect();
    const panel = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, moved: false,
      origin: {left: panel.left - region.left, top: panel.top - region.top},
    };
    suppressClick.current = false;
    button.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) <= 6) return;
    start.moved = true;
    setMoving({left: clamp(start.origin.left + dx, bounds.left), top: clamp(start.origin.top + dy, bounds.top)});
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = start.moved;
    if (start.moved && event.type === 'pointerup') {
      const left = clamp(start.origin.left + event.clientX - start.x, bounds.left);
      const top = clamp(start.origin.top + event.clientY - start.y, bounds.top);
      setAnchor({right: left > bounds.left / 2, ratio: bounds.top ? top / bounds.top : 0});
    }
    setMoving(null);
  }

  const position = moving ?? (anchor && {left: anchor.right ? bounds.left : 0, top: anchor.ratio * bounds.top});
  if (!visible) return null;
  return <div className="game-room-dock-area" ref={area}>
    <aside className={`game-room-dock${moving ? ' is-dragging' : ''}`} ref={dock}
      style={position ? {left: position.left, top: position.top, bottom: 'auto'} : undefined}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
      onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
      onContextMenu={event => event.preventDefault()}
      onClickCapture={event => {
        if (!suppressClick.current || event.detail === 0) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}>
      {children}
    </aside>
  </div>;
}

export function GameRoomDockProvider({children, openTable}: {children: ReactNode; openTable: (key: string) => void}) {
  const {session} = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = session ? `${session.user.space_id}:${session.user.user_id}` : null;
  const [rooms, setRooms] = useState<{owner: string | null; entries: Room[]}>({owner: null, entries: []});
  useEffect(() => {
    setRooms(current => current.owner === identity ? current : {owner: identity, entries: []});
  }, [identity]);
  const minimize = useCallback((room: Room) => {
    if (!identity) return;
    setRooms(current => ({
      owner: identity,
      entries: [room, ...(current.owner === identity ? current.entries.filter(other => other.activityKey !== room.activityKey) : [])],
    }));
  }, [identity]);
  const acknowledge = useCallback((activityKey: string, code: string) => {
    setRooms(current => current.entries.some(room => room.activityKey === activityKey && room.code === code)
      ? {...current, entries: current.entries.filter(room => room.activityKey !== activityKey || room.code !== code)}
      : current);
  }, []);
  const visible = Boolean(identity && rooms.owner === identity && location.pathname.startsWith('/app/'));
  return <DockContext.Provider value={{minimize, acknowledge}}>
    {children}
    <GameRoomDock visible={visible && rooms.entries.length > 0}>
      {rooms.entries.map(room => <RoomChip key={`${room.activityKey}:${room.code}`} room={room}
        onDismiss={() => acknowledge(room.activityKey, room.code)}
        onOpen={() => room.game === 'duel'
          ? navigate(`/app/number-duel/${room.code}`, {state: gameRoomReturnState(location)})
          : openTable(room.activityKey)} />)}
    </GameRoomDock>
  </DockContext.Provider>;
}

export function useGameRoomMinimize(room: Room, onMinimize?: () => void) {
  const dock = useContext(DockContext);
  const {activityKey, code} = room;
  const acknowledge = dock?.acknowledge;
  useEffect(() => {
    acknowledge?.(activityKey, code);
  }, [acknowledge, activityKey, code]);
  if (!dock || !onMinimize || room.status.phase === 'closed') return undefined;
  return () => {
    dock.minimize(room);
    onMinimize();
  };
}
