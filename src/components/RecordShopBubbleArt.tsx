import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RecordShopDecoration } from "../types";
import "./RecordShop.css";

type Stroke = { path: string; delay: number; duration: number };

const illustrations: Record<RecordShopDecoration["artist"], { resting: string; strokes: Stroke[] }> = {
  jay: {
    resting: "M88 25l9 2-3 12-9-2z M91 30c-4 1-3 4-1 3l-1 2 3-1-2-1c3 1 4-2 1-3",
    strokes: [
      { path: "M92 30C82 10 58 3 38 10S18 28 31 32", delay: 0, duration: 1050 },
      { path: "M74 12l11 5-5 12-11-5z M77 18l3 6-5-2z", delay: 155, duration: 790 },
      { path: "M45 6l15 2-2 17-15-2z M52 11c-6 3-5 7-1 5l-1 4 4-1-2-2c4 2 5-2 0-6", delay: 380, duration: 960 },
      { path: "M35 28c1 9 17 11 32 8 12-2 18-5 24-6 M34 26l-3-3m7 1 1-4", delay: 780, duration: 990 },
      { path: "M81 25l9-6 7 11-9 6z M88 25l-1 5 4-2z", delay: 1110, duration: 650 },
    ],
  },
  leehom: {
    resting: "M98 31a7 7 0 1 0-14 0 7 7 0 1 0 14 0 M87 26c3 4 3 8 0 11m8-11c-3 4-3 8 0 11",
    strokes: [
      { path: "M99 32c-10-2-19-6-29-5M94 36c-9-1-17-4-21-6", delay: 0, duration: 680 },
      { path: "M79 40l-4-5L51 20c-3-2-2-6 1-7 2-1 4 0 6 2l20 16 5 4-1 5z", delay: 225, duration: 760 },
      { path: "M68 25l-8 1m9-6-5-4m9 5 3-8m-6 16-3 5", delay: 370, duration: 520 },
      { path: "M68 24C56 9 35 4 24 13 16 20 27 29 42 31 M39 13a5 5 0 1 0-10 0 5 5 0 1 0 10 0m-8-4c3 1 5 4 5 7", delay: 525, duration: 990 },
      { path: "M43 31c19 8 32 8 48 1", delay: 1010, duration: 790 },
      { path: "M92 30l3 3 5-2m-8 6 4 2", delay: 1250, duration: 550 },
    ],
  },
  david: {
    resting: "M65 33l3-5 8-2 6-6h10l6 7 5 4v5h-7m-12 0h-6m-9 0h-4v-3m17-6h14m-7-7v7 M78 36a4 4 0 1 0-8 0 4 4 0 1 0 8 0m18 0a4 4 0 1 0-8 0 4 4 0 1 0 8 0",
    strokes: [
      { path: "M10 34C29 47 61 41 85 28 105 17 103 7 96 6 87 3 76 8 68 13", delay: 0, duration: 1350 },
      { path: "M53 33l-3-4 5-4 5-9 12-6 8 3 5-1 3 5 1 4-6 3m-7 4-12 7m-8 2-3-4m8-7 16-8m-9-6 4 8 M64 35a3.5 3.5 0 1 0-7 0 3.5 3.5 0 1 0 7 0m19-11a3.5 3.5 0 1 0-7 0 3.5 3.5 0 1 0 7 0", delay: 345, duration: 1170 },
      { path: "M29 36l12-3m-9 7 12-3m0-32v8m-4-4h8m42-6v6m-3-3h6", delay: 320, duration: 1020 },
      { path: "M16 18a6 6 0 1 0 12 0 6 6 0 1 0-12 0m-3 5c-5 3 1 5 8 3 9-2 16-6 13-8l-4 1", delay: 780, duration: 970 },
    ],
  },
  jj: {
    resting: "M77 29h17v3c0 5-3 8-8 8s-9-3-9-8z M94 31h4a2 2 0 0 1 0 4h-5m-21 7h25 M85 25c4-3-3-5 0-8",
    strokes: [
      { path: "M85 29c-9-5 5-7-2-13-5-4-18-1-19-7-1-4 6-7 11-5", delay: 0, duration: 1470 },
      { path: "M91 26c7-6-7-8-4-14 3-5-3-8-8-8", delay: 265, duration: 1390 },
      { path: "M80 28c-5-4 4-6 0-10-6-5-13 2-22-1-9-3-11-9-24-8-7 0-10 2-11 6", delay: 515, duration: 1550 },
      { path: "M67 30c-2-5-13-4-19-6-7-3-8-7-15-7", delay: 785, duration: 1200 },
    ],
  },
};

export function RecordShopBubbleArt({ artist, animateOnView = false }: {
  artist: RecordShopDecoration["artist"];
  animateOnView?: boolean;
}) {
  const root = useRef<SVGSVGElement>(null);
  const [revealed, setRevealed] = useState(false);
  const { resting, strokes } = illustrations[artist];

  useEffect(() => {
    const node = root.current;
    if (!animateOnView || revealed || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.IntersectionObserver) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setRevealed(true);
    }, { threshold: .5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [animateOnView, revealed]);

  return (
    <svg
      aria-hidden="true"
      className={`record-shop-bubble-art${revealed ? " is-revealed" : ""}`}
      focusable="false"
      ref={root}
      viewBox="0 0 108 44"
      preserveAspectRatio="xMaxYMax meet"
    >
      <path className="record-shop-art-mark" d={resting} />
      {revealed && strokes.map(({ path, delay, duration }) => (
        <path
          className="record-shop-art-stroke"
          key={path}
          d={path}
          pathLength={1}
          style={{ "--record-stroke-delay": `${delay}ms`, "--record-stroke-duration": `${duration}ms` } as CSSProperties}
        />
      ))}
    </svg>
  );
}
