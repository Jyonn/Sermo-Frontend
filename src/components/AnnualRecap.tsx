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
  favorite_chat: { chat_id: number; count: number; name: string | null } | null;
  favorite_public_sticker: { uri: string; count: number } | null;
  latest_local_time: string | null;
}

export function AnnualRecap({ name, onClose }: { name: string; onClose: () => void }) {
  const { t, language } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
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
  const through = recap && new Intl.DateTimeFormat(language, {
    month: "long", day: "numeric", timeZone: "Asia/Shanghai",
  }).format(new Date(Date.parse(recap.through) - 1));
  const pages: { title: string; value?: string; body: string; image?: string; detail?: string }[] = recap ? [
    { title: t("recap.dear", { name }), body: t("recap.opening") },
    { title: t("recap.together"), value: number(recap.space_message_count), body: t("recap.togetherBody", { date: through }) },
    ...(recap.favorite_public_sticker ? [{
      title: t("recap.sticker"), image: recap.favorite_public_sticker.uri,
      body: t("recap.stickerBody", { count: number(recap.favorite_public_sticker.count) }),
    }] : []),
    ...(recap.personal_message_count ? [{
      title: t("recap.showedUp"), value: number(recap.personal_message_count),
      body: t("recap.days", { days: number(recap.active_days) }),
    }] : []),
    ...(recap.favorite_chat ? [{
      title: t("recap.favorite"), value: number(recap.favorite_chat.count), body: t("recap.favoriteBody"),
      detail: recap.favorite_chat.name ?? undefined,
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
      {current ? <article className="annual-recap-paper" key={page} aria-live="polite"
        onTouchStart={({ touches }) => {
          const finger = touches.length === 1 ? touches[0] : null;
          gestureStart.current = finger ? { x: finger.clientX, y: finger.clientY } : null;
        }}
        onTouchCancel={() => { gestureStart.current = null; }}
        onTouchEnd={({ changedTouches }) => {
          const start = gestureStart.current;
          gestureStart.current = null;
          const finger = changedTouches[0];
          if (!start || !finger) return;
          const x = finger.clientX - start.x;
          const y = finger.clientY - start.y;
          if (Math.abs(x) < 56 || Math.abs(x) < Math.abs(y) * 1.5) return;
          setPage((index) => Math.max(0, Math.min(pages.length - 1, index + (x < 0 ? 1 : -1))));
        }}
      >
        <h1>{current.title}</h1>
        {current.detail && <strong>{current.detail}</strong>}
        {current.image && <img className="annual-recap-sticker" src={current.image} alt={t("recap.sticker")} />}
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
