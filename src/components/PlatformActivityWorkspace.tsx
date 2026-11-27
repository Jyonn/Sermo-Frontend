import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { PlatformActivityDTO } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { ManagementFilter, ManagementSearch, ManagementToolbar } from "./ManagementWorkspace";
import "./ActivityCampaignCard.css";
import "./PlatformActivityWorkspace.css";

export function PlatformActivityWorkspace() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<PlatformActivityDTO[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [candidate, setCandidate] = useState<PlatformActivityDTO>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = (item: PlatformActivityDTO) => language.startsWith("zh") ? item.title : item.title_en || item.title;
  const edit = (count: number) => t("activity.edition", { count });
  const date = (value: number) => new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value * 1000));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void api.getPlatformActivities(controller.signal)
      .then(next => { if (!controller.signal.aborted) setItems(next); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const visible = items.filter(item =>
    (filter === "all" || item.status === filter) &&
    `${item.title} ${item.title_en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ).sort((first, second) => Number(second.status === "available") - Number(first.status === "available"));
  async function publish() {
    if (!candidate || saving) return;
    setSaving(true);
    setError("");
    try {
      setItems(await api.publishActivityRerun(candidate.key));
      showToast(t("activity.rerun.published", { edition: edit(candidate.edition + 1) }), "success");
      setCandidate(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("activity.rerun.failed"));
      setRefresh(current => current + 1);
    } finally {
      setSaving(false);
    }
  }
  return <section className="management-list-page platform-activity-workspace">
    <ManagementToolbar description={t("activity.rerun.adminHint")}>
      <ManagementSearch label={t("activity.rerun.search")} query={query} onChange={setQuery} />
      <ManagementFilter label={t("activity.rerun.filter")} value={filter} options={[
        { value: "all", label: t("activity.rerun.all") },
        { value: "available", label: t("activity.rerun.status.available") },
        { value: "permanent", label: t("activity.rerun.status.permanent") },
      ]} onChange={setFilter} />
    </ManagementToolbar>
    {loading && <FeedbackState tone="loading" title={t("common.loading")} />}
    {failed && <FeedbackState tone="error" title={t("management.pageLoadFailed")} action={
      <button type="button" className="ghost-button" onClick={() => setRefresh(current => current + 1)}>{t("common.retry")}</button>
    } />}
    {!loading && !failed && !visible.length && <FeedbackState tone="empty" icon="event_repeat" title={t("activity.rerun.empty")} />}
    <div className="platform-activity-catalog" aria-busy={loading}>
      {visible.map(item => <article key={item.key} className="platform-activity-row">
        <div className="platform-activity-main">
          <header><h2>{title(item)}</h2><span className="activity-edition-label">{edit(item.edition)}</span></header>
          <p>{t(`activity.rerun.status.${item.status}`)}{item.status === "still_running" ? ` · ${t("activity.rerun.activeSpaces", { count: item.active_spaces })}` : ""}</p>
          <small>{t("activity.rerun.joinedSpaces", { count: item.joined_spaces })}{item.last_end ? ` · ${t("activity.rerun.lastEnd", { date: date(item.last_end) })}` : ""}</small>
        </div>
        {item.status === "available" && <button type="button" className="ghost-button" onClick={() => { setError(""); setCandidate(item); }}>
          <span className="material-symbols-outlined" aria-hidden="true">event_repeat</span>{t("activity.rerun.publish")}
        </button>}
        {!!item.previous_editions.length && <details>
          <summary>{t("activity.rerun.history")}</summary>
          <ul>{item.previous_editions.map(prior => <li key={prior.key}>
            <strong>{edit(prior.edition)}</strong><span>{t("activity.rerun.joinedSpaces", { count: prior.joined_spaces })}{prior.last_end ? ` · ${date(prior.last_end)}` : ""}</span>
          </li>)}</ul>
        </details>}
      </article>)}
    </div>
    <ConfirmDialog open={!!candidate} title={t("activity.rerun.publish")} confirmLabel={t("activity.rerun.confirm")}
      busy={saving} onClose={() => { if (!saving) setCandidate(undefined); }} onConfirm={() => void publish()}
      description={candidate ? t("activity.rerun.confirmHint", {
        title: title(candidate), edition: edit(candidate.edition + 1),
        count: Math.ceil((candidate.duration_seconds ?? 0) / 86400),
      }) : ""}>
      {error && <p role="alert">{error}</p>}
    </ConfirmDialog>
  </section>;
}
