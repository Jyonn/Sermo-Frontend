import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../lib/language";
import { musicProfileAsset, type MusicProfileCardTheme } from "../lib/musicProfileCards";
import { usePageActive } from "../lib/pageActivity";
import "./MusicProfileScene.css";

export function MusicProfileScene({ theme, still = false }: { theme: MusicProfileCardTheme; still?: boolean }) {
  const { t } = useI18n();
  const host = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const active = usePageActive();

  useEffect(() => {
    if (still || !host.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [still]);

  if (still) {
    return <span aria-hidden="true" className={`music-profile-scene music-profile-${theme} is-still`}
      style={{ "--music-cover": `url("${musicProfileAsset(theme, "poster")}")` } as CSSProperties} />;
  }

  return (
    <span aria-hidden="true" ref={host}
      className={`music-profile-scene music-profile-${theme}${ready && inView && active ? " is-playing" : ""}`}
      style={{ "--music-cover": `url("${musicProfileAsset(theme, "backdrop")}")` } as CSSProperties}>
      <span className="music-profile-portraits">
        <img src={musicProfileAsset(theme, "frames")} onLoad={() => setReady(true)} loading="lazy" decoding="async" alt="" />
      </span>
      <span className="music-profile-wordmark">{t(`menu.profileCardTheme.${theme}`)}</span>
    </span>
  );
}
