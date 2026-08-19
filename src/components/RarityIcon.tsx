import type { GrowthRewardDTO } from "../types";

export function RarityIcon({ rarity, className = "" }: { rarity: GrowthRewardDTO["rarity"]; className?: string }) {
  return <span aria-hidden="true" className={`rarity-glyph rarity-${rarity}${className ? ` ${className}` : ""}`}><i /></span>;
}
