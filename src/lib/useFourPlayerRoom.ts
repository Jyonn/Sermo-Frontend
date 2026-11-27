import {useEffect, useRef, useState} from 'react';
import {api, ApiError} from './api';
import {LANDLORD_ROOM_CODE} from './landlord';
import {useI18n, type TranslationKey} from './language';
import {showToast} from './toast';
import type {FourPlayerAction, FourPlayerLobby, FourPlayerTable, GameMove} from './tabletop';

const errors: Record<string, TranslationKey> = {
  ACCOUNT:'landlord.verifiedOnly', TABLE:'landlord.tableUnavailable', BUSY:'landlord.alreadySeated',
  TURN:'landlord.waitTurn', CARDS:'tabletop.illegalMove', INVALID:'landlord.actionFailed', CLOSED:'landlord.closed',
};

export function useFourPlayerRoom(key: string, enabled: boolean, invitation: string | null) {
  const {t} = useI18n();
  const [lobby, setLobby] = useState<FourPlayerLobby>();
  const [table, setTable] = useState<FourPlayerTable | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  const current = useRef<FourPlayerTable | null>(null);
  const operation = useRef<AbortController>();
  const poll = useRef<AbortController>();
  const joined = useRef<string | null>(null);

  function receive(next: FourPlayerTable | null) {
    current.current = next;
    if (next) {
      const time = Date.now();
      setNow(time);
      setOffset(next.server_now - time / 1000);
    }
    setTable(next);
  }

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: number;
    async function refresh() {
      window.clearTimeout(timer);
      if (!active) return;
      if (!document.hidden && !poll.current && !operation.current) {
        const request = new AbortController();
        poll.current = request;
        try {
          const next = await api.getFourPlayerLobby(key, current.current?.code, request.signal);
          if (!request.signal.aborted) {
            receive(next.table);
            setLobby(next);
            setFailed(false);
          }
        } catch {
          if (!request.signal.aborted) setFailed(true);
        } finally {
          if (poll.current === request) poll.current = undefined;
        }
      }
      if (active) timer = window.setTimeout(refresh, current.current?.status === 'playing' ? 900 : current.current ? 1700 : 4600);
    }
    void refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearTimeout(timer);
      poll.current?.abort();
      poll.current = undefined;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [key, enabled, revision]);

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (!table?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [table?.deadline]);

  async function perform(action: FourPlayerAction) {
    if (!enabled || operation.current) return false;
    poll.current?.abort();
    const request = new AbortController();
    operation.current = request;
    setBusy(true);
    try {
      const result = await api.fourPlayerAction(key, action, request.signal);
      if (request.signal.aborted) return false;
      receive(result.table);
      setFailed(false);
      if (result.changed) showToast(t('landlord.tableUpdated'), 'info');
      if (!result.table) retry();
      return !result.changed;
    } catch (cause) {
      if (!request.signal.aborted) {
        const identifier = cause instanceof ApiError ? cause.identifier.split('@').pop() ?? '' : '';
        showToast(t(errors[identifier] ?? 'landlord.actionFailed'), 'error');
      }
      return false;
    } finally {
      if (operation.current === request) {
        operation.current = undefined;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (!invitation) joined.current = null;
    if (!enabled || !invitation || !LANDLORD_ROOM_CODE.test(invitation) || joined.current === invitation || busy) return;
    const timer = window.setTimeout(() => {
      joined.current = invitation;
      void perform({action:'join', code:invitation});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, enabled, invitation, busy]);

  const retry = () => setRevision(value => value + 1);
  const closeExpired = () => {receive(null); retry();};
  const move = (action: GameMove) => {
    if (table) return perform({...action, code:table.code, version:table.version, round:table.round, mode:table.mode});
  };
  const seconds = table?.deadline ? Math.max(0, Math.ceil(table.deadline - now / 1000 - offset)) : 0;

  return {lobby, table, failed, busy, seconds, closeExpired, move, perform, retry};
}
