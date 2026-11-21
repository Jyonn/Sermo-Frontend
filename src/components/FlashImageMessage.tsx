import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {api, ApiError} from '../lib/api';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useI18n} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import {showToast} from '../lib/toast';
import type {ChatMessagePayloadDTO} from '../types';
import './FlashImageMessage.css';

const VIEW_MS = 3000;

export function FlashImageMessage({id, payload, sent}: {id: number; payload?: ChatMessagePayloadDTO | null; sent: boolean}) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [uri, setUri] = useState('');
  const [remaining, setRemaining] = useState(3);
  const [expired, setExpired] = useState(() => (payload?.flash_expires_at ?? 0) * 1000 <= Date.now());
  const url = useRef('');
  const request = useRef<AbortController>();
  const dialog = useRef<HTMLElement>(null);
  const title = useId();
  const deadline = useRef(0);
  const canOpen = payload?.flash_available === true && !sent && !viewed && !expired;
  const thumbnail = (canOpen || sent) && !expired && payload?.flash_thumbnail?.match(/^[A-Za-z0-9+/=]{1,1500}$/) ? payload.flash_thumbnail : '';

  function close() {
    request.current?.abort();
    request.current = undefined;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    setUri('');
    setOpen(false);
  }

  useBodyScrollLock(open);
  useModalFocus(dialog, open, close);
  useEffect(() => () => {
    request.current?.abort();
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  useEffect(() => {
    if (expired || !payload?.flash_expires_at) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, payload.flash_expires_at * 1000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expired, payload?.flash_expires_at]);

  useEffect(() => {
    if (!open) return;
    const visibility = () => { if (document.hidden) close(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', close);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', close);
    };
  }, [open]);

  useEffect(() => {
    if (!uri) return;
    const tick = () => {
      const ms = deadline.current - performance.now();
      if (ms <= 0) close();
      else setRemaining(Math.ceil(ms / 1000));
    };
    const stop = window.setTimeout(close, Math.max(0, deadline.current - performance.now()));
    const interval = window.setInterval(tick, 100);
    return () => {clearTimeout(stop); clearInterval(interval);};
  }, [uri]);

  const reveal = async () => {
    if (!canOpen || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setRemaining(3);
    try {
      const blob = await api.revealFlashImage(id, controller.signal);
      if (controller.signal.aborted) return;
      setViewed(true);
      url.current = URL.createObjectURL(blob);
      const picture = new Image();
      picture.src = url.current;
      await picture.decode();
      if (controller.signal.aborted) return;
      if (document.hidden) {
        close();
        return;
      }
      deadline.current = performance.now() + VIEW_MS;
      setUri(url.current);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 410) setViewed(true);
      close();
      showToast(error instanceof ApiError && error.status === 410 ? t('photo.flashExpired') : t('photo.flashFailed'), 'info');
    }
  };

  return <>
    <button type="button" className="flash-image-message" disabled={!canOpen} onClick={event => {event.stopPropagation(); void reveal();}}>
      {thumbnail && <img src={`data:image/jpeg;base64,${thumbnail}`} alt="" draggable={false}/>}
      <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
      <strong>{t('photo.flash')}</strong>
      <small>{t(canOpen ? 'photo.flashOpen' : viewed ? 'photo.flashViewed' : sent && !expired ? 'photo.flashSent' : 'photo.flashExpired')}</small>
    </button>
    {open && createPortal(<div className="dialog-backdrop flash-view-backdrop" onClick={event => {event.stopPropagation(); close();}}>
      <section className="flash-view" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} onClick={event => event.stopPropagation()}>
        <h2 id={title} className="drawer-control-label">{t('photo.flash')}</h2>
        <button type="button" className="flash-view-close" aria-label={t('common.close')} onClick={close}><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
        {uri ? <>
          <img src={uri} alt={t('photo.flash')} draggable={false} onContextMenu={event => event.preventDefault()}/>
          <div className="flash-view-count" role="status"><span className="material-symbols-outlined" aria-hidden="true">bolt</span>{remaining}s</div>
          <div className="flash-view-progress" aria-hidden="true"/>
        </> : <p role="status">{t('common.loading')}</p>}
      </section>
    </div>, document.body)}
  </>;
}
