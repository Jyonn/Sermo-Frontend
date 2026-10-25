export type GrowthLevelStage = "plain" | "basic" | "select" | "rare" | "epic" | "legendary" | "mythic";

export function growthLevelLabel(level: number, name?: string) {
  const normalized = Math.max(1, Math.min(18, Math.trunc(level || 1)));
  return `LV ${normalized}${name?.trim() ? `·${name.trim()}` : ""}`;
}

export function growthStageForLevel(level: number): GrowthLevelStage {
  if (level <= 2) return "plain";
  if (level <= 5) return "basic";
  if (level <= 8) return "select";
  if (level <= 11) return "rare";
  if (level <= 14) return "epic";
  if (level <= 17) return "legendary";
  return "mythic";
}
