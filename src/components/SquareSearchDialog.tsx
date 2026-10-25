import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useModalFocus } from "../lib/modalFocus";
import "./SquareExperience.css";
import { DateWheelPicker } from "./DateWheelPicker";

export function SquareSearchDialog({ open, keyword, from, to, onClose, onApply, onClear }: {
  open: boolean; keyword: string; from: string; to: string;
  onClose: () => void; onApply: (keyword: string, from: string, to: string) => void; onClear: () => void;
}) {
  const { t, language } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState({ keyword, from, to });
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const [date, setDate] = useState("");
  useEffect(() => {
    if (editing) root.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }, [editing]);
  useEffect(() => { if (open) { setDraft({ keyword, from, to }); setError(false); setEditing(null); } }, [open, keyword, from, to]);
  useBodyScrollLock(open);
  useModalFocus(root, open, () => editing ? setEditing(null) : onClose());
  const format = (value: string, full = false) => new Intl.DateTimeFormat(language, full ? { year: "numeric", month: "long", day: "numeric", weekday: "short" } : { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector("input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="dialog-backdrop square-search-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="square-search-modal" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("square.search")} onClick={(event) => event.stopPropagation()}>
      <header><h2>{t(editing ? editing === "from" ? "square.dateFrom" : "square.dateTo" : "square.search")}</h2><button type="button" className="square-search-close" aria-label={t(editing ? "common.back" : "common.close")} onClick={() => editing ? setEditing(null) : onClose()}><span className="material-symbols-outlined" aria-hidden="true">{editing ? "arrow_back" : "close"}</span></button></header>
      {editing ? <div className="square-date-step">
        <p className="square-date-selected">{format(date, true)}</p>
        <DateWheelPicker value={date} onChange={(value) => { setDate(value); setError(false); }} />
        {error ? <p role="alert">{t("square.dateRangeInvalid")}</p> : null}
        <footer><button type="button" className="ghost-button" onClick={() => { setDraft({ ...draft, [editing]: "" }); setEditing(null); setError(false); }}>{t(editing === "from" ? "square.distantPast" : "square.distantFuture")}</button><button type="button" className="button" onClick={() => {
          const next = { ...draft, [editing]: date };
          if (next.from && next.to && next.from > next.to) { setError(true); return; }
          setDraft(next); setEditing(null); setError(false);
        }}>{t("common.done")}</button></footer>
      </div> : <form onInput={() => setError(false)} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const start = String(data.get("date_from") || ""), end = String(data.get("date_to") || "");
        if (start && end && start > end) { setError(true); return; }
        onApply(String(data.get("keyword") || ""), start, end);
      }}>
        <label className="square-search-field"><span>{t("square.keyword")}</span><input name="keyword" type="search" maxLength={100} placeholder={t("square.searchPlaceholder")} value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} /></label>
        <fieldset className="square-search-range"><legend>{t("square.dateRange")}</legend>
          {(["from", "to"] as const).map((side) => <button type="button" className="square-date-result" key={side} onClick={() => { setDate(draft[side] || new Intl.DateTimeFormat("sv-SE").format(new Date())); setEditing(side); setError(false); }}><span>{t(side === "from" ? "square.dateFrom" : "square.dateTo")}</span><strong>{draft[side] ? format(draft[side]) : t(side === "from" ? "square.distantPast" : "square.distantFuture")}</strong><small>{draft[side] ? format(draft[side], true) : t("square.unboundedDate")}</small></button>)}
          <span className="square-date-arrow material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </fieldset>
        <input type="hidden" name="date_from" value={draft.from} /><input type="hidden" name="date_to" value={draft.to} />
        {error ? <p role="alert">{t("square.dateRangeInvalid")}</p> : null}
        <footer><button className="ghost-button" type="button" onClick={onClear}>{t("common.clear")}</button><button className="button" type="submit">{t("square.applySearch")}</button></footer>
      </form>}
    </section>
  </div>, document.body);
}
