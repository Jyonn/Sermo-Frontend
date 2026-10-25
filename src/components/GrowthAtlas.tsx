import { useEffect, useRef } from "react";
import type { UserGrowthDTO } from "../types";
import { useI18n } from "../lib/language";
import { GrowthRewardPreview } from "./GrowthRewardPreview";
import "./GrowthExperience.css";

export function GrowthAtlas({ growth, selected, onSelect, name, uri, onReport }: { growth?: UserGrowthDTO; selected: number; onSelect: (level: number) => void; name: string; uri?: string; onReport: () => void }) {
  const { t, locale } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const item = growth?.levels?.find(level => level.level === selected);
  useEffect(() => { track.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" }); }, [selected]);
  return <div className="growth-atlas">
    <div className="growth-atlas-levels" aria-label={t("growth.levelGuide")} ref={track}>{(growth?.levels ?? []).map(level => <button type="button" aria-pressed={selected === level.level} className={level.unlocked ? "is-earned" : ""} key={level.level} onClick={() => onSelect(level.level)}><span>LV</span>{level.level}<i aria-hidden="true">{level.level === growth?.level ? "•" : level.unlocked ? "✓" : ""}</i></button>)}</div>
    {item ? <><header className="growth-atlas-heading"><div><small>{t(item.level === growth?.level ? "growth.currentLevelLabel" : item.unlocked ? "growth.reached" : "growth.keepGrowing")}</small><h2><span>LV {item.level}</span>{item.name}</h2></div><p><strong>{item.score.toLocaleString(locale)}</strong> {t("growth.points")}</p></header>
      <div className="growth-atlas-rewards">{item.rewards.filter(reward => reward.id !== "frame.collection").map(reward => <article key={reward.id} className={`growth-atlas-reward rarity-${reward.rarity}`}>
        <GrowthRewardPreview reward={reward} name={name} uri={uri} />
        <div className="growth-atlas-reward-copy"><span>{t(`growth.rewardCategory.${reward.category}`)}</span><h3>{reward.title}</h3><small>{t(`growth.rarity.${reward.rarity}`)}{reward.implementation_status === "planned" ? ` · ${t("growth.planned")}` : ""}</small>
          {reward.id === "growth.report" ? <button className="ghost-button" disabled={!(growth?.report_available ?? item.unlocked)} type="button" onClick={onReport}>{t("growth.openReport")}</button> : null}
        </div>
      </article>)}</div></> : null}
    {growth?.level_cap_reason ? <p className="growth-atlas-cap">{growth.level_cap_reason}</p> : null}
  </div>;
}
