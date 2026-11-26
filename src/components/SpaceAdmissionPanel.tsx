import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { copyText } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { SpaceAdmissionSettings, SpaceJoinApplication, SpaceJoinMode } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { PageTabs } from "./PageTabs";
import { SelectControl, SettingGroup } from "./SettingRow";
import "../pages/SpaceAdmission.css";

const modes = ["open", "invite", "approval"] as const;

export function SpaceAdmissionPanel() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SpaceAdmissionSettings | null>(null);
  const [mode, setMode] = useState<SpaceJoinMode>("open");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api.getAdminAdmission(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setSettings(result);
      setMode(result.mode);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [retry]);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.updateAdminAdmission(rotate ? "invite" : mode, rotate);
      setSettings(result);
      setMode(result.mode);
      setRotate(false);
      showToast(t("admission.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally { setBusy(false); }
  }

  async function copyCode() {
    if (!settings?.invite_code) return;
    try {
      if (await copyText(settings.invite_code)) showToast(t("admission.copied"));
      else showToast(t("admission.copyFailed"), "error");
    } catch { showToast(t("admission.copyFailed"), "error"); }
  }

  return <section className="management-form-page space-admission-panel">
    <section className="management-settings-group">
      <h2>{t("admission.method")}</h2>
      {settings ? <>
        <SettingGroup>
          <SelectControl label={t("admission.method")} value={mode} disabled={busy} onChange={value => setMode(value as SpaceJoinMode)}
            options={modes.map(value => ({ value, label: t(`admission.mode.${value}`) }))} />
        </SettingGroup>
        <p className="space-admission-caption">{t(`admission.modeHint.${mode}`)}</p>
        {settings.mode !== mode && <button type="button" className="button" disabled={busy}
          onClick={() => void save()}>{t(busy ? "common.processing" : "common.save")}</button>}
      </> : <FeedbackState tone={error ? "error" : "loading"} title={error || t("common.loading")}
        action={error ? <button className="ghost-button" onClick={() => setRetry(value => value + 1)}>{t("common.retry")}</button> : undefined} />}
      {error && settings && !rotate && <p className="join-admission-error" role="alert">{error}</p>}
    </section>
    {settings?.mode === "invite" && mode === "invite" && <section className="management-settings-group">
      <h2>{t("admission.code")}</h2>
      <div className="space-admission-code">
        <code>{settings.invite_code}</code>
        <button type="button" className="ghost-button" disabled={!settings.invite_code} onClick={() => void copyCode()}>
          <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>{t("common.copy")}
        </button>
        <button type="button" className="ghost-button" disabled={busy} onClick={() => { setError(""); setRotate(true); }}>{t("admission.rotate")}</button>
      </div>
    </section>}
    {settings && <JoinApplicationQueue />}
    <ConfirmDialog open={rotate} busy={busy} title={t("admission.rotate")} description={t("admission.rotateHint")}
      confirmLabel={t("admission.rotate")} onClose={() => { if (!busy) setRotate(false); }} onConfirm={() => void save()}>
      {error && <p className="join-admission-error" role="alert">{error}</p>}
    </ConfirmDialog>
  </section>;
}

function JoinApplicationQueue() {
  const { t, language } = useI18n();
  const [status, setStatus] = useState<"pending" | "reviewed">("pending");
  const [items, setItems] = useState<SpaceJoinApplication[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ item: SpaceJoinApplication; decision: "approve" | "reject" } | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const date = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });

  function load(before?: number) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    api.getAdminJoinApplications(status, before, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setItems(previous => before === undefined ? result.items : [...previous, ...result.items]);
      setNext(result.next_before);
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [status]);

  async function decide() {
    if (!review || busy) return;
    setBusy(true);
    setReviewError("");
    try {
      await api.reviewAdminJoinApplication(review.item.id, review.decision);
      setItems(rows => rows.filter(row => row.id !== review.item.id));
      setReview(null);
      load();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally { setBusy(false); }
  }

  return <section className="management-settings-group admission-review">
    <header className="admission-review-header">
      <h2>{t("admission.applications")}</h2>
      <button type="button" className="ghost-button" disabled={loading} onClick={() => load()}>
        <span className="material-symbols-outlined" aria-hidden="true">refresh</span>{t("management.refresh")}
      </button>
    </header>
    <PageTabs label={t("admission.applications")} value={status}
      onChange={value => { if (status !== value) { setItems([]); setNext(null); setStatus(value); } }}
      items={[{ value: "pending", label: t("admission.reviewPending") }, { value: "reviewed", label: t("admission.reviewed") }]} />
    {loading && !items.length && <FeedbackState tone="loading" title={t("common.loading")} />}
    {!loading && !error && !items.length && <FeedbackState tone="empty" icon="how_to_reg"
      title={t(status === "pending" ? "admission.noPending" : "admission.noReviewed")} />}
    {error && <FeedbackState tone="error" title={error} action={<button className="ghost-button" onClick={() => load(next ?? undefined)}>{t("common.retry")}</button>} />}
    <ul className="admission-review-list">
      {items.map(item => <li key={item.id}>
        <div className="admission-review-copy">
          <strong>{item.name}</strong>
          <small>{date.format(item.created_at * 1000)} · {t(`admission.status.${item.status}`)}</small>
          {item.note && <p>{item.note}</p>}
        </div>
        {item.status === "pending" && <div className="admission-review-actions">
          {(["reject", "approve"] as const).map(decision => <button key={decision} type="button"
            className={decision === "approve" ? "button" : "ghost-button"} onClick={() => { setReviewError(""); setReview({ item, decision }); }}>
            {t(`admission.${decision}`)}
          </button>)}
        </div>}
      </li>)}
    </ul>
    {next !== null && !error && <button type="button" className="ghost-button" disabled={loading} onClick={() => load(next)}>{t("common.loadMore")}</button>}
    <ConfirmDialog open={Boolean(review)} busy={busy} danger={review?.decision === "reject"}
      title={t(review?.decision === "approve" ? "admission.approveName" : "admission.rejectName", { name: review?.item.name ?? "" })}
      description={t(review?.decision === "approve" ? "admission.approveHint" : "admission.rejectHint")}
      confirmLabel={t(review?.decision === "approve" ? "admission.approve" : "admission.reject")}
      onClose={() => { if (!busy) setReview(null); }} onConfirm={() => void decide()}>
      {reviewError && <p className="join-admission-error" role="alert">{reviewError}</p>}
    </ConfirmDialog>
  </section>;
}
