import {useEffect, useRef} from 'react';
import type {RoomMessage} from './useGameQuickVoice';

const NO_MESSAGES: RoomMessage[] = [];

export function useRoomVoicePlayback(room: string, enabled: boolean, language: 'zh' | 'en',
  messages = NO_MESSAGES, prompt: Readonly<{current?: HTMLAudioElement}>) {
  const audio = useRef<AudioContext>();
  const source = useRef<AudioBufferSourceNode>();
  const cursor = useRef(0);
  const queue = useRef<RoomMessage[]>([]);
  const start = useRef<() => void>();

  useEffect(() => {cursor.current = 0;}, [room]);

  useEffect(() => {
    if (!room || !enabled) return;
    const controller = new AbortController();
    let wake: number | undefined;
    let busy = false;
    const decoded = new Map<string, AudioBuffer>();
    function unlock() {
      const Context = window.AudioContext || (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Context || document.hidden) return;
      audio.current ??= new Context();
      if (audio.current.state !== 'running') void audio.current.resume().catch(() => undefined);
    }
    async function play() {
      if (busy || document.hidden || controller.signal.aborted) return;
      const context = audio.current;
      if (!context || context.state !== 'running') {
        queue.current = [];
        return;
      }
      queue.current = queue.current.filter(message => message.expires > performance.now());
      if (!queue.current.length) return;
      if (prompt.current && !prompt.current.paused) {
        window.clearTimeout(wake);
        wake = window.setTimeout(play, 180);
        return;
      }
      const message = queue.current.shift()!;
      const url = `/activity/game-audio/quick-voice/${language}-${message.phrase}.m4a`;
      busy = true;
      try {
        let buffer = decoded.get(url);
        if (!buffer) {
          const response = await fetch(url, {signal: controller.signal});
          if (!response.ok) throw new Error('Room voice unavailable');
          buffer = await context.decodeAudioData(await response.arrayBuffer());
          decoded.set(url, buffer);
        }
        if (controller.signal.aborted || document.hidden || message.expires <= performance.now()) return;
        if (prompt.current && !prompt.current.paused) {
          queue.current.unshift(message);
          return;
        }
        const clip = context.createBufferSource();
        const volume = context.createGain();
        volume.gain.value = .72;
        clip.buffer = buffer;
        clip.connect(volume).connect(context.destination);
        source.current = clip;
        await new Promise<void>(resolve => {
          clip.onended = () => {
            clip.disconnect();
            volume.disconnect();
            if (source.current === clip) source.current = undefined;
            resolve();
          };
          clip.start();
        });
      } catch { /* A failed sound still has an on-screen caption. */ }
      finally {
        busy = false;
        if (queue.current.length && !controller.signal.aborted) void play();
      }
    }
    const hide = () => {
      if (!document.hidden) return;
      queue.current = [];
      source.current?.stop();
      source.current = undefined;
    };
    if (navigator.userActivation?.hasBeenActive) unlock();
    start.current = play;
    window.addEventListener('pointerup', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', hide);
    return () => {
      controller.abort();
      window.clearTimeout(wake);
      hide();
      queue.current = [];
      source.current?.stop();
      source.current = undefined;
      start.current = undefined;
      void audio.current?.close().catch(() => undefined);
      audio.current = undefined;
      window.removeEventListener('pointerup', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [room, enabled, language, prompt]);

  useEffect(() => {
    const next = messages.filter(message => message.id > cursor.current);
    if (!next.length) return;
    cursor.current = Math.max(...next.map(message => message.id));
    if (!enabled || document.hidden) return;
    queue.current.push(...next);
    void start.current?.();
  }, [messages, enabled, room]);

  return () => {
    source.current?.stop();
    source.current = undefined;
  };
}
