import {useLayoutEffect, useRef, useState, type PointerEvent, type WheelEvent} from 'react';
import {
  constrainMediaTransform, fitMedia, fittedMediaTransform, lockSwipeAxis, mediaSlideGap, swipeVelocity,
  type MediaSize, type MediaTransform, type SwipeAxis, type SwipeSample,
} from '../lib/mediaDrawerGeometry';

type Point = {x: number; y: number};
type Pinch = {center: Point; distance: number; transform: MediaTransform};
type Drag = {point: Point; transform: MediaTransform; axis?: SwipeAxis; samples: SwipeSample[]; startOffset: number};
const midpoint = (a: Point, b: Point) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function useMediaDrawerGestures({
  size, mediaKey, mode, disabled, onMode, onFreeRelease, onSwipeStart, onSwipeMove, onSwipeEnd,
}: {
  size: MediaSize; mediaKey: string; mode: 'default' | 'immersive'; disabled: boolean;
  onMode: (mode: 'default' | 'immersive') => void;
  onFreeRelease: (offset: Point, velocity: number) => void;
  onSwipeStart: () => number;
  onSwipeMove: (offset: number) => void;
  onSwipeEnd: (offset: number, velocity: number, cancelled?: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<MediaSize>({width: 0, height: 0});
  const [transform, setTransform] = useState(fittedMediaTransform);
  const [dragging, setDragging] = useState(false);
  const [freeDrag, setFreeDrag] = useState<Point>();
  const current = useRef(transform);
  const pointers = useRef(new Map<number, Point>());
  const origin = useRef<Drag>();
  const pinch = useRef<Pinch>();
  const wheelTimer = useRef<number>();
  const fitted = fitMedia(bounds, size);
  const setCurrent = (value: MediaTransform) => {current.current = value; setTransform(value);};
  const reset = () => setCurrent(fittedMediaTransform);

  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const resize = () => setBounds({width: node.clientWidth, height: node.clientHeight});
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    pointers.current.clear();
    origin.current = pinch.current = undefined;
    setDragging(false);
    setFreeDrag(undefined);
    reset();
    return () => window.clearTimeout(wheelTimer.current);
  }, [mediaKey, disabled]);

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
  const settle = () => {
    if (current.current.scale > 1.003) return;
    reset();
    onMode('default');
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || (event.target as HTMLElement).closest('button,a,input')) return;
    const point = position(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      origin.current = {point, transform: current.current, samples: [{...point, time: event.timeStamp}], startOffset: 0};
      setDragging(true);
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
      reset();
      onMode(mode === 'default' ? 'immersive' : 'default');
    } else if (start.transform.scale <= 1.003 && axis === 'horizontal') {
      onSwipeEnd(dx - start.startOffset * (bounds.width + mediaSlideGap), swipeVelocity(start.samples, end, 'x'));
    } else if (start.transform.scale <= 1.003) {
      onFreeRelease({x: dx, y: dy}, swipeVelocity(start.samples, end, 'y'));
    }
  };
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled || !fitted.width || !(event.ctrlKey || event.metaKey)) return;
    const point = position(event.clientX, event.clientY);
    const next = current.current.scale * Math.exp(-event.deltaY * .007);
    if (next > 1.003 && mode === 'default') onMode('immersive');
    zoomAt(current.current, point, point, next);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(settle, 110);
  };
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node || disabled) return;
    const prevent = (event: globalThis.WheelEvent) => {if (event.ctrlKey || event.metaKey) event.preventDefault();};
    node.addEventListener('wheel', prevent, {passive: false});
    return () => node.removeEventListener('wheel', prevent);
  }, [disabled]);

  return {stage, bounds, fitted, transform: constrainMediaTransform(transform, fitted, bounds), dragging, freeDrag, reset,
    events: {onPointerDown: down, onPointerMove: move, onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release, onWheel: wheel}};
}
