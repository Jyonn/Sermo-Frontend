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
  jolin: {
    resting: "M73 35h29m-27-1 2-11h21l2 11M78 28c2 4 5 4 7 0 2 4 5 4 7 0 2 4 5 4 7 0m-12-6c-5-2-7-5-4-6 3-1 3 2 4 3 1-3 4-5 6-2 1 2-2 4-6 5",
    strokes: [
      { path: "M45 7l12-5 15 15-8 8-19-18zm20 17 5 4 5-5-4-6 M49 9l10-4 M75 24l4 4", delay: 0, duration: 920 },
      { path: "M79 27c-5-6-12-4-12 1s-9 4-9-1c0-6-9-6-11-1s-10 6-15 2", delay: 230, duration: 1120 },
      { path: "M26 35h71m-66-1 2-12 63-1 2 13m-64-8c5 6 12 6 16 0 5 6 12 6 16 0 4 6 12 6 16 0 4 5 9 5 14 0", delay: 450, duration: 1240 },
      { path: "M88 17c-8-1-9-9-3-8 3 1 4 4 3 8 1-6 6-8 9-5 2 3-3 6-9 5m-4-1c-4-2-9 0-7 3 2 3 7 0 11-2 4 1 7 4 12 2", delay: 805, duration: 950 },
    ],
  },
  stefanie: {
    resting: "M75 33c5-10 11-17 22-24l2 3c-6 10-14 16-22 21m-1-2c-4 0-7 4-9 7 6 1 9-1 11-5 M77 38c8 4 19 2 24-3",
    strokes: [
      { path: "M58 23l12-12L92 1l2 3-18 15-12 9m4-6-5-5m-3 6c-6-1-10 2-13 7 3 2 11 1 16-4", delay: 0, duration: 850 },
      { path: "M48 28c-8-4-15 2-13 5 4 4 16 4 23 0 6-4 3-6-2-7", delay: 270, duration: 1050 },
      { path: "M66 30c7 6 3 10-11 12C35 45 14 38 24 31c3-3 13-5 17-3", delay: 490, duration: 1140 },
      { path: "M13 34c2-12 24-18 37-13m27 9c7 8-5 13-20 14m12-25 3-3m13 5 6-2m-10 11 4 2", delay: 770, duration: 1060 },
    ],
  },
  elva: {
    resting: "M75 36l6-18 7 4 7-4 7 18z M85 24l3 11 3-11m-13 8h20m-13-14 3 4 4-4",
    strokes: [
      { path: "M18 18l9-9 5 2 7-1 6 4-11 10-3 6-5-3-3-7z M23 21l11-8m0 11 8-10", delay: 0, duration: 860 },
      { path: "M35 27c11 10 20 10 28-2 4-6 13-11 24-10", delay: 260, duration: 940 },
      { path: "M52 37l6-12 7-13 5 2 8-3 12 3 5-2 5 14 5 11H52zm19-22 6 11 7-10", delay: 510, duration: 1170 },
      { path: "M56 34h3m3 0h3m3 0h3m3 0h3m3 0h3m3 0h3m3 0h3m3 0h3M68 20l1 3m3 3 1 3m15-9-1 3m-2 3-1 3", delay: 910, duration: 960 },
    ],
  },
  fish: {
    resting: "M75 25h5l3-4h8l3 4h7v13H75z M92 31.5a4 4 0 1 1-8 0 4 4 0 1 1 8 0m3-3h3",
    strokes: [
      { path: "M30 20v-8h10m34 0h10v8m0 9v8H74m-34 0H30v-8 M50 25h14m-7-7v14", delay: 0, duration: 960 },
      { path: "M65 24a8 8 0 1 1-16 0 8 8 0 1 1 16 0m-12-7 6 5m6-1-6 4m3 6-4-6m-5 7 4-7m-7 2 6-4m-6-3 7 3", delay: 370, duration: 780 },
      { path: "M19 10v7m-4-3h8m66 6v8m-4-4h8 M69 8l5-5m-3 10 8-2m-3 8h7", delay: 700, duration: 800 },
      { path: "M54 37V16h35v21z M56 33l8-7 6 5 7-8 10 10m-18-10a2 2 0 1 0-4 0 2 2 0 1 0 4 0", delay: 920, duration: 1010 },
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
  const animating = animateOnView && revealed;

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
      className={`record-shop-bubble-art${animating ? " is-revealed" : ""}`}
      focusable="false"
      ref={root}
      viewBox="0 0 108 44"
      preserveAspectRatio="xMaxYMax meet"
    >
      <path className="record-shop-art-mark" d={resting} />
      {animating && strokes.map(({ path, delay, duration }) => (
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
