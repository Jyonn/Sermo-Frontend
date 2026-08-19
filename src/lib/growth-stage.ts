export type GrowthLevelStage = "plain" | "basic" | "select" | "rare" | "epic" | "legendary" | "mythic";

export function growthStageForLevel(level: number): GrowthLevelStage {
  if (level <= 2) return "plain";
  if (level <= 5) return "basic";
  if (level <= 8) return "select";
  if (level <= 11) return "rare";
  if (level <= 14) return "epic";
  if (level <= 17) return "legendary";
  return "mythic";
}
