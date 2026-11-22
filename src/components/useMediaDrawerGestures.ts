import {useLayoutEffect, useRef, useState, type PointerEvent, type WheelEvent} from 'react';
import {constrainMediaTransform, fitMedia, fittedMediaTransform, type MediaSize, type MediaTransform} from '../lib/mediaDrawerGeometry';

type Point = {x: number; y: number};
type Pinch = {center: Point; distance: number; transform: MediaTransform};
const midpoint = (a: Point, b: Point) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function useMediaDrawerGestures({
  size, mediaKey, mode, disabled, onMode, onStep, onInfo,
}: {
  size: MediaSize; mediaKey: string; mode: 'default' | 'immersive'; disabled: boolean;
  onMode: (mode: 'default' | 'immersive', reason: 'zoom' | 'tap') => void; onStep: (direction: -1 | 1) => void;
  onInfo: (open: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<MediaSize>({width: 0, height: 0});
  const [transform, setTransform] = useState(fittedMediaTransform);
  const [dragging, setDragging] = useState(false);
  const current = useRef(transform);
  const pointers = useRef(new Map<number, Point>());
  const origin = useRef<{point: Point; transform: MediaTransform}>();
  const pinch = useRef<Pinch>();
  const moved = useRef(false);
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
    onMode('default', 'zoom');
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || (event.target as HTMLElement).closest('button,a,input')) return;
    const point = position(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      moved.current = false;
      origin.current = {point, transform: current.current};
      setDragging(true);
    } else if (pointers.current.size === 2 && fitted.width) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {center: midpoint(a, b), distance: Math.max(12, distance(a, b)), transform: current.current};
      moved.current = true;
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = position(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    const [a, b] = [...pointers.current.values()];
    const start = origin.current;
    if (pinch.current && b) {
      const initial = pinch.current;
      const scale = initial.transform.scale * distance(a, b) / initial.distance;
      if (scale > 1.003 && mode === 'default') {onInfo(false); onMode('immersive', 'zoom');}
      zoomAt(initial.transform, initial.center, midpoint(a, b), scale);
      return;
    }
    if (!start) return;
    const dx = point.x - start.point.x;
    const dy = point.y - start.point.y;
    if (Math.hypot(dx, dy) > 8) moved.current = true;
    if (mode === 'immersive' && current.current.scale > 1.003) {
      zoom({...start.transform, x: start.transform.x + dx, y: start.transform.y + dy});
    }
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size) return;
    setDragging(false);
    const start = origin.current;
    origin.current = undefined;
    if (pinch.current) {pinch.current = undefined; settle(); return;}
    if (event.type !== 'pointerup' || !start) return;
    const point = position(event.clientX, event.clientY);
    const dx = point.x - start.point.x;
    const dy = point.y - start.point.y;
    if (!moved.current && Math.hypot(dx, dy) <= 8) {
      reset();
      if (mode === 'default') onInfo(false);
      onMode(mode === 'default' ? 'immersive' : 'default', 'tap');
    } else if (current.current.scale <= 1.003 && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      onStep(dx < 0 ? 1 : -1);
    } else if (mode === 'default' && Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) {
      onInfo(dy < 0);
    }
  };
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled || !fitted.width || !(event.ctrlKey || event.metaKey)) return;
    const point = position(event.clientX, event.clientY);
    const next = current.current.scale * Math.exp(-event.deltaY * .007);
    if (next > 1.003 && mode === 'default') {onInfo(false); onMode('immersive', 'zoom');}
    zoomAt(current.current, point, point, next);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(settle, 110);
  };
  // React's delegated wheel event may be passive. Suppress page zoom only inside the media canvas.
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node || disabled) return;
    const prevent = (event: globalThis.WheelEvent) => {if (event.ctrlKey || event.metaKey) event.preventDefault();};
    node.addEventListener('wheel', prevent, {passive: false});
    return () => node.removeEventListener('wheel', prevent);
  }, [disabled]);

  return {stage, fitted, transform: constrainMediaTransform(transform, fitted, bounds), dragging, reset,
    events: {onPointerDown: down, onPointerMove: move, onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release, onWheel: wheel}};
}
