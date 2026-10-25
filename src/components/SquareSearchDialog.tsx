import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useModalFocus } from "../lib/modalFocus";
import "./SquareExperience.css";

export function SquareSearchDialog({ open, keyword, from, to, onClose, onApply, onClear }: {
  open: boolean; keyword: string; from: string; to: string;
  onClose: () => void; onApply: (keyword: string, from: string, to: string) => void; onClear: () => void;
}) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState({ keyword, from, to });
  const [error, setError] = useState(false);
  useEffect(() => { if (open) { setDraft({ keyword, from, to }); setError(false); } }, [open, keyword, from, to]);
  useBodyScrollLock(open);
  useModalFocus(root, open, onClose);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector("input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="dialog-backdrop square-search-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="square-search-modal" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("square.search")} onClick={(event) => event.stopPropagation()}>
      <header><h2>{t("square.search")}</h2><button type="button" className="square-search-close" aria-label={t("common.close")} onClick={onClose}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
      <form onInput={() => setError(false)} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const start = String(data.get("date_from") || ""), end = String(data.get("date_to") || "");
        if (start && end && start > end) { setError(true); return; }
        onApply(String(data.get("keyword") || ""), start, end);
      }}>
        <label className="square-search-field"><span>{t("square.keyword")}</span><input name="keyword" type="search" maxLength={100} placeholder={t("square.searchPlaceholder")} value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} /></label>
        <fieldset className="square-search-range"><legend>{t("square.dateRange")}</legend>
          <label className="square-search-field"><span>{t("square.dateFrom")}</span><input name="date_from" type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
          <label className="square-search-field"><span>{t("square.dateTo")}</span><input name="date_to" type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        </fieldset>
        <p className="square-search-range-hint">{t("square.dateRangeHint")}</p>
        {error ? <p role="alert">{t("square.dateRangeInvalid")}</p> : null}
        <footer><button className="ghost-button" type="button" onClick={onClear}>{t("common.clear")}</button><button className="button" type="submit">{t("square.applySearch")}</button></footer>
      </form>
    </section>
  </div>, document.body);
}
