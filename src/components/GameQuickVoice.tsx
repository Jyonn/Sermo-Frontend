import {useEffect, useId, useRef, useState} from 'react';
import {ROOM_VOICE_COMMON, type RoomVoiceMessage, type RoomVoicePhrase} from '../lib/gameQuickVoice';
import {useI18n} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import type {useGameQuickVoice} from '../lib/useGameQuickVoice';
import './GameQuickVoice.css';

const presets = {
  hello: 'waving_hand', wait: 'hourglass_empty', good_play: 'thumb_up', close: 'bolt',
  thanks: 'favorite', next_round: 'replay', good_hand: 'style', your_call: 'psychology',
  your_turn: 'schedule', your_guess: 'schedule',
} as const;

export function GameQuickVoiceButton({game, voice}: {
  game: 'landlord' | 'shuangkou' | 'mahjong' | 'duel'; voice: ReturnType<typeof useGameQuickVoice>;
}) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const id = useId();
  const tablePhrases = game === 'duel' ? ['your_guess', 'your_call'] as const : ['your_turn', 'good_hand'] as const;
  const phrases = [...tablePhrases, ...ROOM_VOICE_COMMON];
  useModalFocus(panel, open, close, {manageLayer:false, autoFocus:false, restoreFocus:false});

  useEffect(() => {setOpen(false); setFailed(false);}, [voice.room, voice.enabled]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    (first.current?.disabled ? panel.current?.querySelector('button') : first.current)?.focus({preventScroll:true});
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    toggle.current?.focus({preventScroll:true});
  }
  async function send(phrase: RoomVoicePhrase) {
    setFailed(false);
    try {
      if (await voice.send(phrase)) close();
    } catch {
      setFailed(true);
    }
  }

  if (!voice.enabled) return null;
  return <div className="game-quick-voice" ref={anchor}>
    <button ref={toggle} type="button" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-label={t('game.quickVoice.title')} title={t('game.quickVoice.title')}
      onClick={() => {setOpen(value => !value); setFailed(false);}}>
      <span className="material-symbols-outlined" aria-hidden="true">voice_chat</span>
    </button>
    {open && <div ref={panel} id={id} role="group" aria-labelledby={`${id}-title`} className="game-quick-voice-picker">
      <header><strong id={`${id}-title`}>{t('game.quickVoice.title')}</strong>
        <button type="button" className="game-quick-voice-close" aria-label={t('common.close')} onClick={close}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div className="game-quick-voice-presets">
        {phrases.map((phrase, index) => <button key={phrase} ref={index === 0 ? first : undefined} type="button"
          disabled={voice.sending || voice.cooling} onClick={() => void send(phrase)}>
          <span className="material-symbols-outlined" aria-hidden="true">{presets[phrase]}</span>
          {t(`game.quickVoice.${phrase}`)}
        </button>)}
      </div>
      {(failed || voice.cooling) && <p className="game-quick-voice-feedback" role="status">
        {t(failed ? 'game.quickVoice.failed' : 'game.quickVoice.cooldown')}
      </p>}
    </div>}
  </div>;
}

export function GameQuickVoiceCaption({message}: {message?: RoomVoiceMessage}) {
  const {t} = useI18n();
  if (!message) return null;
  return <span key={message.id} className="game-quick-voice-caption" role="status">
    <span className="material-symbols-outlined" aria-hidden="true">graphic_eq</span>{t(`game.quickVoice.${message.phrase}`)}
  </span>;
}
