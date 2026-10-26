import type { UserGrowthDTO } from "../types";
import { useI18n } from "../lib/language";
import { growthLevelLabel } from "../lib/growth-stage";

export function DuelGrowthProgress({ growth }: { growth: UserGrowthDTO | null }) {
  const { t, locale } = useI18n();
  if (!growth) return null;
  const next = growth.levels?.find((item) => item.level === growth.level + 1);
  const remaining = growth.next_score == null ? null : Math.max(0, growth.next_score - growth.score);
  const progress = Math.max(0, Math.min(1, growth.progress));
  return <section className="duel-growth" aria-label={t("growth.currentTitle")}>
    <div className="duel-growth-copy"><strong>{growthLevelLabel(growth.level, growth.name)}</strong><span>{growth.level_cap_reason || (remaining == null ? t("growth.maxLevel") : t("duel.growthRemaining", { points: remaining.toLocaleString(locale), level: growthLevelLabel(growth.level + 1, next?.name) }))}</span></div>
    <div className="duel-growth-track" role="progressbar" aria-label={t("growth.level")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ transform: `scaleX(${progress})` }} /></div>
  </section>;
}
