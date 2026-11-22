import {useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import {useAuth} from '../lib/auth';
import {api} from '../lib/api';
import {showToast} from '../lib/toast';
import {claimMediaPlayback, releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {useMediaSource} from '../lib/useMediaSource';
import {mediaSourceCandidates} from '../lib/messageMedia';
import {resolveStableResourceUri} from '../lib/stableResource';
import {mediaInfoProgress, shouldCompleteSwipe, type MediaSize} from '../lib/mediaDrawerGeometry';
import {downloadMedia, mediaFile, saveMediaFile} from '../lib/downloadMedia';
import {copyText} from '../lib/presentation';
import type {ImageMetadataDTO, TinyUserDTO} from '../types';
import {FloatingDrawerScope} from './DesktopPanelWorkspace';
import {MediaMetadataPanel} from './MediaMetadataPanel';
import {MediaWaitFeedback} from './MediaWaitFeedback';
import {DrawerDismissButton, OverlayIconButton} from './OverlayIconButton';
import {SideDrawer} from './SideDrawer';
import {UserAvatar} from './UserAvatar';
import {MediaDrawerFilm} from './MediaDrawerFilm';
import {MediaDrawerSlide} from './MediaDrawerSlide';
import {MediaShareMenu} from './MediaShareMenu';
import {ChatSharePicker} from './ChatSharePicker';
import {useMediaDrawerCarousel} from './useMediaDrawerCarousel';
import {isDesktopMediaPreview, useMediaDrawerGestures} from './useMediaDrawerGestures';
import './MediaDrawer.css';

export interface MediaLightboxItem {
  id?: number | string;
  uri: string;
  kind: 'image' | 'video';
  posterUri?: string | null;
  thumbnailUri?: string | null;
  width?: number | null;
  height?: number | null;
  detail?: ReactNode;
  imageMetadata?: ImageMetadataDTO | null;
  owner?: TinyUserDTO | null;
  createdAt?: number;
  downloadLabel?: string;
  referrerPolicy?: 'no-referrer';
  loop?: boolean;
  autoPlay?: boolean;
  deferPlayback?: boolean;
  onPlayRequest?: () => void;
  onPlaybackError?: () => void;
}

interface MediaDrawerEditor {
  adjusting: boolean;
  busy?: boolean;
  sendDisabled?: boolean;
  submitLabel?: string;
  onSend: () => void;
  createShareFile?: () => Promise<File>;
  adjustDisabled?: boolean;
  onAdjust: () => void;
  onDone: () => void;
  onCancel: () => void;
  info: (index: number) => ReactNode;
  stage?: ReactNode;
  tools?: ReactNode;
  headerActions?: ReactNode;
  notice?: ReactNode;
}

export interface MediaLightboxProps {
  initialInfo?: boolean;
  fixedFitImage?: {overlay?: ReactNode; onReady: () => void; onError: () => void};
  index: number;
  items: MediaLightboxItem[];
  altPrefix?: string;
  sharedDetail?: ReactNode;
  source?: {name: string; logo?: string; url?: string; author?: string};
  fileNamePrefix?: string;
  historyKey?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  totalCount?: number;
  onApproachingEnd?: () => void;
  onJumpToMessage?: () => void;
  onForward?: () => void;
  forwardLink?: string;
  onApproachingStart?: () => void;
  onBoundary?: (direction: 'older' | 'newer') => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  loading?: boolean;
  navigationLabel?: string;
  editor?: MediaDrawerEditor;
}

const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
const mediaKey = (item: MediaLightboxItem, index: number) => String(item.id ?? `${index}:${item.uri}`);
const closedVideo = {current: 0, duration: 0, playing: false, muted: false};
const timeCode = (time: number) => {
  const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export function MediaDrawer(props: MediaLightboxProps) {
  const index = Math.min(props.items.length - 1, Math.max(0, props.index));
  const item = props.items[index];
  return item ? <MediaDrawerContent {...props} index={index} item={item}/> : null;
}

function MediaDrawerContent({
  item, index, items, altPrefix, editor, fixedFitImage, initialInfo, source: platform, sharedDetail,
  onClose, onIndexChange, onApproachingEnd, onApproachingStart, onJumpToMessage, onForward, forwardLink, onBoundary,
  hasNext, hasPrevious, loading, totalCount, navigationLabel, fileNamePrefix = 'frienden', historyKey,
}: MediaLightboxProps & {item: MediaLightboxItem}) {
  const {locale, t} = useI18n();
  const {session} = useAuth();
  const [mode, setMode] = useState<'default' | 'immersive'>('default');
  const [info, setInfo] = useState(initialInfo || !item.uri && item.kind === 'image' && Boolean(sharedDetail));
  const [infoHeight, setInfoHeight] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [linkToForward, setLinkToForward] = useState('');
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [sizes, setSizes] = useState<Record<string, MediaSize>>({});
  const [playback, setPlayback] = useState(closedVideo);
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const dismissTimer = useRef<number>();
  const closeRequestRef = useRef<(() => void) | null>(null);
  const filePosition = useRef({time: 0, playing: false});
  const videoIdentity = useRef<string>();
  const attemptedVideo = useRef(false);
  const reportedVideoFailure = useRef(false);
  const flashReady = useRef(false);
  const callback = useRef({onApproachingStart, onApproachingEnd});
  callback.current = {onApproachingStart, onApproachingEnd};
  const identity = mediaKey(item, index);
  const videoItem = item.kind === 'video';
  const adjusting = editor?.adjusting === true;
  const immersive = mode === 'immersive' && !adjusting && !fixedFitImage;
  const interactionDisabled = adjusting || leaving || Boolean(fixedFitImage || editor?.busy);
  const statusText = videoItem ? t('media.video') : t('media.imagePreview');
  const title = altPrefix || statusText;
  const hasInfo = Boolean(editor || initialInfo || item.imageMetadata?.status === 1 || item.detail || sharedDetail || platform?.url);
  const canShowInfo = hasInfo && !adjusting && !fixedFitImage;
  const infoOpen = Boolean(info && !adjusting && !fixedFitImage && !immersive);
  const canBrowse = items.length > 1 || Boolean(hasPrevious || hasNext);
  const canGoBack = index > 0 || Boolean(hasPrevious && !loading);
  const canGoForward = index < items.length - 1 || Boolean(hasNext && !loading);
  const media = useMediaSource(fixedFitImage || editor ? '' : item.uri, undefined, item.kind);
  const src = fixedFitImage || editor ? item.uri : media.src;
  const sourceLink = forwardLink ?? platform?.url;
  const forward = onForward ?? (session && sourceLink && /^https?:\/\//i.test(sourceLink)
    ? () => setLinkToForward(sourceLink) : undefined);
  const carousel = useMediaDrawerCarousel({index, identity, count: items.length, onIndexChange});
  const cursor = index + carousel.offset;
  const first = Math.max(0, Math.floor(cursor) - 1);
  const last = Math.min(items.length - 1, Math.ceil(cursor) + 1);
  const activeInWindow = index >= first && index <= last;
  const sizeKey = (entry: MediaLightboxItem, position: number) => `${mediaKey(entry, position)}:${entry.uri}`;
  const sizeOf = (entry: MediaLightboxItem, position: number) => sizes[sizeKey(entry, position)]
    ?? {width: entry.width ?? 0, height: entry.height ?? 0};
  const rememberSize = (entry: MediaLightboxItem, position: number, width: number, height: number) => {
    if (!width || !height) return;
    const key = sizeKey(entry, position);
    setSizes(current => current[key]?.width === width && current[key]?.height === height ? current : {...current, [key]: {width, height}});
  };
  const go = (direction: -1 | 1) => {
    if (interactionDisabled) return;
    const next = index + direction;
    if (items[next]) carousel.settle(direction);
    else {
      carousel.settle(0);
      if (!loading && (direction < 0 ? hasPrevious : hasNext)) onBoundary?.(direction < 0 ? 'older' : 'newer');
    }
  };
  const changeMode = (next: typeof mode) => {
    setMode(next);
    if (next === 'immersive') setInfo(false);
  };
  const swipeDismiss = () => {
    if (editor || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {closeRequestRef.current?.(); return;}
    setLeaving(true);
    dismissTimer.current = window.setTimeout(() => closeRequestRef.current?.(), 210);
  };
  const gestures = useMediaDrawerGestures({
    mediaKey: identity, size: sizeOf(item, index), mode, infoOpen,
    disabled: interactionDisabled || !infoOpen && !src && !item.posterUri,
    canBrowse, desktopImageZoom: !videoItem, onBrowse: go,
    onMode: changeMode, onSwipeStart: carousel.stop,
    onSwipeMove: offset => carousel.drag(Math.min(1, Math.max(-1, offset))),
    onSwipeEnd: (distance, speed, cancelled) => {
      if (!cancelled && shouldCompleteSwipe(distance, gestures.bounds.width, speed)) go(distance < 0 ? 1 : -1);
      else carousel.settle(0);
    },
    onFreeRelease: ({y}, speed) => {
      const threshold = Math.min(190, Math.max(92, gestures.bounds.height * .3));
      if (Math.abs(y) < 24 || !shouldCompleteSwipe(y, threshold, speed)) return;
      if (y > 0) swipeDismiss();
      if (y < 0 && canShowInfo) {setMode('default'); setInfo(true);}
    },
  });

  useEffect(() => () => window.clearTimeout(dismissTimer.current), []);

  useLayoutEffect(() => {
    if (videoIdentity.current !== identity) {
      filePosition.current = {time: 0, playing: Boolean(item.autoPlay)};
      setPlayback(current => ({...closedVideo, muted: current.muted}));
      videoIdentity.current = identity;
    }
    setFailed(false);
    setWaiting(false);
    attemptedVideo.current = Boolean(item.autoPlay);
    reportedVideoFailure.current = false;
    flashReady.current = false;
    const node = image.current;
    if (node?.complete && node.naturalWidth) {
      rememberSize(item, index, node.naturalWidth, node.naturalHeight);
      if (!fixedFitImage && !editor) media.ready();
    }
    if (video.current && video.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) media.ready();
  }, [identity, src, activeInWindow, gestures.stageNode]);

  useEffect(() => {
    if (!fixedFitImage || !src || !gestures.fitted.width || flashReady.current || !image.current?.naturalWidth) return;
    flashReady.current = true;
    fixedFitImage.onReady();
  }, [fixedFitImage, gestures.fitted.width, src]);
  useEffect(() => {
    if (index < 4) callback.current.onApproachingStart?.();
    if (items.length - index < 5) callback.current.onApproachingEnd?.();
  }, [index, items.length]);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    return () => {releaseMediaPlayback(node); node.pause();};
  }, [videoItem, src, activeInWindow, gestures.stageNode]);

  const dismiss = () => {
    if (editor?.busy) return;
    if (adjusting) editor.onCancel();
    else onClose();
  };
  const videoError = () => {
    if (!item.onPlaybackError) {media.fail(); return;}
    if (!attemptedVideo.current || reportedVideoFailure.current) return;
    reportedVideoFailure.current = true;
    setWaiting(false);
    setFailed(true);
    item.onPlaybackError();
  };
  const play = () => {
    if (!src) {item.onPlayRequest?.(); return;}
    const node = video.current;
    if (!node) return;
    if (node.paused) {
      attemptedVideo.current = true;
      setWaiting(true);
      void node.play().catch(error => {
        if (node !== video.current || error instanceof DOMException && error.name === 'AbortError') return;
        setWaiting(false);
        videoError();
      });
    }
    else node.pause();
  };
  const updatePlayback = (node: HTMLVideoElement) => {
    const timing = {current: node.currentTime, duration: Number.isFinite(node.duration) ? node.duration : 0};
    filePosition.current = {time: node.currentTime, playing: !node.paused};
    setPlayback({...timing, playing: !node.paused, muted: node.muted});
  };
  const shareNative = async () => {
    setSharing(true);
    try {
      if (platform?.url) {
        if (navigator.share) await navigator.share({title, url: platform.url});
        else {await copyText(platform.url); showToast(t('mediaDrawer.linkCopied'));}
      } else {
        const file = editor?.createShareFile ? await editor.createShareFile() : await mediaFile(src, fileNamePrefix);
        if (navigator.canShare?.({files: [file]})) {
          try {await navigator.share({files: [file]});}
          catch (error) {if (error instanceof DOMException && error.name === 'NotAllowedError') saveMediaFile(file); else throw error;}
        } else saveMediaFile(file);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) showToast(t('media.downloadFailed'), 'info');
    } finally {setSharing(false);}
  };
  const download = () => {
    const saving = editor?.createShareFile ? editor.createShareFile().then(saveMediaFile) : downloadMedia(src, fileNamePrefix);
    void saving.catch(error => showToast(t(error instanceof Error && error.message === 'media_processing'
      ? 'media.downloadProcessing' : 'media.downloadFailed'), 'info'));
  };
  const sentAt = useMemo(() => {
    const date = item.createdAt ? new Date(item.createdAt * 1000) : null;
    if (!date || !Number.isFinite(date.getTime())) return null;
    return {date, label: new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}).format(date)};
  }, [item.createdAt, locale]);
  const dimmed = immersive || adjusting;
  const loadingPhase = fixedFitImage || editor
    ? (gestures.fitted.width || adjusting ? 'idle' : 'loading')
    : media.phase;
  const {bounds, freeDrag, transform} = gestures;
  const infoPull = infoOpen ? 1 : canShowInfo && !leaving ? mediaInfoProgress(false, freeDrag?.y ?? 0, infoHeight) : 0;
  const closeInfo = () => setInfo(false);
  const canZoom = !videoItem && Boolean(src && gestures.fitted.width) && !interactionDisabled;
  const zoomed = transform.scale > 1.003;
  const zoomPercent = useMemo(() => new Intl.NumberFormat(locale, {style: 'percent', maximumFractionDigits: 0}), [locale]);
  const toggleInfo = () => {
    if (infoOpen) {closeInfo(); return;}
    if (!canShowInfo) return;
    gestures.fit();
    setInfo(true);
  };
  const toggleImmersive = () => {
    if (immersive) gestures.fit();
    else changeMode('immersive');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || interactionDisabled
      || target.closest('input,textarea,select,[contenteditable],[role="alertdialog"]')) return;
    const key = event.key;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && canBrowse) {
      event.preventDefault();
      if (!event.repeat) go(key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (key === 'Enter' && target === gestures.stage.current && (src || item.posterUri)) {
      event.preventDefault();
      toggleImmersive();
      return;
    }
    if (!isDesktopMediaPreview()) return;
    if (key.toLowerCase() === 'i' && (canShowInfo || infoOpen)) {
      event.preventDefault();
      if (!event.repeat) toggleInfo();
    } else if (key.toLowerCase() === 'f' && (src || item.posterUri)) {
      event.preventDefault();
      if (!event.repeat) toggleImmersive();
    } else if (canZoom && !infoOpen && ['+', '=', '-', '0'].includes(key)) {
      event.preventDefault();
      if (key === '0') gestures.fit();
      else gestures.stepZoom(key === '-' ? -1 : 1);
    } else if (key === ' ' && videoItem && (src || item.onPlayRequest) && !target.closest('button,a')) {
      event.preventDefault();
      if (!event.repeat) play();
    }
  };
  const Identity = onJumpToMessage ? 'button' : 'div';
  const identityLabel = item.owner?.name || platform?.author || platform?.name || title;

  return <FloatingDrawerScope standalone>
    <SideDrawer open fullscreen headerless floatingBack={false} trapFocus historyMode={historyKey ? 'stack' : 'route'} historyKey={historyKey}
      backdropClassName="media-drawer-backdrop" closeRequestRef={closeRequestRef}
      className={`media-drawer${dimmed ? ' is-dark-media' : ''}`} title={title} onClose={dismiss}>
      <section className={`media-drawer-layout${infoOpen ? ' has-media-info' : ''}${adjusting ? ' is-adjusting' : ''}${immersive ? ' is-immersive-media' : ''}${fixedFitImage ? ' is-flash-media' : ''}${leaving ? ' is-leaving-media' : ''}`}
        onKeyDown={onKeyDown}>
        <div className={`media-drawer-stage${gestures.dragging ? ' is-dragging' : ''}${freeDrag || leaving ? ' is-free-drag' : ''}`}
          data-zoomable={canZoom && !infoOpen} data-zoomed={zoomed} tabIndex={interactionDisabled ? undefined : 0}
          aria-label={adjusting ? undefined : t('photo.canvas')} ref={gestures.bindStage} {...gestures.events}>
          {adjusting ? editor.stage : items.slice(first, last + 1).map((entry, visibleIndex) => {
            const position = first + visibleIndex;
            const active = position === index;
            if (fixedFitImage && !active) return null;
            const entryImage = entry.kind === 'image';
            const imageSrc = active ? src : editor ? entry.uri : mediaSourceCandidates(resolveStableResourceUri(entry.uri) ?? entry.uri).primary;
            const infoContent = !fixedFitImage && (editor?.info(position) ?? <>
              {platform?.url ? <a className="media-drawer-source" href={platform.url} target="_blank" rel="noreferrer">
                {platform.logo && <img src={platform.logo} alt="" />}{platform.name}{icon('north_east')}
              </a> : null}
              {(entry.imageMetadata || !entry.detail && !sharedDetail && !platform?.url) && <MediaMetadataPanel
                kind={entry.kind} metadata={entry.imageMetadata} owner={entry.owner} />}
              {entry.detail}{sharedDetail}
            </>);
            return <MediaDrawerSlide key={mediaKey(entry, position)} active={active} offset={position - cursor}
              bounds={bounds} size={sizeOf(entry, position)} transform={active ? transform : undefined}
              drag={active ? freeDrag : undefined} leaving={active && leaving}
              info={infoContent} infoOpen={infoOpen} infoProgress={infoPull}
              stage={gestures.stage} onInfoHeight={setInfoHeight} onCloseInfo={closeInfo}>
              {active && videoItem && src ? <video key={src} ref={video} className="media-drawer-canvas" src={src}
                poster={item.posterUri ?? undefined} playsInline preload={item.deferPlayback ? 'none' : 'metadata'} loop={item.loop} muted={playback.muted}
                onLoadedMetadata={event => {
                  const node = event.currentTarget;
                  rememberSize(entry, position, node.videoWidth, node.videoHeight);
                  if (filePosition.current.time && Number.isFinite(node.duration)) node.currentTime = Math.min(node.duration, filePosition.current.time);
                  if (filePosition.current.playing) void node.play().catch(() => undefined);
                  updatePlayback(node);
                }}
                onCanPlay={() => {setWaiting(false); media.ready();}}
                onWaiting={event => {if (!event.currentTarget.paused) setWaiting(true);}}
                onPlaying={() => setWaiting(false)}
                onTimeUpdate={event => updatePlayback(event.currentTarget)}
                onDurationChange={event => {
                  const duration = event.currentTarget.duration;
                  if (Number.isFinite(duration)) setPlayback(value => ({...value, duration}));
                }}
                onPlay={event => {claimMediaPlayback(event.currentTarget); updatePlayback(event.currentTarget);}}
                onPause={event => {setWaiting(false); releaseMediaPlayback(event.currentTarget); updatePlayback(event.currentTarget);}}
                onEnded={event => updatePlayback(event.currentTarget)}
                onError={videoError} /> : null}
              {entryImage && imageSrc ? <img ref={active ? image : undefined} className="media-drawer-canvas" src={imageSrc}
                alt={active ? title : ''} draggable={false} referrerPolicy={entry.referrerPolicy}
                onContextMenu={active && fixedFitImage ? event => event.preventDefault() : undefined}
                onLoad={event => {
                  rememberSize(entry, position, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
                  if (active && !fixedFitImage && !editor) media.ready();
                }}
                onError={active ? fixedFitImage?.onError ?? (editor ? () => setFailed(true) : media.fail) : undefined} /> : null}
              {!entryImage && (!active || !src) && entry.posterUri ? <img className="media-drawer-canvas" alt="" src={entry.posterUri}
                draggable={false} referrerPolicy={entry.referrerPolicy}
                onLoad={entry.width && entry.height ? undefined : event => rememberSize(entry, position, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} /> : null}
              {active && <>
                {src && (!item.deferPlayback || attemptedVideo.current) && <MediaWaitFeedback phase={failed ? 'error' : waiting ? 'buffering' : loadingPhase}
                  onRetry={fixedFitImage || editor || item.onPlaybackError ? undefined : media.retry} />}
                {fixedFitImage && !src && <MediaWaitFeedback phase="loading" />}
                {videoItem && !playback.playing && (src && !failed || item.onPlayRequest) && <OverlayIconButton icon="play_arrow"
                  className="media-drawer-play" aria-label={t('media.play')} onClick={play} />}
              </>}
            </MediaDrawerSlide>;
          })}
        </div>

        {canBrowse && !adjusting && !fixedFitImage && <div className="media-drawer-navigation media-drawer-desktop">
          <OverlayIconButton icon="chevron_left" aria-label={t('mediaDrawer.previous')} title={t('mediaDrawer.previous')}
            aria-keyshortcuts="ArrowLeft" aria-disabled={!canGoBack || interactionDisabled} onClick={() => {if (canGoBack) go(-1);}} />
          <OverlayIconButton icon="chevron_right" aria-label={t('mediaDrawer.next')} title={t('mediaDrawer.next')}
            aria-keyshortcuts="ArrowRight" aria-disabled={!canGoForward || interactionDisabled} onClick={() => {if (canGoForward) go(1);}} />
        </div>}

        <header className="media-drawer-top" aria-label={adjusting ? t('photo.edit') : undefined}>
          <DrawerDismissButton className="media-drawer-dismiss" disabled={editor?.busy || leaving} onClick={() => closeRequestRef.current?.()} />
          {adjusting && <div className="media-drawer-editor-actions">{editor.headerActions}</div>}
          {!immersive && !adjusting && <Identity className="media-drawer-identity" onClick={onJumpToMessage}
            type={onJumpToMessage ? 'button' : undefined}
            title={onJumpToMessage ? t('messageSearch.jumpToMessage') : undefined}
            aria-label={onJumpToMessage ? `${identityLabel} · ${t('messageSearch.jumpToMessage')}` : undefined}>
            {item.owner && <UserAvatar className="media-drawer-avatar" name={item.owner.name}
              uri={item.owner.avatar_uri} cacheKey={item.owner.avatar_cache_key} />}
            {!item.owner && platform?.logo && <img className="media-drawer-avatar" src={platform.logo} alt="" />}
            <span className="media-drawer-identity-text">
              <strong>{identityLabel}</strong>
              {sentAt ? <time dateTime={sentAt.date.toISOString()}>{sentAt.label}</time>
                : !fixedFitImage && (items.length > 1 || totalCount) ? <small>{navigationLabel ?? `${index + 1} / ${totalCount ?? items.length}`}</small> : null}
            </span>
            {onJumpToMessage && icon('arrow_outward')}
          </Identity>}
          <div className="media-drawer-top-actions">
            {fixedFitImage?.overlay}
            {(canShowInfo || infoOpen) && <OverlayIconButton icon="info" className="media-drawer-desktop"
              aria-label={t('mediaDrawer.info')} title={t('mediaDrawer.info')} aria-keyshortcuts="I"
              aria-pressed={infoOpen} disabled={interactionDisabled} onClick={toggleInfo} />}
            {!adjusting && !fixedFitImage && (src || item.posterUri) && <OverlayIconButton
              icon={immersive ? 'fullscreen_exit' : 'fullscreen'} className="media-drawer-desktop"
              aria-label={t(immersive ? 'mediaDrawer.exitImmersive' : 'mediaDrawer.immersive')}
              title={t(immersive ? 'mediaDrawer.exitImmersive' : 'mediaDrawer.immersive')}
              aria-keyshortcuts="F" disabled={interactionDisabled} onClick={toggleImmersive} />}

            {adjusting ? <button className="media-drawer-done" type="button" onClick={editor.onDone}>{t('common.done')}</button> : null}
            {editor && !adjusting && !immersive && <OverlayIconButton icon={editor.busy ? 'progress_activity' : editor.submitLabel ? 'check' : 'send'} aria-label={editor.submitLabel || t('common.send')}
              disabled={editor.busy || editor.sendDisabled} onClick={editor.onSend} />}
          </div>
        </header>

        {!fixedFitImage && !infoOpen && <footer className="media-drawer-bottom" style={{opacity: leaving ? 0 : 1 - infoPull}}>
          {adjusting ? editor.tools : <>
            {videoItem && src && <div className="media-drawer-transport" data-immersive={immersive}>
              <OverlayIconButton icon={playback.playing ? 'pause' : 'play_arrow'} aria-label={t(playback.playing ? 'media.pause' : 'media.play')} onClick={play} />
              {!immersive && <><input type="range" min={0} max={playback.duration || 1} step={.01} value={Math.min(playback.current, playback.duration)}
                disabled={!playback.duration} aria-label={t('mediaDrawer.seek')}
                onChange={event => {if (video.current) {video.current.currentTime = event.currentTarget.valueAsNumber; updatePlayback(video.current);}}} />
              <span>{timeCode(playback.current)} / {timeCode(playback.duration)}</span></>}
              <OverlayIconButton icon={playback.muted ? 'volume_off' : 'volume_up'} aria-label={t(playback.muted ? 'mediaDrawer.unmute' : 'mediaDrawer.mute')}
                onClick={() => {if (video.current) {video.current.muted = !video.current.muted; updatePlayback(video.current);}}} />
            </div>}
            {!immersive && (items.length > 1 || hasPrevious || hasNext) && <MediaDrawerFilm items={items} index={index}
              width={bounds.width} carousel={carousel} canLoadPrevious={hasPrevious} canLoadNext={hasNext} loading={loading} disabled={interactionDisabled} go={go} />}
            {(!immersive || canZoom) && <div className="media-drawer-footer-actions" data-immersive={immersive}>
              {!immersive && (editor ? editor.createShareFile : src || platform?.url || forward) && <MediaShareMenu key={identity}
                share={src || platform?.url ? () => void shareNative() : undefined} download={src ? download : undefined}
                forward={forward} downloadLabel={item.downloadLabel} disabled={sharing || interactionDisabled} />}
              {(canZoom || editor && !immersive) && <div className="media-drawer-center-actions">
                {canZoom && <div className="media-drawer-zoom media-drawer-desktop" role="group" aria-label={t('mediaDrawer.zoom')}>
                  <OverlayIconButton icon="remove" aria-label={t('media.zoomOut')} title={t('media.zoomOut')}
                    aria-disabled={!zoomed} aria-keyshortcuts="-" onClick={() => {if (zoomed) gestures.stepZoom(-1);}} />
                  <button type="button" className="media-drawer-zoom-fit" title={t('media.fitPage')}
                    aria-label={`${t('media.fitPage')} (${zoomPercent.format(transform.scale)})`} aria-keyshortcuts="0" onClick={gestures.fit}>
                    {zoomPercent.format(transform.scale)}
                  </button>
                  <OverlayIconButton icon="add" aria-label={t('media.zoomIn')} title={t('media.zoomIn')}
                    aria-disabled={transform.scale >= gestures.fitted.maximum} aria-keyshortcuts="+"
                    onClick={() => {if (transform.scale < gestures.fitted.maximum) gestures.stepZoom(1);}} />
                </div>}
                {editor && !immersive && <OverlayIconButton icon="tune" className="media-drawer-adjust" aria-label={t('mediaDrawer.adjust')}
                  disabled={editor.busy || editor.adjustDisabled || !src} onClick={editor.onAdjust} />}
              </div>}
              {!immersive && hasInfo && <OverlayIconButton icon="info" className="media-drawer-info-action" aria-label={t('mediaDrawer.info')} onClick={toggleInfo} />}
            </div>}
          </>}
        </footer>}
        {editor?.notice}
      </section>
      {linkToForward && <ChatSharePicker open title={t('message.forwardTitle')} onClose={() => setLinkToForward('')}
        sendToChat={(chatId, clientId) => api.sendMessage(chatId, 0, linkToForward, undefined, clientId)} />}
    </SideDrawer>
  </FloatingDrawerScope>;
}
