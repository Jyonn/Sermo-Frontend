import {useEffect, useId, useRef, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {api, ApiError} from '../lib/api';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useI18n} from '../lib/language';
import {messageMediaAspect} from '../lib/messageMedia';
import {useModalFocus} from '../lib/modalFocus';
import {showToast} from '../lib/toast';
import type {ChatMessagePayloadDTO} from '../types';
import './FlashImageMessage.css';

const VIEW_MS = 3000;

export function FlashImageMessage({id, payload, sent, groupClassName}: {
  id: number; payload?: ChatMessagePayloadDTO | null; sent: boolean; groupClassName: string;
}) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [aspect, setAspect] = useState<number>();
  const [uri, setUri] = useState('');
  const [remaining, setRemaining] = useState(3);
  const expiresAt = (payload?.flash_expires_at ?? 0) * 1000;
  const [expired, setExpired] = useState(() => expiresAt <= Date.now());
  const url = useRef('');
  const request = useRef<AbortController>();
  const dialog = useRef<HTMLElement>(null);
  const title = useId();
  const deadline = useRef(0);
  const hasViewed = viewed || payload?.flash_viewed;
  const canOpen = payload?.flash_available === true && !unavailable && (sent || !hasViewed && !expired);
  const thumbnail = (canOpen || sent) && payload?.flash_thumbnail?.match(/^[A-Za-z0-9+/=]{1,1500}$/) ? payload.flash_thumbnail : '';
  const total = payload?.flash_recipient_count ?? 0;
  const count = payload?.flash_viewed_count ?? 0;
  const status = sent && total > 1 ? t('photo.flashViewedCount', {count, total})
    : sent && total === 1 ? t(count ? 'photo.flashRecipientViewed' : 'photo.flashRecipientPending')
    : hasViewed ? t('photo.flashViewed') : t(canOpen ? 'photo.flashOpen' : 'photo.flashExpired');

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
    if (sent) return;
    const remaining = expiresAt - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt, sent]);

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
      const blob = await api.revealFlashImage(id, controller.signal, payload?.flash_position);
      if (controller.signal.aborted) return;
      if (!sent) setViewed(true);
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
      if (error instanceof ApiError && error.status === 410) setUnavailable(true);
      close();
      showToast(error instanceof ApiError && error.status === 410 ? t('photo.flashExpired') : t('photo.flashFailed'), 'info');
    }
  };

  return <>
    <button type="button" className={`message-media-frame image-button has-intrinsic-size flash-image-message ${groupClassName}`}
      style={{'--message-media-aspect': aspect ?? 1.5} as CSSProperties} aria-disabled={!canOpen}
      onClick={event => {event.stopPropagation(); void reveal();}}>
      {thumbnail && <img src={`data:image/jpeg;base64,${thumbnail}`} alt="" draggable={false}
        onLoad={({currentTarget}) => setAspect(messageMediaAspect(currentTarget.naturalWidth, currentTarget.naturalHeight))}/>}
      <span className="flash-image-label">
        <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
        <strong>{t('photo.flash')}</strong>
        <small>{status}</small>
      </span>
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
