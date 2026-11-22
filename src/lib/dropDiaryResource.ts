import {useEffect, useRef, useState} from 'react';
import {api} from './api';
import {useAuth} from './auth';
import {remainingShareSeconds, type DropDiaryPreview} from './dropDiary';
import {ShareResourceCache} from './shareResourceCache';

const REVALIDATE_MS = 60_000;
type DiaryRead = {key: string; data: DropDiaryPreview; deadline: number; refreshAt: number};
const previews = new ShareResourceCache<DiaryRead>();

async function readDiary(url: string, scope: string, key: string, detail: boolean, controller: AbortController) {
  const started = performance.now();
  const timeout = setTimeout(() => controller.abort('timeout'), 12_000);
  try {
    const data = await (detail ? api.dropDiaryDetails : api.dropDiaryPreview)(url, controller.signal, scope);
    if (data.status !== 'ready') {
      return {key, data, deadline: 0, refreshAt: started + REVALIDATE_MS};
    }
    if (!Number.isFinite(data.remaining_seconds) || !data.expires_at) throw new Error('Missing share expiry');
    const deadline = started + data.remaining_seconds! * 1000;
    if (deadline <= performance.now()) {
      return {key, data: {status: 'gone'} as const, deadline: 0, refreshAt: started + REVALIDATE_MS};
    }
    return {key, data, deadline, refreshAt: Math.min(deadline, started + REVALIDATE_MS)};
  } finally {
    clearTimeout(timeout);
  }
}

export function useDropDiary(url: string, enabled: boolean, detail = false) {
  const {session} = useAuth();
  const scope = session ? `${session.user.space_id}:${session.user.user_id}` : '';
  const key = scope && url ? `${scope}|${url}` : '';
  const [read, setRead] = useState<DiaryRead | undefined>(() => !detail && key ? previews.get(key) : undefined);
  const [revision, setRevision] = useState(0);
  const [, tick] = useState(0);
  const forceRefresh = useRef(false);

  useEffect(() => {
    if (!enabled || !key) return;
    let active = true, ended = false, generation = 0;
    let request: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    let lastDeadline = 0;

    async function load(refresh = false) {
      if (ended || document.visibilityState === 'hidden') return;
      if (lastDeadline && lastDeadline <= performance.now()) {
        ended = true;
        generation++;
        setRead({key, data: {status: 'gone'}, deadline: 0, refreshAt: 0});
        return;
      }
      clearTimeout(timer);
      const version = ++generation;
      request?.abort();
      try {
        let result: DiaryRead;
        if (detail) {
          request = new AbortController();
          result = await readDiary(url, scope, key, true, request);
        } else {
          result = await previews.load(key, async () => {
            const value = await readDiary(url, scope, key, false, new AbortController());
            return {value, validUntil: value.data.status === 'error' ? 0 : value.refreshAt};
          }, refresh);
        }
        if (!active || version !== generation) return;
        lastDeadline = result.deadline;
        ended = result.data.status === 'gone';
        setRead(result);
        if (detail && ended) previews.invalidate(key);
        if (!ended) {
          timer = setTimeout(() => void load(true), Math.max(0, result.refreshAt - performance.now()));
        }
      } catch {
        if (!active || version !== generation) return;
        setRead({key, data: {status: 'error'}, deadline: 0, refreshAt: 0});
        timer = setTimeout(() => void load(true), REVALIDATE_MS);
      }
    }

    void load(forceRefresh.current);
    forceRefresh.current = false;
    const onFocus = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false;
      request?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [url, scope, key, enabled, detail, revision]);

  const current = read?.key === key ? read : undefined;
  useEffect(() => {
    if (!enabled || current?.data.status !== 'ready') return;
    const {deadline} = current;
    const timer = setInterval(() => {
      if (performance.now() >= deadline) {
        setRead(value => value?.key === key && value.deadline === deadline
          ? {key, data: {status: 'gone'}, deadline: 0, refreshAt: 0}
          : value);
      } else tick(value => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled, key, current?.data.status, current?.deadline]);

  const remaining = remainingShareSeconds(current?.deadline ?? 0, performance.now());
  const expired = current?.data.status === 'gone' || current?.data.status === 'ready' && remaining <= 0;
  return {
    data: current?.data ?? null, remaining, expired, ready: current?.data.status === 'ready' && !expired,
    refresh: () => {forceRefresh.current = true; setRevision(value => value + 1);},
    isAlive: () => current?.data.status === 'ready' && performance.now() < current.deadline,
  };
}
