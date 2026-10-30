import "./FounderMedals.css";

export const FOUNDER_MEDAL_SRC = "/awards/founder-medal-v1.webp";

export function FounderMedalArtwork() {
  return <img src={FOUNDER_MEDAL_SRC} alt="" width="58" height="58" decoding="async" draggable={false} />;
}

export function AnnualMedal({ kind, year, name, label }: { kind: "founder" | "explorer"; year: number; name: string; label?: string }) {
  return <div className={`annual-medal ${kind === "founder" ? "founder-medal" : "explorer-profile-medal"}`} aria-label={label}>
    {kind === "founder" ? <FounderMedalArtwork /> : <img src="/activity/explorer-2026/badge-v2.webp" alt="" width="58" height="58" decoding="async" draggable={false} />}
    <span className="annual-medal-copy"><small>{year}</small><strong>{name}</strong></span>
  </div>;
}
