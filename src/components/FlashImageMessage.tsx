import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react';
import {api, ApiError} from '../lib/api';
import {useI18n} from '../lib/language';
import {messageMediaAspect} from '../lib/messageMedia';
import {showToast} from '../lib/toast';
import type {ChatMessagePayloadDTO} from '../types';
import {MediaLightbox} from './ImageLightbox';
import './FlashImageMessage.css';

const VIEW_MS = 3000;
const VIEW_SECONDS = VIEW_MS / 1000;
const keepImageIndex = () => {};

export function FlashImageMessage({id, payload, sent, groupClassName, auditPreview = false}: {
  id: number; payload?: ChatMessagePayloadDTO | null; sent: boolean; groupClassName: string; auditPreview?: boolean;
}) {
  const {locale, t} = useI18n();
  const [open, setOpen] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [aspect, setAspect] = useState<number>();
  const [uri, setUri] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(VIEW_SECONDS);
  const expiresAt = (payload?.flash_expires_at ?? 0) * 1000;
  const [expired, setExpired] = useState(() => expiresAt <= Date.now());
  const url = useRef('');
  const request = useRef<AbortController>();
  const hasViewed = viewed || payload?.flash_viewed;
  const canOpen = !auditPreview && payload?.flash_available === true && !unavailable && (sent || !hasViewed && !expired);
  const thumbnail = (auditPreview || canOpen || sent) && payload?.flash_thumbnail?.match(/^[A-Za-z0-9+/=]{1,1500}$/) ? payload.flash_thumbnail : '';
  const total = payload?.flash_recipient_count ?? 0;
  const count = payload?.flash_viewed_count ?? 0;
  const status = auditPreview ? t(payload?.flash_audit_available ? 'management.inspectFlashHint' : 'photo.flashExpired')
    : sent && total > 1 ? t('photo.flashViewedCount', {count, total})
    : sent && total === 1 ? t(count ? 'photo.flashRecipientViewed' : 'photo.flashRecipientPending')
    : hasViewed ? t('photo.flashViewed') : t(canOpen ? 'photo.flashOpen' : 'photo.flashExpired');

  const close = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    setDeadline(0);
    setUri('');
    setOpen(false);
  }, []);

  const startCountdown = useCallback(() => {
    if (document.hidden) {
      close();
      return;
    }
    const end = performance.now() + VIEW_MS;
    setDeadline(current => current || end);
  }, [close]);

  const handleImageError = useCallback(() => {
    close();
    showToast(t('photo.flashFailed'), 'info');
  }, [close, t]);

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
  }, [close, open]);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = deadline - performance.now();
      if (ms <= 0) close();
      else setRemaining(Math.ceil(ms / 1000));
    };
    const stop = window.setTimeout(close, Math.max(0, deadline - performance.now()));
    const interval = window.setInterval(tick, 100);
    return () => {clearTimeout(stop); clearInterval(interval);};
  }, [close, deadline]);

  const reveal = async () => {
    if (!canOpen || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setRemaining(VIEW_SECONDS);
    try {
      const blob = await api.revealFlashImage(id, controller.signal, payload?.flash_position);
      if (controller.signal.aborted) return;
      if (!sent) setViewed(true);
      if (document.hidden) {
        close();
        return;
      }
      url.current = URL.createObjectURL(blob);
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
      tabIndex={auditPreview ? -1 : undefined}
      onClick={event => {event.stopPropagation(); void reveal();}}>
      {thumbnail && <img src={`data:image/jpeg;base64,${thumbnail}`} alt="" draggable={false}
        onLoad={({currentTarget}) => setAspect(messageMediaAspect(currentTarget.naturalWidth, currentTarget.naturalHeight))}/>}
      <span className="flash-image-label">
        <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
        <strong>{t('photo.flash')}</strong>
        <small>{status}</small>
      </span>
    </button>
    {open && <MediaLightbox
      altPrefix={t('photo.flash')}
      index={0}
      items={[{id, kind: 'image', uri}]}
      onIndexChange={keepImageIndex}
      onClose={close}
      fixedFitImage={{
        onReady: startCountdown,
        onError: handleImageError,
        overlay: deadline ? <div className="flash-view-timer" role="timer"
          aria-label={new Intl.NumberFormat(locale, {style: 'unit', unit: 'second', unitDisplay: 'long'}).format(remaining)}
          style={{'--flash-view-duration': `${VIEW_MS}ms`} as CSSProperties}>
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="17" />
            <circle className="flash-view-timer-arc" cx="20" cy="20" r="17" pathLength="100" />
          </svg>
          <span aria-hidden="true">{remaining}</span>
        </div> : null,
      }}
    />}
  </>;
}
