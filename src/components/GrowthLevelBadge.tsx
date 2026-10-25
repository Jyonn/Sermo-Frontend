import { growthLevelLabel, growthStageForLevel } from "../lib/growth-stage";

interface GrowthLevelBadgeProps {
  className?: string;
  label?: string;
  level: number;
  name?: string;
}

export function GrowthLevelBadge({ className = "", label, level, name }: GrowthLevelBadgeProps) {
  const normalizedLevel = Math.max(1, Math.min(18, Math.trunc(level || 1)));
  const classes = ["growth-level-badge", `stage-${growthStageForLevel(normalizedLevel)}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{label ?? growthLevelLabel(normalizedLevel, name)}</span>;
}
