import {useEffect, useRef, type PointerEvent} from 'react';
import {useI18n} from '../lib/language';
import {filmHeight, filmPitch, filmTiles, swipeVelocity, type SwipeSample} from '../lib/mediaDrawerGeometry';
import type {MediaLightboxItem} from './MediaDrawer';
import type {useMediaDrawerCarousel} from './useMediaDrawerCarousel';
import {OverlayIconButton} from './OverlayIconButton';

type Props = {
  items: MediaLightboxItem[];
  index: number;
  width: number;
  carousel: ReturnType<typeof useMediaDrawerCarousel>;
  canLoadPrevious?: boolean;
  canLoadNext?: boolean;
  loading?: boolean;
  go: (direction: -1 | 1) => void;
};

export function MediaDrawerFilm({items, index, width, carousel, canLoadPrevious, canLoadNext, loading, go}: Props) {
  const {t} = useI18n();
  const gesture = useRef<{id: number; x: number; offset: number; samples: SwipeSample[]; dragging: boolean}>();
  const suppressClick = useRef(false);
  const wheelEnd = useRef<number>();
  const cursor = index + carousel.offset;
  const selected = Math.min(items.length - 1, Math.max(0, Math.round(cursor)));
  const radius = Math.ceil(width / 60) + 2;
  const tiles = filmTiles(cursor, Math.max(0, selected - radius), Math.min(items.length - 1, selected + radius));
  useEffect(() => () => window.clearTimeout(wheelEnd.current), []);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gesture.current || (event.target as HTMLElement).closest('.overlay-icon-button')) return;
    window.clearTimeout(wheelEnd.current);
    suppressClick.current = false;
    gesture.current = {id: event.pointerId, x: event.clientX, offset: carousel.stop(), samples: [
      {x: event.clientX, y: 0, time: event.timeStamp},
    ], dragging: false};
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (!drag.dragging && Math.abs(dx) < 6) return;
    if (!drag.dragging) {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.dragging = true;
    }
    drag.samples = [...drag.samples.filter(sample => event.timeStamp - sample.time <= 100), {x: event.clientX, y: 0, time: event.timeStamp}];
    carousel.drag(drag.offset - dx / filmPitch);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = undefined;
    if (!drag.dragging) {
      if (drag.offset) carousel.settle(drag.offset);
      return;
    }
    const offset = carousel.stop();
    suppressClick.current = true;
    if (event.type !== 'pointerup') {carousel.settle(offset); return;}
    const velocity = swipeVelocity(drag.samples, {x: event.clientX, y: 0, time: event.timeStamp}, 'x');
    const target = Math.round(offset - Math.max(-.8, Math.min(.8, velocity * 45 / filmPitch)));
    if (index + target < 0 && canLoadPrevious) go(-1);
    else if (index + target >= items.length && canLoadNext) go(1);
    else carousel.settle(target);
  };
  return <div className="media-drawer-film" role="group" aria-label={t('mediaDrawer.thumbnails')} style={{height: filmHeight}}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
    onPointerLeave={event => {if (!gesture.current?.dragging) up(event);}}
    onClickCapture={event => {if (suppressClick.current && event.detail) {suppressClick.current = false; event.stopPropagation();}}}
    onWheel={event => {
      const dx = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (!dx) return;
      window.clearTimeout(wheelEnd.current);
      carousel.drag(carousel.stop() + dx / filmPitch);
      wheelEnd.current = window.setTimeout(() => carousel.settle(carousel.stop()), 120);
    }}
    onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); go(event.key === 'ArrowLeft' ? -1 : 1);
    }}>
    <div className="media-drawer-film-tiles">
      {tiles.map(tile => {
        const entry = items[tile.index];
        const thumb = entry.thumbnailUri || entry.posterUri || (entry.kind === 'image' ? entry.uri : '');
        return <button type="button" key={entry.id ?? `${tile.index}:${entry.uri}`}
          aria-current={selected === tile.index ? 'true' : undefined} aria-label={t('mediaDrawer.asset', {count: tile.index + 1})}
          tabIndex={selected === tile.index ? 0 : -1}
          style={{width: tile.width, transform: `translateX(${tile.center - tile.width / 2}px)`}} onClick={() => carousel.settle(tile.index - index)}>
          {thumb ? <img src={thumb} alt="" loading="lazy" draggable={false} referrerPolicy={entry.referrerPolicy} />
            : <span className="material-symbols-outlined" aria-hidden="true">{entry.kind === 'video' ? 'movie' : 'photo'}</span>}
          {thumb && entry.kind === 'video' && <span className="media-drawer-film-video">
            <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
          </span>}
        </button>;
      })}
    </div>
    {canLoadPrevious && index === 0 && <OverlayIconButton icon="chevron_left" className="media-drawer-film-previous"
      aria-label={t('media.previousImage')} onClick={() => go(-1)} disabled={loading} />}
    {canLoadNext && index === items.length - 1 && <OverlayIconButton icon="chevron_right" className="media-drawer-film-next"
      aria-label={t('media.nextImage')} onClick={() => go(1)} disabled={loading} />}
  </div>;
}
