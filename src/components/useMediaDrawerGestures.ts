import {useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent} from 'react';
import {
  constrainMediaTransform, fitMedia, fittedMediaTransform, lockSwipeAxis, mediaSlideGap, swipeVelocity,
  type MediaSize, type MediaTransform, type SwipeAxis, type SwipeSample,
} from '../lib/mediaDrawerGeometry';

type Point = {x: number; y: number};
type Pinch = {center: Point; distance: number; transform: MediaTransform};
type Drag = {point: Point; transform: MediaTransform; axis?: SwipeAxis; samples: SwipeSample[]; startOffset: number; desktopMouse: boolean};
const midpoint = (a: Point, b: Point) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const center = {x: 0, y: 0};
export const isDesktopMediaPreview = () => window.matchMedia('(min-width: 720px)').matches;

export function useMediaDrawerGestures({
  size, mediaKey, mode, disabled, infoOpen, canBrowse, desktopImageZoom, onBrowse, onMode, onFreeRelease, onSwipeStart, onSwipeMove, onSwipeEnd,
}: {
  size: MediaSize; mediaKey: string; mode: 'default' | 'immersive'; disabled: boolean;
  infoOpen: boolean;
  canBrowse: boolean;
  desktopImageZoom: boolean;
  onBrowse: (direction: -1 | 1) => void;
  onMode: (mode: 'default' | 'immersive') => void;
  onFreeRelease: (offset: Point, velocity: number) => void;
  onSwipeStart: () => number;
  onSwipeMove: (offset: number) => void;
  onSwipeEnd: (offset: number, velocity: number, cancelled?: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement | null>(null);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);
  const bindStage = useCallback((node: HTMLDivElement | null) => {
    stage.current = node;
    setStageNode(node);
  }, []);
  const [bounds, setBounds] = useState<MediaSize>({width: 0, height: 0});
  const [transform, setTransform] = useState(fittedMediaTransform);
  const [dragging, setDragging] = useState(false);
  const [freeDrag, setFreeDrag] = useState<Point>();
  const current = useRef(transform);
  const pointers = useRef(new Map<number, Point>());
  const origin = useRef<Drag>();
  const pinch = useRef<Pinch>();
  const wheelTimer = useRef<number>();
  const wheelBrowse = useRef({distance: 0, used: false, timer: 0});
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => undefined);
  const fitted = fitMedia(bounds, size);
  const setCurrent = (value: MediaTransform) => {current.current = value; setTransform(value);};
  const reset = () => setCurrent(fittedMediaTransform);

  useLayoutEffect(() => {
    if (!stageNode) return;
    const resize = () => {
      const {clientWidth: width, clientHeight: height} = stageNode;
      setBounds(current => current.width === width && current.height === height ? current : {width, height});
    };
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(stageNode);
    return () => observer.disconnect();
  }, [stageNode]);
  useLayoutEffect(() => {
    pointers.current.clear();
    origin.current = pinch.current = undefined;
    setDragging(false);
    setFreeDrag(undefined);
    reset();
    return () => window.clearTimeout(wheelTimer.current);
  }, [mediaKey, disabled, infoOpen, stageNode]);

  const zoom = (next: MediaTransform) => setCurrent(constrainMediaTransform(next, fitted, bounds));
  const position = (x: number, y: number) => {
    const frame = stage.current!.getBoundingClientRect();
    return {x: x - frame.left - frame.width / 2, y: y - frame.top - frame.height / 2};
  };
  const zoomAt = (start: MediaTransform, from: Point, to: Point, scale: number) => {
    const next = Math.min(fitted.maximum, Math.max(.5, scale));
    const ratio = next / start.scale;
    zoom({scale: next, x: to.x - (from.x - start.x) * ratio, y: to.y - (from.y - start.y) * ratio});
  };
  const fit = () => {
    reset();
    onMode('default');
  };
  const settle = () => {if (current.current.scale <= 1.003) fit();};
  const changeZoom = (scale: number, anchor = center) => {
    if (disabled || infoOpen || !fitted.width) return;
    window.clearTimeout(wheelTimer.current);
    if (scale <= 1.003) {fit(); return;}
    onMode('immersive');
    zoomAt(current.current, anchor, anchor, scale);
  };
  const stepZoom = (direction: -1 | 1) => changeZoom(current.current.scale * (Math.SQRT2 ** direction));
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || infoOpen && pointers.current.size
      || (event.target as HTMLElement).closest('button,a,input,textarea,select')) return;
    const point = position(event.clientX, event.clientY);
    const desktopMouse = event.pointerType === 'mouse' && isDesktopMediaPreview();
    pointers.current.set(event.pointerId, point);
    if (!infoOpen && !desktopMouse) event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      origin.current = {point, transform: current.current, samples: [{...point, time: event.timeStamp}], startOffset: 0, desktopMouse};
      if (!infoOpen && !desktopMouse) setDragging(true);
    } else if (pointers.current.size === 2) {
      if (origin.current?.axis === 'horizontal') onSwipeMove(0);
      setFreeDrag(undefined);
      const [a, b] = [...pointers.current.values()];
      pinch.current = {center: midpoint(a, b), distance: Math.max(12, distance(a, b)), transform: current.current};
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = position(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    const start = origin.current;
    if (pinch.current) {
      const [a, b] = [...pointers.current.values()];
      if (!b || !fitted.width) return;
      const initial = pinch.current;
      const scale = initial.transform.scale * distance(a, b) / initial.distance;
      if (scale > 1.003 && mode === 'default') onMode('immersive');
      zoomAt(initial.transform, initial.center, midpoint(a, b), scale);
      return;
    }
    if (!start) return;
    const dx = point.x - start.point.x;
    const dy = point.y - start.point.y;
    const axis = lockSwipeAxis(dx, dy, start.axis);
    if (!axis) return;
    if (axis === 'free' && (infoOpen || start.desktopMouse && start.transform.scale <= 1.003)) {
      start.axis = axis;
      return;
    }
    if (!start.axis && (infoOpen || start.desktopMouse)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!start.axis && start.transform.scale <= 1.003) {
      start.startOffset = onSwipeStart();
      if (axis === 'free' && start.startOffset) onSwipeMove(0);
    }
    start.axis = axis;
    start.samples = [...start.samples.filter(sample => event.timeStamp - sample.time <= 100), {...point, time: event.timeStamp}];
    if (start.transform.scale > 1.003) {
      zoom({...start.transform, x: start.transform.x + dx, y: start.transform.y + dy});
    } else if (axis === 'horizontal') {
      onSwipeMove(start.startOffset - dx / (bounds.width + mediaSlideGap));
    } else {
      setFreeDrag({x: dx, y: dy});
    }
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId) || pointers.current.size) return;
    setDragging(false);
    const start = origin.current;
    origin.current = undefined;
    setFreeDrag(undefined);
    if (pinch.current) {pinch.current = undefined; settle(); return;}
    if (!start) return;
    if (event.type !== 'pointerup') {
      if (start.axis === 'horizontal' && start.transform.scale <= 1.003) onSwipeEnd(0, 0, true);
      return;
    }
    const point = position(event.clientX, event.clientY);
    const dx = point.x - start.point.x;
    const dy = point.y - start.point.y;
    const axis = lockSwipeAxis(dx, dy, start.axis);
    const end = {...point, time: event.timeStamp};
    if (!axis) {
      if (start.desktopMouse) return;
      if (infoOpen && !(event.target as HTMLElement).closest('.media-drawer-slide-photo')) return;
      reset();
      onMode(mode === 'default' ? 'immersive' : 'default');
    } else if (start.transform.scale <= 1.003 && axis === 'horizontal') {
      onSwipeEnd(dx - start.startOffset * (bounds.width + mediaSlideGap), swipeVelocity(start.samples, end, 'x'));
    } else if (!infoOpen && !start.desktopMouse && start.transform.scale <= 1.003) {
      onFreeRelease({x: dx, y: dy}, swipeVelocity(start.samples, end, 'y'));
    }
  };
  const doubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || infoOpen || !isDesktopMediaPreview() || !(event.target as Element).closest('.media-drawer-canvas')) return;
    if (desktopImageZoom && current.current.scale <= 1.003) changeZoom(2, position(event.clientX, event.clientY));
    else if (mode === 'immersive') fit();
    else onMode('immersive');
  };
  wheelHandler.current = event => {
    if (disabled || pointers.current.size || (event.target as Element).closest('input,textarea,select,[contenteditable]')) return;
    const desktop = isDesktopMediaPreview();
    const modified = event.ctrlKey || event.metaKey;
    const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
    const horizontal = event.shiftKey || Math.abs(dx) > Math.abs(event.deltaY);
    const browse = wheelBrowse.current;
    if (desktop && canBrowse && !modified && (horizontal || browse.distance)) {
      event.preventDefault();
      window.clearTimeout(browse.timer);
      if (horizontal && !browse.used) {
        browse.distance += dx * factor;
        if (Math.abs(browse.distance) >= 40) {
          browse.used = true;
          onBrowse(browse.distance > 0 ? 1 : -1);
        }
      }
      browse.timer = window.setTimeout(() => {browse.distance = 0; browse.used = false;}, 150);
      return;
    }
    if (infoOpen || !fitted.width || !modified && (!desktop || !desktopImageZoom || horizontal)) return;
    event.preventDefault();
    const point = position(event.clientX, event.clientY);
    const delta = Math.max(-110, Math.min(110, event.deltaY * factor));
    const next = current.current.scale * Math.exp(-delta * (modified ? .007 : .0025));
    if (!modified && next <= 1.003) {fit(); return;}
    if (next > 1.003 && mode === 'default') onMode('immersive');
    zoomAt(current.current, point, point, next);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(settle, 110);
  };
  useLayoutEffect(() => {
    if (!stageNode) return;
    const handle = (event: WheelEvent) => wheelHandler.current(event);
    stageNode.addEventListener('wheel', handle, {passive: false});
    return () => {
      stageNode.removeEventListener('wheel', handle);
      window.clearTimeout(wheelBrowse.current.timer);
      wheelBrowse.current = {distance: 0, used: false, timer: 0};
    };
  }, [stageNode]);

  return {stage, stageNode, bindStage, bounds, fitted, transform: constrainMediaTransform(transform, fitted, bounds), dragging, freeDrag, fit, stepZoom,
    events: {onPointerDown: down, onPointerMove: move, onPointerUp: release, onPointerCancel: release,
      onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
        if ((infoOpen || origin.current?.desktopMouse) && origin.current?.axis !== 'horizontal') release(event);
      },
      onLostPointerCapture: release, onDoubleClick: doubleClick}};
}
