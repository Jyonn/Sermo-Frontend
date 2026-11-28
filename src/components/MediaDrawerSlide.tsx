import {useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject} from 'react';
import {useI18n} from '../lib/language';
import {
  fitMedia, fitMediaForInfo, fittedMediaTransform, mediaInfoProgress, mediaSlideGap, type MediaSize, type MediaTransform,
} from '../lib/mediaDrawerGeometry';
import {useMediaDrawerInfoDrag} from './useMediaDrawerInfoDrag';

interface MediaDrawerSlideProps {
  active: boolean;
  offset: number;
  bounds: MediaSize;
  size: MediaSize;
  transform?: MediaTransform;
  info: ReactNode;
  infoOpen: boolean;
  infoProgress: number;
  stage: RefObject<HTMLDivElement>;
  onInfoHeight: (height: number) => void;
  onCloseInfo: () => void;
  children: ReactNode;
}

export function MediaDrawerSlide({
  active, offset, bounds, size, transform = fittedMediaTransform, info, infoOpen, infoProgress,
  stage, onInfoHeight, onCloseInfo, children,
}: MediaDrawerSlideProps) {
  const {t} = useI18n();
  const [height, setHeight] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const hasInfo = Boolean(info);
  const fitted = fitMedia(bounds, size);
  const fit = fitMediaForInfo(bounds, fitted, hasInfo ? height : 0);
  const overflow = hasInfo && bounds.height > 0 && height > fit.panelHeight;
  const opened = active && infoOpen;
  const panelDrag = useMediaDrawerInfoDrag(viewport, opened, fit.panelHeight, onCloseInfo);
  const tracking = panelDrag !== undefined;
  const progress = panelDrag === undefined ? infoProgress : mediaInfoProgress(true, panelDrag, fit.panelHeight);
  const scale = transform.scale + (fit.scale - transform.scale) * progress;
  const x = infoOpen ? 0 : transform.x * (1 - progress);
  const y = transform.y + (fit.y - transform.y) * progress;
  const style = {
    transform: `translate3d(calc(${offset * 100}% + ${offset * mediaSlideGap}px), 0, 0)`,
    '--slide-media-width': fitted.width ? `${fitted.width}px` : '100%',
    '--slide-media-height': fitted.height ? `${fitted.height}px` : '100%',
    '--slide-media-transform': `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${scale})`,
    '--slide-control-offset': `${-fit.panelHeight * progress / 2}px`,
  } as CSSProperties;

  useLayoutEffect(() => {
    const node = body.current;
    if (!node) {setHeight(0); return;}
    const measure = () => setHeight(node.offsetHeight);
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    measure();
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasInfo]);
  useLayoutEffect(() => {if (active) onInfoHeight(fit.panelHeight);}, [active, fit.panelHeight, onInfoHeight]);
  useLayoutEffect(() => {
    if (panel.current) {
      if (!opened && panel.current.contains(document.activeElement)) stage.current?.focus({preventScroll: true});
      panel.current.inert = !opened;
    }
    if (!opened && viewport.current?.scrollTop) viewport.current.scrollTop = 0;
  }, [opened, stage, hasInfo]);

  return <div className={`media-drawer-slide${tracking ? ' is-tracking-info' : ''}`} data-active={active} aria-hidden={!active} style={style}>
    <div className="media-drawer-slide-scroll" ref={viewport} data-scrollable={opened && overflow}
      tabIndex={opened && overflow ? 0 : undefined} aria-label={opened && overflow ? t('mediaDrawer.info') : undefined}>
      <div className="media-drawer-slide-photo" style={{height: bounds.height || '100%'}}>
        {children}
      </div>
      {info && <section className="media-drawer-info" ref={panel} aria-label={t('mediaDrawer.info')}
        aria-hidden={!opened} data-open={opened}
        style={{marginTop: -fit.panelHeight, minHeight: overflow ? bounds.height : undefined, opacity: progress,
          transform: `translate3d(0, ${(1 - progress) * fit.panelHeight}px, 0) scale(${.9 + progress * .1})`}}>
        <div className="media-drawer-info-body" ref={body}>
          <button className="media-drawer-handle" type="button" onClick={onCloseInfo} aria-label={t('common.close')}><span/></button>
          {info}
        </div>
      </section>}
    </div>
  </div>;
}
