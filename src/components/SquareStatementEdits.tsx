import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n, type TranslationKey } from "../lib/language";
import type { SquareStatementRevision } from "../types";
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

  return <SideDrawer open showTitle className="square-statement-history" historyKey="square-statement-history" title={t("square.editHistory")} onClose={onClose}>
    {loading && !rows.length && <ContentLoader label={t("common.loading")} rows={3} />}
    <ol className="square-history-list">
      {rows.map((row, index) => <li key={row.revision}>
        <header><strong>{t(index === 0 ? "square.latestEdit" : row.revision === 0 ? "square.originalEdit" : "square.previousEdit")}</strong>
          <time dateTime={new Date(row.published_at * 1000).toISOString()}>{date.format(row.published_at * 1000)}</time></header>
        <p>{row.text || t("square.noCaption")}</p>
        {row.changes?.some(field => field !== "text") && <small className="square-history-changes">
          {t("square.historyChanges", { fields: row.changes.filter(field => field !== "text")
            .map(field => t(`square.editField.${field}` as TranslationKey)).join(" · ") })}
        </small>}
      </li>)}
    </ol>
    {error && <p className="square-inline-error" role="alert">{error}</p>}
    {(error || next !== null) && <button className="ghost-button" type="button" disabled={loading} onClick={() => load(next ?? undefined)}>
      {t(error ? "common.retry" : "common.loadMore")}
    </button>}
  </SideDrawer>;
}
