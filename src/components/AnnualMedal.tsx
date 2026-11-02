import "./FounderMedals.css";

export const FOUNDER_MEDAL_SRC = "/awards/founder-medal-v1.webp";

export function FounderMedalArtwork() {
  return <img src={FOUNDER_MEDAL_SRC} alt="" width="58" height="58" decoding="async" draggable={false} />;
}

export function AnnualMedal({ kind, year, name, label }: { kind: "founder" | "explorer"; year: number; name: string; label?: string }) {
  return <div className={`annual-medal ${kind === "founder" ? "founder-medal" : "explorer-profile-medal"}`} aria-label={label}>
    {kind === "founder" ? <FounderMedalArtwork /> : <img src="https://api.sermo.jyonn.space/resources/assets/59/display/78375e5cd9fc9a864cd6aba1ec328bd64f5aea5248b713818f2358b77b5d4f19" alt="" width="58" height="58" decoding="async" draggable={false} />}
    <span className="annual-medal-copy"><small>{year}</small><strong>{name}</strong></span>
  </div>;
}
