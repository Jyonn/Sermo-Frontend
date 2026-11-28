import {useCallback, useEffect, useRef, useState} from 'react';
import {api, ApiError} from './api';
import {ROOM_VOICE_PHRASES, type RoomVoiceMessage, type RoomVoicePhrase, type RoomVoiceSnapshot} from './gameQuickVoice';

const LIFETIME_MS = 8000;
const COOLDOWN_MS = 3000;
export type RoomMessage = RoomVoiceMessage & {expires: number};
type RoomState = {room: string; now: number; cursor: number; messages: RoomMessage[]};

export function useGameQuickVoice(activity: string, code: string | undefined, snapshot: RoomVoiceSnapshot | undefined) {
  const room = code ? `${activity}:${code}` : '';
  const state = useRef<RoomState>();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [cooling, setCooling] = useState(false);
  const [sending, setSending] = useState(false);
  const cooldown = useRef<number>();
  const request = useRef<AbortController>();

  const receive = useCallback((data?: RoomVoiceSnapshot) => {
    if (!room || !data) {
      state.current = undefined;
      setMessages(current => current.length ? [] : current);
      return;
    }
    const last = state.current?.room === room ? state.current : undefined;
    const cursor = Math.max(last?.cursor ?? 0, ...data.messages.map(message => message.id));
    if (last && data.now <= last.now && (!data.enabled || cursor === last.cursor)) return;
    state.current = {room, now: Math.max(data.now, last?.now ?? 0), cursor, messages: []};
    if (!data.enabled || !last || document.hidden) {
      setMessages(current => current.length ? [] : current);
      return;
    }
    const now = performance.now();
    const fresh = data.messages.filter(message => message.id > last.cursor && ROOM_VOICE_PHRASES.includes(message.phrase))
      .map(message => ({...message, expires: now + Math.min(LIFETIME_MS, LIFETIME_MS + (message.sent_at - data.now) * 1000)}));
    const next = [...last.messages, ...fresh].filter(message => message.expires > now);
    state.current.messages = next;
    setMessages(next);
  }, [room]);

  useEffect(() => {
    setCooling(false);
    setSending(false);
    const hide = () => {if (document.hidden) receive();};
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      request.current?.abort();
      request.current = undefined;
      window.clearTimeout(cooldown.current);
    };
  }, [receive]);
  useEffect(() => receive(snapshot), [receive, snapshot]);

  useEffect(() => {
    if (!messages.length) return;
    const expires = Math.min(...messages.map(message => message.expires));
    const timer = window.setTimeout(() => setMessages(current => current.filter(message => message.expires > performance.now())),
      Math.max(1, Math.ceil(expires - performance.now())));
    return () => window.clearTimeout(timer);
  }, [messages]);

  function startCooldown() {
    setCooling(true);
    window.clearTimeout(cooldown.current);
    cooldown.current = window.setTimeout(() => setCooling(false), COOLDOWN_MS);
  }

  async function send(phrase: RoomVoicePhrase) {
    if (!code || !snapshot?.enabled || cooling || request.current) return false;
    const controller = new AbortController();
    request.current = controller;
    setSending(true);
    try {
      const result = await api.sendGameQuickVoice(activity, code, phrase, controller.signal);
      if (controller.signal.aborted) return false;
      receive(result);
      startCooldown();
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      if (error instanceof ApiError && error.identifier.split(/[@.]/).pop() === 'COOLDOWN') {
        startCooldown();
        return false;
      }
      throw error;
    } finally {
      if (request.current === controller) {
        request.current = undefined;
        setSending(false);
      }
    }
  }

  const current = snapshot?.enabled && state.current?.room === room ? messages : [];
  return {room, enabled: Boolean(snapshot?.enabled), messages: current, sending, cooling, send,
    messageFor: (userId: number | undefined) => {
      for (let index = current.length - 1; index >= 0; index--) {
        if (current[index].user_id === userId) return current[index];
      }
      return undefined;
    }};
}
