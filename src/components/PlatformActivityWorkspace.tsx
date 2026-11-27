import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { PlatformActivityRerunDTO } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { ManagementToolbar } from "./ManagementWorkspace";
import { PageTabs } from "./PageTabs";
import "./ActivityCampaignCard.css";
import "./PlatformActivityWorkspace.css";

export function PlatformActivityWorkspace() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<PlatformActivityRerunDTO[]>([]);
  const [filter, setFilter] = useState<"pending" | "history">("pending");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [candidate, setCandidate] = useState<{ item: PlatformActivityRerunDTO; approved: boolean }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = (item: PlatformActivityRerunDTO) => language.startsWith("zh") ? item.title : item.title_en || item.title;
  const edit = (count: number) => t("activity.edition", { count });
  const date = (value: number) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(new Date(value * 1000));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void api.getActivityRerunRequests(controller.signal)
      .then(next => { if (!controller.signal.aborted) setItems(next); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const pending = items.filter(item => item.status === "pending").length;
  const visible = items.filter(item => (filter === "pending") === (item.status === "pending"));
  async function review() {
    if (!candidate || saving) return;
    setSaving(true);
    setError("");
    try {
      setItems(await api.reviewActivityRerun(candidate.item.id, candidate.approved, candidate.item.revision));
      showToast(t(candidate.approved ? "activity.rerun.approved" : "activity.rerun.rejected"), "success");
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
      <PageTabs label={t("management.activities")} value={filter} onChange={setFilter} items={[
        { value: "pending", label: `${t("activity.rerun.pending")}${pending ? ` · ${pending}` : ""}` },
        { value: "history", label: t("activity.rerun.history") },
      ]} />
    </ManagementToolbar>
    {loading && <FeedbackState tone="loading" title={t("common.loading")} />}
    {failed && <FeedbackState tone="error" title={t("management.pageLoadFailed")} action={
      <button type="button" className="ghost-button" onClick={() => setRefresh(current => current + 1)}>{t("common.retry")}</button>
    } />}
    {!loading && !failed && !visible.length && <FeedbackState tone="empty" icon="event_repeat" title={t("activity.rerun.empty")} />}
    <div className="platform-activity-catalog" aria-busy={loading}>
      {visible.map(item => <article key={item.id} className="platform-activity-row">
        <div className="platform-activity-main">
          <header><h2>{title(item)}</h2><span className="activity-edition-label">{edit(item.next_edition)}</span></header>
          <p>{item.space_name}{item.status !== "pending" ? ` · ${t(`activity.rerun.reviewStatus.${item.status}`)}` : ""}</p>
          <small>{t("activity.rerun.submittedAt", { date: date(item.submitted_at) })}{item.ended_at ? ` · ${t("activity.rerun.endedAt", { date: date(item.ended_at) })}` : ""}</small>
        </div>
        {item.status === "pending" && <div className="management-row-actions">
          {[false, true].map(approved => <button key={String(approved)} type="button" className={approved ? "button" : "ghost-button"}
            onClick={() => { setError(""); setCandidate({ item, approved }); }}>
            {t(approved ? "activity.rerun.approve" : "activity.rerun.reject")}
          </button>)}
        </div>}
      </article>)}
    </div>
    <ConfirmDialog open={!!candidate} title={t(candidate?.approved ? "activity.rerun.approve" : "activity.rerun.reject")}
      confirmLabel={t("common.confirm")} danger={candidate?.approved === false}
      busy={saving} onClose={() => { if (!saving) setCandidate(undefined); }} onConfirm={() => void review()}
      description={candidate ? t(candidate.approved ? "activity.rerun.confirmApprove" : "activity.rerun.confirmReject", {
        title: title(candidate.item), space: candidate.item.space_name, edition: edit(candidate.item.next_edition),
      }) : ""}>
      {error && <p role="alert">{error}</p>}
    </ConfirmDialog>
  </section>;
}
