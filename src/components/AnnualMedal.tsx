import { useI18n } from "../lib/language";
import "./FounderMedals.css";

export const FOUNDER_MEDAL_SRC = "/awards/founder-medal-v1.webp";

const annualMedalArtwork2026 = {
  explorer: {
    zh: "https://api.sermo.jyonn.space/resources/assets/232/display/ed9389da4da4ca33f8f131d17dd359ee01d0a3a6b09dc454e249dec1a934a348",
    en: "https://api.sermo.jyonn.space/resources/assets/233/display/ffd27ec88c7374a231dadd31f38bc0f3cd62ad1cdbfe932b5ac55d165a4c16a9",
  },
  founder: {
    zh: "https://api.sermo.jyonn.space/resources/assets/234/display/1d9e522f3309a379f9cf5211eaffe90b416f603339d0f2dc9393941e9ac60380",
    en: "https://api.sermo.jyonn.space/resources/assets/235/display/6037be91912bf833c19966fffe7eab9a7995e1074571220f9764585eede71aa6",
  },
};

export function FounderMedalArtwork() {
  return <img src={FOUNDER_MEDAL_SRC} alt="" width="58" height="58" decoding="async" draggable={false} />;
}

export function AnnualMedal({ kind, year, name, label }: { kind: "founder" | "explorer"; year: number; name: string; label?: string }) {
  const { language } = useI18n();
  const locale = language.startsWith("zh") ? "zh" : "en";
  if (year === 2026) {
    return <img className="annual-medal-woven" src={annualMedalArtwork2026[kind][locale]} alt={label ?? `${year} ${name}`} width="1086" height="362" decoding="async" draggable={false} />;
  }

  return <div className={`annual-medal ${kind === "founder" ? "founder-medal" : "explorer-profile-medal"}`} aria-label={label}>
    <FounderMedalArtwork />
    <span className="annual-medal-copy"><small>{year}</small><strong>{name}</strong></span>
  </div>;
}
