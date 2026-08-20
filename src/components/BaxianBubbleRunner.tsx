import { useEffect, useRef, useState } from "react";
import heXianguAnimation from "../../design/Baxian/HeXiangu/direct-imagegen-v4/animation.json";
import lvDongbinAnimation from "../../design/Baxian/LvDongbin/direct-imagegen-v4/animation.json";
import zhongliQuanAnimation from "../../design/Baxian/ZhongliQuan/direct-imagegen-v4/animation.json";

type BaxianCharacter = "lv" | "zhongli" | "he";

const HOLD_LAST_FRAME_MS = 10_000;
const BAXIAN_ANIMATIONS = {
  he: heXianguAnimation,
  lv: lvDongbinAnimation,
  zhongli: zhongliQuanAnimation,
} as const;

export function baxianCharacterForStyle(style?: string): BaxianCharacter | null {
  if (style === "baxian-lv") return "lv";
  if (style === "baxian-zhongli") return "zhongli";
  if (style === "baxian-he") return "he";
  return null;
}

export function BaxianBubbleRunner({ style }: { style?: string }) {
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const character = baxianCharacterForStyle(style);
  const animation = character ? BAXIAN_ANIMATIONS[character] : null;

  useEffect(() => {
    const runner = runnerRef.current;
    const bubble = runner?.parentElement;
    const frameElement = frameRef.current;
    if (!runner || !bubble || !frameElement || !animation) return;

    const columns = animation.sheetColumns;
    const rows = animation.sheetRows;
    const frameCount = animation.frameCount;
    const frameDurations = animation.durationsMs;
    const playbackDuration = animation.durationMs;
    let animationFrame: number | null = null;
    let holdTimeout: number | null = null;
    let startedAt: number | null = null;

    frameElement.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
    const paintFrame = (frame: number) => {
      const column = frame % columns;
      const row = Math.floor(frame / columns);
      const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
      const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
      frameElement.style.backgroundPosition = `${x}% ${y}%`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paintFrame(frameCount - 1);
      setPlaying(true);
      return;
    }

    const startPlayback = () => {
      holdTimeout = null;
      startedAt = null;
      paintFrame(0);
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

    const advanceFrame = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      if (elapsed >= playbackDuration) {
        paintFrame(frameCount - 1);
        animationFrame = null;
        holdTimeout = window.setTimeout(startPlayback, HOLD_LAST_FRAME_MS);
        return;
      }

      let frame = 0;
      let frameStart = 0;
      while (frame < frameCount - 1 && elapsed >= frameStart + frameDurations[frame]) {
        frameStart += frameDurations[frame];
        frame += 1;
      }
      paintFrame(frame);
      animationFrame = window.requestAnimationFrame(advanceFrame);
    };

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

  if (!character) return null;
  return <span ref={runnerRef} aria-hidden="true" className={`baxian-bubble-runner is-${character}${playing ? " is-playing" : ""}`}><span ref={frameRef} className="baxian-bubble-frame" /></span>;
}
