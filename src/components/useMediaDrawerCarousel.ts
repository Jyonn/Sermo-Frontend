import {useLayoutEffect, useRef, useState} from 'react';

export function useMediaDrawerCarousel({index, identity, count, onIndexChange}: {
  index: number; identity: string; count: number; onIndexChange: (index: number) => void;
}) {
  const [offset, setOffset] = useState(0);
  const current = useRef(0);
  const frame = useRef(0);
  const state = useRef({index, count, onIndexChange});
  state.current = {index, count, onIndexChange};
  const stop = () => {
    cancelAnimationFrame(frame.current);
    return current.current;
  };
  const paint = (value: number) => {
    current.current = value;
    setOffset(value);
  };
  const drag = (value: number) => {
    const {index, count} = state.current;
    const bounded = Math.min(count - 1 - index, Math.max(-index, value));
    paint(bounded + Math.max(-.22, Math.min(.22, (value - bounded) * .22)));
  };
  const settle = (to: number) => {
    const from = stop();
    const {index, count} = state.current;
    const target = Math.min(count - 1 - index, Math.max(-index, Math.round(to)));
    const finish = () => {
      paint(0);
      if (target) state.current.onIndexChange(state.current.index + target);
    };
    if (Math.abs(from - target) < .001 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const duration = 185 + Math.min(95, Math.abs(target - from) * 85);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      if (progress === 1) {finish(); return;}
      paint(from + (target - from) * (1 - (1 - progress) ** 3));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useLayoutEffect(() => {
    paint(0);
    return () => cancelAnimationFrame(frame.current);
  }, [identity]);

  return {offset, stop, drag, settle};
}
