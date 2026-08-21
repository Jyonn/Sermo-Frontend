import { useEffect, useRef } from "react";
import heXianguSheet from "../assets/baxian/he-xiangu-edge-sheet.webp";
import lvDongbinSheet from "../assets/baxian/lv-dongbin-edge-sheet.webp";
import zhongliQuanSheet from "../assets/baxian/zhongli-quan-edge-sheet.webp";

type BaxianCharacter = "lv" | "zhongli" | "he";

const BAXIAN_ANIMATION = {
  durationsMs: [80, 60, 50, 45, 45, 45, 50, 50, 55, 55, 60, 65, 70, 80, 90, 150],
  frameCount: 16,
  sheetColumns: 4,
  sheetRows: 4,
  totalDurationMs: 1050,
} as const;

const BAXIAN_ANIMATIONS = {
  he: { data: BAXIAN_ANIMATION, sheet: heXianguSheet },
  lv: { data: BAXIAN_ANIMATION, sheet: lvDongbinSheet },
  zhongli: { data: BAXIAN_ANIMATION, sheet: zhongliQuanSheet },
} as const;

export function baxianCharacterForStyle(style?: string): BaxianCharacter | null {
  if (style === "baxian-lv") return "lv";
  if (style === "baxian-zhongli") return "zhongli";
  if (style === "baxian-he") return "he";
  return null;
}

export function BaxianBubbleRunner({ animate, style }: { animate: boolean; style?: string }) {
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const character = baxianCharacterForStyle(style);
  const animation = character ? BAXIAN_ANIMATIONS[character] : null;

  useEffect(() => {
    const runner = runnerRef.current;
    const bubble = runner?.parentElement;
    const frameElement = frameRef.current;
    if (!runner || !bubble || !frameElement || !animation) return;

    const { data } = animation;
    let animationFrame: number | null = null;
    let startedAt: number | null = null;
    let hasPlayed = false;

    frameElement.style.backgroundImage = `url("${animation.sheet}")`;
    frameElement.style.backgroundSize = `${data.sheetColumns * 100}% ${data.sheetRows * 100}%`;

    const paintFrame = (frame: number) => {
      const column = frame % data.sheetColumns;
      const row = Math.floor(frame / data.sheetColumns);
      const x = data.sheetColumns > 1 ? (column / (data.sheetColumns - 1)) * 100 : 0;
      const y = data.sheetRows > 1 ? (row / (data.sheetRows - 1)) * 100 : 0;
      frameElement.style.backgroundPosition = `${x}% ${y}%`;
    };

    paintFrame(0);
    if (!animate) return;

    const advanceFrame = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      if (elapsed >= data.totalDurationMs) {
        paintFrame(data.frameCount - 1);
        animationFrame = null;
        return;
      }

      let frame = 0;
      let frameStart = 0;
      while (frame < data.frameCount - 1 && elapsed >= frameStart + data.durationsMs[frame]) {
        frameStart += data.durationsMs[frame];
        frame += 1;
      }
      paintFrame(frame);
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

    const start = () => {
      if (hasPlayed) return;
      hasPlayed = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        paintFrame(data.frameCount - 1);
        return;
      }
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
    }, { threshold: 0.2 });
    observer.observe(bubble);
    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [animate, animation]);

  if (!character || !animation) return null;
  return (
    <span ref={runnerRef} aria-hidden="true" className={`baxian-bubble-runner is-${character}`}>
      <span ref={frameRef} className="baxian-bubble-frame" />
    </span>
  );
}
