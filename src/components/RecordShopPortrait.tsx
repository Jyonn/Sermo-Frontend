import { useEffect, useRef, useState } from "react";
import { appearanceAsset } from "../lib/appearanceAsset";
import { safeActivityImage } from "../lib/activityPresentation";
import type { RecordShopDecoration } from "../types";

type Artist = RecordShopDecoration["artist"];

const animatedPortraits = new Set<Artist>(["jolin", "stefanie", "elva", "fish"]);

function portraitArtwork(artist: Artist, value: string) {
  const portrait = safeActivityImage(value);
  if (!portrait || !animatedPortraits.has(artist)) return { portrait };
  const base = `/assets/activity/record-shop/preview-${artist}-portrait`;
  const animation = appearanceAsset(`${base}.webp`);
  if (portrait !== animation && portrait !== appearanceAsset(`${base}-legacy.webp`)) return { portrait };
  return { portrait: animation, poster: appearanceAsset(`${base}-poster.webp`) };
}

export function recordShopPortraitPoster(artist: Artist, uri: string) {
  const { portrait, poster } = portraitArtwork(artist, uri);
  return poster ?? portrait;
}

function AnimatedPortrait({ animation, poster, alt }: { animation: string; poster: string; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible || !image.current) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < 0.45) return;
      observer.disconnect();
      setVisible(true);
    }, { threshold: 0.45 });
    observer.observe(image.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <picture className="record-shop-portrait">
      <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />
      <img
        alt={alt}
        decoding="async"
        draggable={false}
        loading="lazy"
        onError={() => setFailed(true)}
        ref={image}
        src={visible && !failed ? animation : poster}
      />
    </picture>
  );
}

export function RecordShopPortrait({ artist, uri, alt }: { artist: Artist; uri: string; alt: string }) {
  const { portrait, poster } = portraitArtwork(artist, uri);
  if (!portrait) return null;
  if (poster) return <AnimatedPortrait key={portrait} animation={portrait} poster={poster} alt={alt} />;
  return <img className="record-shop-portrait" src={portrait} alt={alt} loading="lazy" decoding="async" draggable={false} />;
}
