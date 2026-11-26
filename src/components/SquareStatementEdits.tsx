import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { SquareStatementDTO, SquareStatementRevision } from "../types";
import { ContentLoader } from "./BoundaryState";
import { SideDrawer } from "./SideDrawer";
import "./SquareStatementEdits.css";

export function SquareEditedLabel({ onHistory }: { onHistory: () => void }) {
  const { t } = useI18n();
  return <button className="square-edited-label" type="button" aria-label={t("square.editHistory")}
    onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onHistory(); }}>
    {t("square.edited")}
  </button>;
}

export function SquareStatementEditor({ statement, limit, onClose }: {
  statement: SquareStatementDTO; limit: number; onClose: () => void;
}) {
  const { t } = useI18n();
  const [base, setBase] = useState(statement);
  const [text, setText] = useState(statement.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const count = Array.from(text).length;
  const assets = statement.media.length + Number(Boolean(statement.external_media || statement.chat_record));
  const canSave = text.trim() !== base.text && count <= limit && (Boolean(assets) || Boolean(text.trim()));

  async function save() {
    if (!canSave || busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      await api.editSquareStatement(statement.statement_id, text.trim(), base.edit_revision ?? 0);
      showToast(t("square.editedSaved"));
      onClose();
    } catch (e) {
      const stale = e instanceof ApiError && e.status === 409;
      setConflict(stale);
      setError(stale ? t("square.editConflict") : e instanceof Error ? e.message : t("square.editFailed"));
    } finally { setBusy(false); }
  }

  async function fetchLatest() {
    setBusy(true);
    try {
      const latest = await api.getSquareStatement(statement.statement_id);
      setBase(latest);
      setConflict(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("square.editFailed"));
    } finally { setBusy(false); }
  }

  return <SideDrawer open className="square-statement-edit-drawer" historyKey="square-edit-statement"
    title={t("square.editStatement")} onClose={() => { if (!busy) onClose(); }}>
    <form className="square-editor square-statement-edit" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="square-editor-body">
        {error && <p className="square-inline-error" role="alert">{error}</p>}
        {conflict && <button type="button" className="ghost-button" disabled={busy} onClick={() => void fetchLatest()}>{t("square.reviewLatestEdit")}</button>}
        {base !== statement && <blockquote className="square-edit-current"><strong>{t("square.latestEdit")}</strong>
          <p>{base.text || t("square.noCaption")}</p>
        </blockquote>}
        <textarea aria-label={t("square.saySomething")} placeholder={t("square.saySomething")} value={text}
          onChange={event => setText(event.target.value)} disabled={busy} />
        <div className="square-edit-meta">
          {assets > 0 && <span><span className="material-symbols-outlined" aria-hidden="true">attachment</span>{t("square.editKeepsAttachments")}</span>}
          <span className={count > limit ? "square-edit-over-limit" : undefined}>{count} / {limit}</span>
        </div>
      </div>
      <footer className="square-editor-footer">
        <button type="submit" disabled={busy || !canSave || conflict}>{t(busy ? "common.processing" : "common.save")}</button>
      </footer>
    </form>
  </SideDrawer>;
}

export function SquareStatementHistory({ statementId, onClose }: { statementId: number; onClose: () => void }) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState<SquareStatementRevision[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const date = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });

  function load(before?: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    api.getSquareStatementHistory(statementId, before, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setRows(previous => before === undefined ? result.items : [...previous, ...result.items]);
      setNext(result.next_before);
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }

  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [statementId]);

  return <SideDrawer open className="square-statement-history" historyKey="square-statement-history" title={t("square.editHistory")} onClose={onClose}>
    {loading && !rows.length && <ContentLoader label={t("common.loading")} rows={3} />}
    <ol className="square-history-list">
      {rows.map((row, index) => <li key={row.revision}>
        <header><strong>{t(index === 0 ? "square.latestEdit" : row.revision === 0 ? "square.originalEdit" : "square.previousEdit")}</strong>
          <time dateTime={new Date(row.published_at * 1000).toISOString()}>{date.format(row.published_at * 1000)}</time></header>
        <p>{row.text || t("square.noCaption")}</p>
      </li>)}
    </ol>
    {error && <p className="square-inline-error" role="alert">{error}</p>}
    {(error || next !== null) && <button className="ghost-button" type="button" disabled={loading} onClick={() => load(next ?? undefined)}>
      {t(error ? "common.retry" : "common.loadMore")}
    </button>}
  </SideDrawer>;
}
