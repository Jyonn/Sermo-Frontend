import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useModalFocus } from "../lib/modalFocus";
import "./AnnualRecap.css";

export interface AnnualRecapData {
  year: number;
  through: string;
  space_message_count: number;
  personal_message_count: number;
  active_days: number;
  favorite_chat: { chat_id: number; count: number } | null;
  latest_local_time: string | null;
}

export function AnnualRecap({ name, onClose }: { name: string; onClose: () => void }) {
  const { t, language } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [recap, setRecap] = useState<AnnualRecapData | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  useBodyScrollLock(true);
  useModalFocus(root, true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    api.getAnnualRecap(controller.signal).then(setRecap).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, []);

  const number = (value: number) => new Intl.NumberFormat(language).format(value);
  const lateTime = recap?.latest_local_time && new Intl.DateTimeFormat(language, {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai",
  }).format(new Date(recap.latest_local_time));
  const pages = recap ? [
    { title: t("recap.dear", { name }), body: t("recap.opening") },
    { title: t("recap.together"), value: number(recap.space_message_count), body: t("recap.togetherBody") },
    ...(recap.personal_message_count ? [{
      title: t("recap.showedUp"), value: number(recap.personal_message_count),
      body: t("recap.days", { days: number(recap.active_days) }),
    }] : []),
    ...(recap.favorite_chat ? [{
      title: t("recap.favorite"), value: number(recap.favorite_chat.count), body: t("recap.favoriteBody"),
    }] : []),
    ...(lateTime ? [{ title: t("recap.night"), value: lateTime, body: t("recap.nightBody") }] : []),
    { title: t("recap.untilNext"), body: t("recap.closing") },
  ] : [];
  const current = pages[page];
  const last = page === pages.length - 1;

  return createPortal(
    <div className="annual-recap" role="dialog" aria-modal="true" aria-label={t("recap.title")} ref={root} tabIndex={-1} data-overlay-layer>
      <header className="annual-recap-header">
        <span>{recap?.year ?? 2026} · {t("recap.title")}</span>
        <button type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
      </header>
      {current ? <article className="annual-recap-paper" key={page} aria-live="polite">
        <h1>{current.title}</h1>
        {current.value && <strong className="annual-recap-number">{current.value}</strong>}
        <p>{current.body}</p>
      </article> : <p role={error ? "alert" : "status"}>{t(error ? "recap.loadError" : "common.loading")}</p>}
      {current && <footer className="annual-recap-footer">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("recap.previous")}</button>
        <span>{page + 1} / {pages.length}</span>
        <button type="button" onClick={last ? onClose : () => setPage(page + 1)}>
          {t(last ? "common.close" : page === 0 ? "recap.open" : "recap.next")}
        </button>
      </footer>}
    </div>,
    document.body,
  );
}
