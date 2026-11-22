import {useEffect, useRef, useState, type RefObject} from 'react';
import {lockSwipeAxis, shouldCompleteSwipe, swipeVelocity, type SwipeSample} from '../lib/mediaDrawerGeometry';

export function useMediaDrawerInfoDrag(viewport: RefObject<HTMLElement>, open: boolean, height: number, onClose: () => void) {
  const [distance, setDistance] = useState<number>();
  const options = useRef({height, onClose});
  options.current = {height, onClose};

  useEffect(() => {
    const node = viewport.current;
    if (!open || !node) {
      setDistance(undefined);
      return;
    }
    let drag: {id: number; start: SwipeSample; startScroll: number; samples: SwipeSample[]; mode?: 'close' | 'scroll'} | undefined;
    let suppressClick = false;
    const start = (id: number, point: SwipeSample, target: EventTarget | null) => {
      suppressClick = false;
      if (drag || (target instanceof Element && target.closest('input,textarea,select'))) return;
      drag = {id, start: point, startScroll: node.scrollTop, samples: [point]};
    };
    const move = (id: number, point: SwipeSample, event: Event, capture?: () => void) => {
      if (!drag || drag.id !== id) return;
      const offset = point.y - drag.start.y;
      if (!drag.mode) {
        const dx = point.x - drag.start.x;
        const axis = event.type === 'touchmove' && offset >= 3 && offset > Math.abs(dx) ? 'free' : lockSwipeAxis(dx, offset);
        if (!axis) return;
        if (axis !== 'free' || !event.cancelable) {drag = undefined; return;}
        const canClose = offset > 0 && drag.startScroll <= 1;
        if (!canClose && (!capture || node.scrollHeight <= node.clientHeight)) {drag = undefined; return;}
        drag.mode = canClose ? 'close' : 'scroll';
        capture?.();
      }
      if (event.cancelable) event.preventDefault();
      if (drag.mode === 'scroll') {
        node.scrollTop = drag.startScroll - offset;
        return;
      }
      drag.samples = [...drag.samples.filter(sample => point.time - sample.time <= 100), point];
      setDistance(Math.max(0, offset));
    };
    const finish = (id: number, point?: SwipeSample) => {
      if (!drag || drag.id !== id) return;
      const released = drag;
      drag = undefined;
      if (!released.mode) return;
      suppressClick = true;
      setDistance(undefined);
      if (!point || released.mode !== 'close') return;
      const offset = point.y - released.start.y;
      const extent = Math.min(160, Math.max(72, options.current.height * .7));
      if (offset >= 18 && shouldCompleteSwipe(offset, extent, swipeVelocity(released.samples, point, 'y'))) {
        options.current.onClose();
      }
    };
    const pointerAt = (event: PointerEvent) => ({x: event.clientX, y: event.clientY, time: event.timeStamp});
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.button === 0) start(event.pointerId, pointerAt(event), event.target);
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') move(event.pointerId, pointerAt(event), event, () => node.setPointerCapture(event.pointerId));
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') finish(event.pointerId, event.type === 'pointerup' ? pointerAt(event) : undefined);
    };
    const pointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && !drag?.mode) finish(event.pointerId);
    };
    // A non-passive touch listener lets the panel take a downward gesture at its
    // scroll boundary without taking over ordinary upward scrolling.
    const touchAt = (event: TouchEvent, touch: Touch) => ({x: touch.clientX, y: touch.clientY, time: event.timeStamp});
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      start(touch.identifier, touchAt(event, touch), event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !drag) return;
      const touch = event.touches[0];
      move(touch.identifier, touchAt(event, touch), event);
    };
    const touchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(candidate => candidate.identifier === drag?.id);
      if (touch) finish(touch.identifier, event.type === 'touchend' ? touchAt(event, touch) : undefined);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick || !event.detail) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    node.addEventListener('pointerdown', pointerDown);
    node.addEventListener('pointermove', pointerMove);
    node.addEventListener('pointerup', pointerEnd);
    node.addEventListener('pointercancel', pointerEnd);
    node.addEventListener('pointerleave', pointerLeave);
    node.addEventListener('lostpointercapture', pointerEnd);
    node.addEventListener('touchstart', touchStart, {passive: true});
    node.addEventListener('touchmove', touchMove, {passive: false});
    node.addEventListener('touchend', touchEnd);
    node.addEventListener('touchcancel', touchEnd);
    node.addEventListener('click', click, true);
    return () => {
      node.removeEventListener('pointerdown', pointerDown);
      node.removeEventListener('pointermove', pointerMove);
      node.removeEventListener('pointerup', pointerEnd);
      node.removeEventListener('pointercancel', pointerEnd);
      node.removeEventListener('pointerleave', pointerLeave);
      node.removeEventListener('lostpointercapture', pointerEnd);
      node.removeEventListener('touchstart', touchStart);
      node.removeEventListener('touchmove', touchMove);
      node.removeEventListener('touchend', touchEnd);
      node.removeEventListener('touchcancel', touchEnd);
      node.removeEventListener('click', click, true);
    };
  }, [open, viewport]);

  return open ? distance : undefined;
}
