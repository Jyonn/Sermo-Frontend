import { useEffect, useRef, useState } from "react";
import heXianguAnimation from "../../design/Baxian/HeXiangu/direct-imagegen-v4/animation.json";
import lvDongbinAnimation from "../../design/Baxian/LvDongbin/direct-imagegen-v4/animation.json";
import zhongliQuanAnimation from "../../design/Baxian/ZhongliQuan/direct-imagegen-v4/animation.json";
import heXianguTransitionSheet from "../assets/baxian/he-xiangu-edge-sheet.webp";
import lvDongbinTransitionSheet from "../assets/baxian/lv-dongbin-edge-sheet.webp";
import zhongliQuanTransitionSheet from "../assets/baxian/zhongli-quan-edge-sheet.webp";

type BaxianCharacter = "lv" | "zhongli" | "he";

const HOLD_LAST_FRAME_MS = 10_000;
const CHARACTER_ANIMATIONS = {
  he: heXianguAnimation,
  lv: lvDongbinAnimation,
  zhongli: zhongliQuanAnimation,
} as const;

const TRANSITION_ANIMATION = {
  durationsMs: [80, 60, 50, 45, 45, 45, 50, 50, 55, 55, 60, 65, 70, 80, 90, 150],
  frameCount: 16,
  sheetColumns: 4,
  sheetRows: 4,
  totalDurationMs: 1050,
} as const;

const TRANSITION_ANIMATIONS = {
  he: { data: TRANSITION_ANIMATION, sheet: heXianguTransitionSheet },
  lv: { data: TRANSITION_ANIMATION, sheet: lvDongbinTransitionSheet },
  zhongli: { data: TRANSITION_ANIMATION, sheet: zhongliQuanTransitionSheet },
} as const;

export function baxianCharacterForStyle(style?: string): BaxianCharacter | null {
  if (style === "baxian-lv") return "lv";
  if (style === "baxian-zhongli") return "zhongli";
  if (style === "baxian-he") return "he";
  return null;
}

export function BaxianCharacterRunner({ style }: { style?: string }) {
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const character = baxianCharacterForStyle(style);
  const animation = character ? CHARACTER_ANIMATIONS[character] : null;

  useEffect(() => {
    const runner = runnerRef.current;
    const bubble = runner?.parentElement;
    const frameElement = frameRef.current;
    if (!runner || !bubble || !frameElement || !animation) return;

    let animationFrame: number | null = null;
    let holdTimeout: number | null = null;
    let startedAt: number | null = null;
    frameElement.style.backgroundSize = `${animation.sheetColumns * 100}% ${animation.sheetRows * 100}%`;

    const paintFrame = (frame: number) => {
      const column = frame % animation.sheetColumns;
      const row = Math.floor(frame / animation.sheetColumns);
      const x = animation.sheetColumns > 1 ? (column / (animation.sheetColumns - 1)) * 100 : 0;
      const y = animation.sheetRows > 1 ? (row / (animation.sheetRows - 1)) * 100 : 0;
      frameElement.style.backgroundPosition = `${x}% ${y}%`;
    };

    const startPlayback = () => {
      holdTimeout = null;
      startedAt = null;
      paintFrame(0);
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

    const advanceFrame = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      if (elapsed >= animation.durationMs) {
        paintFrame(animation.frameCount - 1);
        animationFrame = null;
        holdTimeout = window.setTimeout(startPlayback, HOLD_LAST_FRAME_MS);
        return;
      }

      let frame = 0;
      let frameStart = 0;
      while (frame < animation.frameCount - 1 && elapsed >= frameStart + animation.durationsMs[frame]) {
        frameStart += animation.durationsMs[frame];
        frame += 1;
      }
      paintFrame(frame);
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paintFrame(animation.frameCount - 1);
      setPlaying(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (animationFrame !== null || holdTimeout !== null) return;
        setPlaying(true);
        startPlayback();
        return;
      }
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (holdTimeout !== null) window.clearTimeout(holdTimeout);
      animationFrame = null;
      holdTimeout = null;
      setPlaying(false);
    }, { threshold: 0.2 });
    observer.observe(bubble);
    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (holdTimeout !== null) window.clearTimeout(holdTimeout);
    };
  }, [animation]);

  if (!character || !animation) return null;
  return (
    <span ref={runnerRef} aria-hidden="true" className={`baxian-character-runner is-${character}${playing ? " is-playing" : ""}`}>
      <span ref={frameRef} className="baxian-character-frame" />
    </span>
  );
}

export function BaxianBubbleTransition({ animate, style }: { animate: boolean; style?: string }) {
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const character = baxianCharacterForStyle(style);
  const animation = character ? TRANSITION_ANIMATIONS[character] : null;

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
    <span ref={runnerRef} aria-hidden="true" className={`baxian-bubble-transition is-${character}`}>
      <span ref={frameRef} className="baxian-bubble-transition-frame" />
    </span>
  );
}
