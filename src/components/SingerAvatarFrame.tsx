import { useEffect, useRef, useState, type CSSProperties } from "react";
import { appearanceAsset } from "../lib/appearanceAsset";
import { usePageActive } from "../lib/pageActivity";
import type { SingerAvatarFrameStyle } from "../lib/singerAvatarFrames";
import "./SingerAvatarFrame.css";

let ornamentObserver: IntersectionObserver | undefined;

const lettering = {
  gem: { count: 5, interval: .48, asset: "lettering-v2.webp" },
  "eason-chan": { count: 4, interval: .76, asset: "lettering-v3.webp" },
} as const;

export function SingerAvatarFrame({ style, animate }: { style: SingerAvatarFrameStyle; animate: boolean }) {
  const ornament = useRef<HTMLSpanElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [portraitReady, setPortraitReady] = useState(false);
  const pageActive = usePageActive();
  const path = `/assets/avatar-frames/singers/${style}`;
  const poster = appearanceAsset(`${path}/poster.webp`);
  const frames = appearanceAsset(`${path}/motion-v2.webp`);
  const scene = appearanceAsset(`${path}/stage-v2.webp`);
  const verse = style === "gem" || style === "eason-chan" ? lettering[style] : undefined;

  useEffect(() => {
    const target = ornament.current;
    if (!target || !animate || !pageActive) return;
    if (typeof IntersectionObserver === "undefined") {
      target.setAttribute("data-in-view", "");
    } else {
      ornamentObserver ??= new IntersectionObserver(entries => {
        entries.forEach(entry => entry.target.toggleAttribute("data-in-view", entry.isIntersecting));
      });
      ornamentObserver.observe(target);
    }
    return () => {
      ornamentObserver?.unobserve(target);
      target.removeAttribute("data-in-view");
    };
  }, [animate, pageActive]);

  return (
    <span ref={ornament} aria-hidden="true"
      className={`singer-avatar-ornament${animate ? "" : " is-still"}${sceneReady && portraitReady ? " is-loaded" : ""}`}>
      <img className="singer-avatar-stage" src={scene} alt="" loading="lazy" decoding="async" onLoad={() => setSceneReady(true)} />
      <picture className="singer-avatar-portrait">
        {animate && <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />}
        <img alt="" src={animate ? frames : poster} loading="lazy" decoding="async" onLoad={() => setPortraitReady(true)} />
      </picture>
      {animate && verse && <span className="singer-avatar-verse" style={{
        "--letter-art": `url("${appearanceAsset(`${path}/${verse.asset}`)}")`,
        "--letter-count": verse.count,
      } as CSSProperties}>
        {Array.from({ length: verse.count }, (_, index) => <i key={index} style={{
          "--letter-time": `${5.64 + index * verse.interval}s`,
          "--letter-position": `${100 * index / (verse.count - 1)}%`,
        } as CSSProperties}><b /></i>)}
      </span>}
    </span>
  );
}
