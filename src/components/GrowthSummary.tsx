import { useI18n } from "../lib/language";
import type { UserGrowthDTO } from "../types";
import "./GrowthExperience.css";

export function GrowthSummary({ growth, onAtlas, onReport }: { growth?: UserGrowthDTO; onAtlas: () => void; onReport: () => void }) {
  const { t, locale } = useI18n();
  const reportAvailable = growth?.report_available ?? (growth?.level ?? 1) >= 16;
  return <section className="growth-summary">
    <header><div><small>{t("growth.currentTitle")}</small><h2><span>LV {growth?.level ?? 1}</span>{growth?.name ?? t("growth.firstLevel")}</h2></div><button type="button" className="ghost-button" onClick={onAtlas}>{t("growth.openAtlas")}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></header>
    <div className="growth-summary-progress"><span>{growth?.level_cap_reason || (growth?.next_score ? t("growth.toNextLevel", { level: (growth.level ?? 1) + 1 }) : t("growth.maxLevel"))}</span><strong>{(growth?.score ?? 0).toLocaleString(locale)}{growth?.next_score ? <small> / {growth.next_score.toLocaleString(locale)}</small> : null}</strong><div role="progressbar" aria-label={t("growth.level")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((growth?.progress ?? 0) * 100)}><i style={{ transform: `scaleX(${growth?.progress ?? 0})` }} /></div></div>
    <div className="growth-summary-limits">{(["daily", "weekly"] as const).map(period => <div key={period}><span>{t(period === "daily" ? "growth.report.daily" : "growth.report.weekly")}</span><strong>{growth?.[period]?.earned ?? 0}<small> / {growth?.[period]?.limit ?? (period === "daily" ? 40 : 100)}</small></strong></div>)}</div>
    <button type="button" className="growth-report-entry" disabled={!reportAvailable} onClick={onReport}><span className="material-symbols-outlined" aria-hidden="true">insights</span><span><strong>{t("growth.openReport")}</strong><small>{t(reportAvailable ? "growth.report.entryHint" : "growth.report.locked")}</small></span><span className="material-symbols-outlined" aria-hidden="true">{reportAvailable ? "chevron_right" : "lock"}</span></button>
  </section>;
}
