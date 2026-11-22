import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useModalFocus } from "../lib/modalFocus";
import "./SquareExperience.css";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { DateRangeSummary } from "./DateRangeField";
import { OverlayIconButton } from "./OverlayIconButton";

export function SquareSearchDialog({ open, keyword, from, to, onClose, onApply, onClear }: {
  open: boolean; keyword: string; from: string; to: string;
  onClose: () => void; onApply: (keyword: string, from: string, to: string) => void; onClear: () => void;
}) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState({ keyword, from, to });
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const [date, setDate] = useState("");
  useEffect(() => {
    if (editing) root.current?.querySelector<HTMLElement>('.calendar-date-grid button[tabindex="0"]')?.focus({ preventScroll: true });
  }, [editing]);
  useEffect(() => { if (open) { setDraft({ keyword, from, to }); setError(false); setEditing(null); } }, [open, keyword, from, to]);
  useBodyScrollLock(open);
  useModalFocus(root, open, () => editing ? setEditing(null) : onClose());
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector("input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="dialog-backdrop square-search-modal-backdrop" role="presentation" onClick={onClose}>
    <section className={`square-search-modal${editing ? " is-date-step" : ""}`} ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(editing ? editing === "from" ? "square.dateFrom" : "square.dateTo" : "square.search")} onClick={(event) => event.stopPropagation()}>
      <header><h2>{t(editing ? editing === "from" ? "square.dateFrom" : "square.dateTo" : "square.search")}</h2><OverlayIconButton icon={editing ? "arrow_back" : "close"} aria-label={t(editing ? "common.back" : "common.close")} onClick={() => editing ? setEditing(null) : onClose()} /></header>
      {editing ? <CalendarDatePicker
        value={date}
        onChange={(value) => { setDate(value); setError(false); }}
        error={error ? t("square.dateRangeInvalid") : undefined}
        onClear={() => { setDraft({ ...draft, [editing]: "" }); setEditing(null); setError(false); }}
        onDone={() => {
          const next = { ...draft, [editing]: date };
          if (next.from && next.to && next.from > next.to) { setError(true); return; }
          setDraft(next); setEditing(null); setError(false);
        }}
      /> : <form onInput={() => setError(false)} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const start = String(data.get("date_from") || ""), end = String(data.get("date_to") || "");
        if (start && end && start > end) { setError(true); return; }
        onApply(String(data.get("keyword") || ""), start, end);
      }}>
        <label className="square-search-field"><span>{t("square.keyword")}</span><input name="keyword" type="search" maxLength={100} placeholder={t("square.searchPlaceholder")} value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} /></label>
        <DateRangeSummary legend={t('square.dateRange')} from={draft.from} to={draft.to} onEdit={side => { setDate(draft[side] || new Intl.DateTimeFormat('sv-SE').format(new Date())); setEditing(side); setError(false); }}/>
        <input type="hidden" name="date_from" value={draft.from} /><input type="hidden" name="date_to" value={draft.to} />
        {error ? <p role="alert">{t("square.dateRangeInvalid")}</p> : null}
        <footer><button className="ghost-button" type="button" onClick={onClear}>{t("common.clear")}</button><button className="button" type="submit">{t("square.applySearch")}</button></footer>
      </form>}
    </section>
  </div>, document.body);
}
