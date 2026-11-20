import { useI18n } from "../lib/language";
import {annualMedalArtwork2026} from '../lib/annualMedalArtwork';
import "./FounderMedals.css";

export const FOUNDER_MEDAL_SRC = "/awards/founder-medal-v1.webp";

export function FounderMedalArtwork() {
  return <img src={FOUNDER_MEDAL_SRC} alt="" width="58" height="58" decoding="async" draggable={false} />;
}

export function AnnualMedal({ kind, year, name, label }: { kind: "founder" | "explorer"; year: number; name: string; label?: string }) {
  const { language } = useI18n();
  if (year === 2026) {
    return <img className="annual-medal-woven" src={annualMedalArtwork2026(kind, language)} alt={label ?? `${year} ${name}`} width="1086" height="362" decoding="async" draggable={false} />;
  }

  return <div className={`annual-medal ${kind === "founder" ? "founder-medal" : "explorer-profile-medal"}`} aria-label={label}>
    <FounderMedalArtwork />
    <span className="annual-medal-copy"><small>{year}</small><strong>{name}</strong></span>
  </div>;
}
