import { useEffect, useRef, useState } from "react";
import { appearanceAsset } from "../lib/appearanceAsset";
import { usePageActive } from "../lib/pageActivity";
import type { SingerAvatarFrameStyle } from "../lib/singerAvatarFrames";
import "./SingerAvatarFrame.css";

let ornamentObserver: IntersectionObserver | undefined;

export function SingerAvatarFrame({ style, animate }: { style: SingerAvatarFrameStyle; animate: boolean }) {
  const ornament = useRef<HTMLPictureElement>(null);
  const [ready, setReady] = useState(false);
  const pageActive = usePageActive();
  const poster = appearanceAsset(`/assets/avatar-frames/singers/${style}/poster.webp`);
  const frames = appearanceAsset(`/assets/avatar-frames/singers/${style}/frames.webp`);

  useEffect(() => {
    const target = ornament.current;
    if (!target || !animate || !pageActive) return;
    if (typeof IntersectionObserver === "undefined") return;
    ornamentObserver ??= new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.toggleAttribute("data-in-view", entry.isIntersecting));
    });
    ornamentObserver.observe(target);
    return () => {
      ornamentObserver?.unobserve(target);
      target.removeAttribute("data-in-view");
    };
  }, [animate, pageActive]);

  return (
    <picture ref={ornament} aria-hidden="true"
      className={`singer-avatar-ornament${animate ? "" : " is-still"}${ready ? " is-loaded" : ""}`}>
      {animate && <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />}
      <img alt="" src={animate ? frames : poster} loading="lazy" decoding="async"
        onLoad={() => setReady(true)} onError={() => setReady(false)} />
    </picture>
  );
}
