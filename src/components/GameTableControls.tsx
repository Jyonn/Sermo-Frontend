import {useEffect, useRef, useState, type MutableRefObject, type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {GAME_NAVIGATION_EVENT, guardGameHistory} from '../lib/gameNavigation';
import {useI18n} from '../lib/language';
import type {useGameQuickVoice} from '../lib/useGameQuickVoice';
import {useRoomVoicePlayback} from '../lib/useRoomVoicePlayback';
import {ConfirmDialog} from './ConfirmDialog';
import './GameTableControls.css';

export type GameExitHandler = MutableRefObject<((after?: () => void) => void) | undefined>;

export function useGameExit(inRoom: boolean, live: boolean, handler: GameExitHandler | undefined, onLeave: () => Promise<boolean>) {
  const [open,setOpen] = useState(false);
  const next = useRef<() => void>();
  const beforeLeave = useRef(onLeave);
  const allowBack = useRef(false);
  const location = useLocation();
  beforeLeave.current = onLeave;
  useEffect(() => {
    if (!inRoom) return;
    function request(after?: () => void) {
      next.current = after;
      setOpen(true);
    }
    if (handler) handler.current = request;
    const redirect = (event: Event) => {
      const action = (event as CustomEvent<() => void>).detail;
      event.preventDefault();
      request(action);
    };
    const leavePage = (event: BeforeUnloadEvent) => {
      if (!live || allowBack.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const current = window.location.href;
    const state = window.history.state;
    const pop = (event: PopStateEvent) => {
      if (!live || window.location.href === current || allowBack.current) return;
      const target = window.location.href;
      const before = new URL(current);
      const after = new URL(target);
      const sameGame = before.pathname === after.pathname &&
        before.searchParams.get('activity') === after.searchParams.get('activity') &&
        before.searchParams.get('table_room') === after.searchParams.get('table_room') &&
        before.searchParams.get('landlord_room') === after.searchParams.get('landlord_room');
      if (sameGame) return;
      event.stopImmediatePropagation();
      const backward = (event.state?.idx ?? 0) < (state?.idx ?? 0);
      if (backward) window.history.pushState(state,'',current);
      else window.history.replaceState(state,'',current);
      request(() => {
        if (backward) {window.history.back(); return;}
        window.history.replaceState(event.state,'',target);
        window.dispatchEvent(new PopStateEvent('popstate',{state:event.state}));
      });
    };
    window.addEventListener(GAME_NAVIGATION_EVENT,redirect);
    window.addEventListener('beforeunload',leavePage);
    const releaseHistory = guardGameHistory(pop);
    return () => {
      if (handler?.current === request) handler.current = undefined;
      window.removeEventListener(GAME_NAVIGATION_EVENT,redirect);
      window.removeEventListener('beforeunload',leavePage);
      releaseHistory();
    };
  }, [inRoom,live,location.key,handler]);

  return {
    open,
    request: () => {next.current = undefined; setOpen(true);},
    close: () => setOpen(false),
    confirm: async () => {
      if (!await beforeLeave.current()) return;
      setOpen(false);
      if (!next.current) return;
      allowBack.current = true;
      next.current();
      next.current = undefined;
    },
  };
}

export function GameExitDialog({exit, live, busy}: {exit: ReturnType<typeof useGameExit>; live: boolean; busy: boolean}) {
  const {t} = useI18n();
  return <ConfirmDialog open={exit.open} className="game-table-panel" title={t(live ? 'game.forfeit' : 'landlord.leave')}
    description={t(live ? 'game.forfeitConfirm' : 'game.leaveRoomConfirm')} cancelLabel={t('game.stay')}
    confirmLabel={t(live ? 'game.forfeit' : 'landlord.leave')} danger={live} busy={busy} onClose={exit.close}
    onConfirm={() => void exit.confirm()} />;
}

export function GameSeatClock({seconds}: {seconds: number | null}) {
  const {t} = useI18n();
  if (seconds === null) return null;
  return <time className={`game-seat-clock${seconds <= 5 ? ' is-urgent' : ''}`}
    aria-label={t('landlord.seconds', {count:seconds})}>{seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}` : seconds}</time>;
}

type Game = 'landlord' | 'shuangkou' | 'mahjong' | 'duel';
type Cue = 'bid' | 'double' | 'play' | 'discard' | 'claim' | 'guess' | 'secret';
const assetRoot = '/activity/game-audio';
const enabled = (key: string) => {try {return localStorage.getItem(`frienden.games.${key}`) !== 'off';} catch {return true;}};

export function GameTableTools({game, active, cue, token, quickVoice, children}: {
  game: Game; active: boolean; cue: Cue | null; token?: string | number;
  quickVoice: ReturnType<typeof useGameQuickVoice>; children: ReactNode;
}) {
  const {t,language} = useI18n();
  const [music,setMusic] = useState(() => enabled('music'));
  const [voice,setVoice] = useState(() => enabled('voice'));
  const background = useRef<HTMLAudioElement>();
  const prompt = useRef<HTMLAudioElement>();
  const last = useRef('');
  const cueKey = active && cue ? `${token}:${cue}` : '';
  const voiceLanguage = language.startsWith('zh') ? 'zh' : 'en';
  const src = cue ? `${assetRoot}/${voiceLanguage}-${cue}.m4a` : null;
  const interruptQuickVoice = useRoomVoicePlayback(quickVoice.room, voice && quickVoice.enabled, voiceLanguage,
    quickVoice.messages, prompt);
  const interrupt = useRef(interruptQuickVoice);
  interrupt.current = interruptQuickVoice;

  useEffect(() => {
    if (!active || !music) return;
    const audio = new Audio(`${assetRoot}/${game}.m4a`);
    background.current = audio;
    audio.loop = true;
    audio.volume = .23;
    const resume = () => {
      if (document.hidden) audio.pause();
      else void audio.play().catch(() => undefined);
    };
    resume();
    window.addEventListener('pointerdown',resume,true);
    window.addEventListener('keydown',resume,true);
    document.addEventListener('visibilitychange',resume);
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      window.removeEventListener('pointerdown',resume,true);
      window.removeEventListener('keydown',resume,true);
      document.removeEventListener('visibilitychange',resume);
      background.current = undefined;
    };
  }, [active,game,music]);

  useEffect(() => {
    if (!voice || !cueKey || !src || last.current === cueKey) return;
    const audio = new Audio(src);
    prompt.current = audio;
    audio.volume = .83;
    let alive = true;
    let starting = false;
    const play = () => {
      if (document.hidden) {audio.pause(); return;}
      if (starting || last.current === cueKey) return;
      starting = true;
      void audio.play().then(() => {
        if (!alive) return;
        interrupt.current();
        last.current = cueKey;
      })
        .catch(() => undefined).finally(() => {starting = false;});
    };
    play();
    window.addEventListener('pointerdown',play,true);
    window.addEventListener('keydown',play,true);
    document.addEventListener('visibilitychange',play);
    return () => {
      alive = false;
      window.removeEventListener('pointerdown',play,true);
      window.removeEventListener('keydown',play,true);
      document.removeEventListener('visibilitychange',play);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      prompt.current = undefined;
    };
  }, [cueKey,src,voice]);

  function toggle(key: 'music' | 'voice', value: boolean) {
    try {localStorage.setItem(`frienden.games.${key}`,value ? 'on' : 'off');} catch { /* device storage unavailable */ }
    if (key === 'music') {
      if (!value) background.current?.pause();
      setMusic(value);
    } else {
      if (!value) prompt.current?.pause();
      setVoice(value);
    }
  }
  return <span className="game-table-tools">
    <button type="button" aria-label={t('game.music')} title={t('game.music')} aria-pressed={music} onClick={() => toggle('music',!music)}>
      <span className="material-symbols-outlined" aria-hidden="true">{music ? 'music_note' : 'music_off'}</span>
    </button>
    <button type="button" aria-label={t('game.voice')} title={t('game.voice')} aria-pressed={voice} onClick={() => toggle('voice',!voice)}>
      <span className="material-symbols-outlined" aria-hidden="true">{voice ? 'volume_up' : 'volume_off'}</span>
    </button>
    {children}
  </span>;
}
