import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { GrowthReportDTO } from "../types";
import { FeedbackState } from "./FeedbackState";
import { signedGrowthPoints } from "../lib/growthPoints";
import "./GrowthExperience.css";

export function GrowthReport() {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<GrowthReportDTO | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); setError(false); setReport(null); void api.getGrowthReport(controller.signal).then(value => { if (!controller.signal.aborted) setReport(value); }).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [retry]);
  if (error) return <FeedbackState tone="error" title={t("growth.report.failed")} action={<button className="ghost-button" type="button" onClick={() => setRetry(value => value + 1)}>{t("common.retry")}</button>} />;
  if (!report) return <FeedbackState tone="loading" title={t("common.loading")} />;
  const categories: Record<string, string> = { daily: t("growth.report.category.daily"), weekly: t("growth.report.category.weekly"), explore: t("growth.report.category.explore"), social: t("growth.report.category.social"), security: t("growth.report.category.security"), achievement: t("growth.report.category.achievement"), vip: t("growth.report.category.vip") };
  const max = Math.max(1, ...report.activity.map(day => day.count));
  const total = Math.max(1, report.categories.reduce((sum, item) => sum + item.points, 0));
  return <div className="growth-report">
    <header><small>{t("growth.report.eyebrow")}</small><h2>{t("growth.report.days", { count: report.days_together })}</h2><p>{t("growth.report.intro")}</p></header>
    <dl className="growth-report-stats"><div><dt>{t("growth.level")}</dt><dd>LV {report.level}<small>{report.name}</small></dd></div><div><dt>{t("growth.points")}</dt><dd>{report.score.toLocaleString(locale)}</dd></div><div><dt>{t("growth.report.records")}</dt><dd>{report.record_count.toLocaleString(locale)}</dd></div></dl>
    <section><h3>{t("growth.report.activity")}</h3><p>{t("growth.report.activityHint")}</p><div className="growth-report-chart" role="list">{report.activity.map(day => <div key={day.date} role="listitem" aria-label={`${day.date}: ${day.count}`} title={`${day.date}: ${day.count}`}><i style={{ height: `${Math.max(3, day.count / max * 100)}%` }} className={day.count ? "" : "is-empty"} /></div>)}</div><div className="growth-report-chart-labels"><span>{report.activity[0]?.date}</span><span>{report.activity[report.activity.length - 1]?.date}</span></div></section>
    <section><h3>{t("growth.report.sources")}</h3>{report.categories.length ? <div className="growth-report-sources">{report.categories.map(item => <div key={item.category}><span>{categories[item.category] ?? t("growth.report.category.other")}</span><strong>{item.points.toLocaleString(locale)}</strong><div><i style={{ transform: `scaleX(${item.points / total})` }} /></div></div>)}</div> : <p>{t("growth.report.noRecords")}</p>}</section>
    <section><h3>{t("growth.report.milestones")}</h3><div className="growth-report-milestones">{report.milestones.map(item => <span key={item.key}><span className="material-symbols-outlined" aria-hidden="true">check</span>{item.title}</span>)}</div>{!report.milestones.length ? <p>{t("growth.report.noRecords")}</p> : null}</section>
    <section><h3>{t("growth.journey")}</h3><ol className="growth-report-history">{report.recent_events.map((item, index) => <li key={`${item.key}-${index}`}><span><strong>{item.title}</strong><time>{new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(item.created_at * 1000)}</time></span><b>{signedGrowthPoints(item.points)}</b></li>)}</ol></section>
  </div>;
}
