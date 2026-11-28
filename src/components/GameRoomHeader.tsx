import {useEffect, useId, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useGameRoomMinimize, type GameRoomDockEntry} from '../lib/gameRoomDock';
import {useI18n} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import type {useGameExit} from './GameTableControls';
import {OverlayIconButton} from './OverlayIconButton';
import './GameRoomHeader.css';

export interface GameRoomHeaderTarget {
  headerTarget?: HTMLElement | null;
  onExitRoom?: () => void;
}

export function GameRoomHeader({target, room, exit, live, busy, onExitRoom, onMinimize, onShare}: {
  target?: HTMLElement | null;
  room: GameRoomDockEntry;
  exit: ReturnType<typeof useGameExit>;
  live: boolean;
  busy: boolean;
  onExitRoom?: () => void;
  onMinimize?: () => void;
  onShare?: () => void;
}) {
  const {t} = useI18n();
  const controls = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const minimize = useGameRoomMinimize(room, onMinimize);
  const popoverOpen = exit.open && Boolean(target);
  const label = t('game.leaveRoom');

  function close(focus = true) {
    if (busy) return;
    exit.close();
    if (focus) controls.current?.querySelector<HTMLButtonElement>('.game-room-exit-trigger')?.focus({preventScroll:true});
  }

  useModalFocus(panel, popoverOpen, () => close(), {manageLayer:false, restoreFocus:false});
  const dismiss = useRef(close);
  dismiss.current = close;
  useEffect(() => {
    if (!popoverOpen) return;
    const outside = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node)) dismiss.current(false);
    };
    document.addEventListener('pointerdown',outside,true);
    return () => document.removeEventListener('pointerdown',outside,true);
  }, [popoverOpen]);

  if (!target) return null;
  return createPortal(<div className="game-room-header-controls" data-game={room.game} ref={controls}>
    {onShare && <OverlayIconButton icon="share" aria-label={t('landlord.invite')} title={t('landlord.invite')}
      disabled={busy} onClick={() => {close(false); onShare();}} />}
    <OverlayIconButton icon="logout" className="game-room-exit-trigger" aria-label={label} title={label}
      aria-haspopup="dialog" aria-expanded={popoverOpen} aria-controls={popoverOpen ? id : undefined} disabled={busy}
      onClick={() => {if (popoverOpen) close(); else exit.request(onExitRoom);}} />
    {popoverOpen && <div className="game-room-exit-popover" ref={panel} id={id} role="dialog"
      aria-labelledby={`${id}-title`} aria-describedby={live ? `${id}-warning` : undefined}>
      <strong id={`${id}-title`}>{label}</strong>
      {live && <p id={`${id}-warning`}>{t('game.forfeitConfirm')}</p>}
      <div className="game-room-exit-options">
        <button type="button" disabled={busy} onClick={() => close()}>{t('game.stay')}</button>
        {minimize && <button type="button" disabled={busy} onClick={() => {exit.close(); minimize();}}>{t('game.minimizeAction')}</button>}
        <button type="button" className="game-room-exit-confirm" disabled={busy} onClick={() => void exit.confirm()}>
          {t('game.leaveAction')}
        </button>
      </div>
    </div>}
  </div>,target);
}
