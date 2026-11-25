import { useEffect, useRef, useState, type ReactNode } from "react";
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
  monthly_message_counts?: number[];
  conversation_count?: number;
  square?: { posts: number; comments: number; received_likes: number } | null;
}

const shanghai = "Asia/Shanghai";

function RecapIcon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function RecapTotals({ entries }: { entries: { value: string; label: string }[] }) {
  return <dl className="annual-recap-totals">{entries.map(({ value, label }) => (
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  ))}</dl>;
}

function RecapMonthlyChart({ counts, year, through }: { counts: number[]; year: number; through: Date }) {
  const { t, locale } = useI18n();
  const max = Math.max(1, ...counts);
  const [monthSelected, setMonthSelected] = useState(() => Math.max(0, counts.indexOf(max)));
  const formatMonth = new Intl.DateTimeFormat(locale, { month: "long", timeZone: shanghai });
  const lastMonth = Number(new Intl.DateTimeFormat("en", { month: "numeric", timeZone: shanghai }).format(through)) - 1;
  const numbers = new Intl.NumberFormat(locale);
  const monthTotal = (month: number) => {
    const label = formatMonth.format(new Date(Date.UTC(year, month, 15)));
    return month > lastMonth
      ? t("recap.pendingMonth", { month: label })
      : t("recap.monthTotal", { month: label, count: numbers.format(counts[month]) });
  };
  return <figure className="annual-recap-chart">
    <figcaption>{t("recap.monthly")}<span aria-live="polite">{monthTotal(monthSelected)}</span></figcaption>
    <ol>{counts.map((count, month) => (
      <li key={month}>
        <button type="button" className="annual-recap-chart-month"
          aria-label={monthTotal(month)} aria-pressed={monthSelected === month}
          onClick={() => setMonthSelected(month)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            const neighbor = event.key === "ArrowLeft"
              ? event.currentTarget.parentElement?.previousElementSibling
              : event.currentTarget.parentElement?.nextElementSibling;
            const button = neighbor?.querySelector("button");
            button?.focus();
            button?.click();
          }}>
          <span className="annual-recap-chart-track" aria-hidden="true">
            <span style={{ height: `${count / max * 100}%` }} />
          </span>
          <span aria-hidden="true">{numbers.format(month + 1)}</span>
        </button>
      </li>
    ))}</ol>
  </figure>;
}

export function AnnualRecap({ name, spaceName, onClose }: { name: string; spaceName?: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const [recap, setRecap] = useState<AnnualRecapData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [stickerFailed, setStickerFailed] = useState(false);
  useBodyScrollLock(true);
  useModalFocus(root, true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    api.getAnnualRecap(controller.signal).then((result) => {
      if (!controller.signal.aborted) setRecap(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [attempt]);

  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  // The API interval excludes `through`, which may be midnight at the cutoff.
  const through = recap && new Date(Date.parse(recap.through) - 1);
  const throughLabel = through && new Intl.DateTimeFormat(locale, {
    month: "long", day: "numeric", timeZone: shanghai,
  }).format(through);
  const lateTime = recap?.latest_local_time && new Intl.DateTimeFormat(locale, {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: shanghai,
  }).format(new Date(recap.latest_local_time));
  const pages: { id: string; section: string; title: string; content: ReactNode }[] = recap && through ? [
    {
      id: "cover", section: t("recap.to", { name }), title: t("recap.title"),
      content: <p className="annual-recap-letter">{t("recap.opening")}</p>,
    },
    {
      id: "chat", section: t("recap.chatsSection"), title: t("recap.chatTitle"),
      content: <>
        <RecapTotals entries={[
          { label: t("recap.myMessages"), value: number(recap.personal_message_count) },
          { label: t("recap.activeDays"), value: number(recap.active_days) },
          { label: t("recap.spaceMessages"), value: number(recap.space_message_count) },
        ]} />
        {recap.monthly_message_counts?.length === 12 && recap.personal_message_count > 0 && (
          <RecapMonthlyChart counts={recap.monthly_message_counts} year={recap.year} through={through} />
        )}
        {!recap.personal_message_count && <p>{t("recap.noChats")}</p>}
      </>,
    },
    ...(recap.favorite_chat ? [{
      id: "conversations", section: t("recap.chatsSection"), title: t("recap.favorite"),
      content: <>
        <div className="annual-recap-favorite">
          <RecapIcon name="forum" />
          <strong>{recap.favorite_chat.name || t("recap.untitledChat")}</strong>
          <span>{t("recap.chatSent", { count: number(recap.favorite_chat.count) })}</span>
        </div>
        <RecapTotals entries={[
          ...(recap.conversation_count !== undefined
            ? [{ label: t("recap.conversationCount"), value: number(recap.conversation_count) }] : []),
          ...(lateTime ? [{ label: t("recap.lateLabel"), value: lateTime }] : []),
        ]} />
      </>,
    }] : []),
    ...(recap.square && (recap.square.posts || recap.square.comments || recap.square.received_likes) ? [{
      id: "square", section: t("recap.squareSection"), title: t("recap.squareTitle"),
      content: <RecapTotals entries={[
        { label: t("recap.squarePosts"), value: number(recap.square.posts) },
        { label: t("recap.squareComments"), value: number(recap.square.comments) },
        { label: t("recap.squareLikes"), value: number(recap.square.received_likes) },
      ]} />,
    }] : []),
    ...(recap.favorite_public_sticker ? [{
      id: "sticker", section: t("recap.spaceSection"), title: t("recap.sticker"),
      content: <div className="annual-recap-postcard">
        {!stickerFailed && <img src={recap.favorite_public_sticker.uri} alt={t("recap.sticker")} onError={() => {
          setStickerFailed(true);
        }} />}
        <p>{t("recap.stickerBody", { count: number(recap.favorite_public_sticker.count) })}</p>
      </div>,
    }] : []),
    {
      id: "closing", section: t("recap.from"), title: t("recap.untilNext"),
      content: <p className="annual-recap-letter">{t("recap.closing")}</p>,
    },
  ] : [];
  const current = pages[page];
  const last = page === pages.length - 1;
  const move = (offset: number) => setPage((index) => Math.max(0, Math.min(pages.length - 1, index + offset)));

  return createPortal(
    <div className="annual-recap" role="dialog" aria-modal="true" aria-label={t("recap.title")} ref={root} tabIndex={-1} data-overlay-layer
      onKeyDown={(event) => {
        if (!current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}>
      <div className="annual-recap-frame" data-chapter={current?.id}>
        <div className="annual-recap-art" aria-hidden="true">
          <span className="annual-recap-art-brand">Frienden</span>
          {recap && <span className="annual-recap-art-year">{recap.year}</span>}
        </div>
        <div className="annual-recap-sheet">
          <header className="annual-recap-header">
            <span><RecapIcon name="mail" />{t("recap.title")}</span>
            <button type="button" className="annual-recap-close" onClick={onClose} aria-label={t("common.close")}>
              <span className="annual-recap-back"><RecapIcon name="arrow_back" /></span>
              <span className="annual-recap-x"><RecapIcon name="close" /></span>
            </button>
          </header>
          {current ? <article className="annual-recap-paper" key={current.id} aria-live="polite"
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
              if (Math.abs(x) >= 56 && Math.abs(x) >= Math.abs(y) * 1.5) move(x < 0 ? 1 : -1);
            }}>
            <p className="annual-recap-kicker">{current.section}</p>
            <h1>{current.title}</h1>
            {current.content}
          </article> : <div className="annual-recap-paper annual-recap-status">
            <p role={error ? "alert" : "status"}>{t(error ? "recap.loadError" : "common.loading")}</p>
            {error && <button className="annual-recap-primary" type="button" onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}>{t("common.retry")}</button>}
          </div>}
          {current && <footer className="annual-recap-footer">
            <div className="annual-recap-meta">
              <span>{spaceName || t("brand.yanlang")} · {t("recap.through", { date: throughLabel })}</span>
              <span aria-label={t("recap.pageNumber", { page: page + 1, total: pages.length })}>{page + 1} / {pages.length}</span>
            </div>
            <div className="annual-recap-progress" aria-hidden="true">
              {pages.map(({ id }, index) => <span key={id} data-progress={index < page ? "past" : index === page ? "current" : "next"} />)}
            </div>
            <div className="annual-recap-controls">
              <button type="button" className="annual-recap-previous" disabled={page === 0} onClick={() => move(-1)}>
                <RecapIcon name="arrow_back" />{t("recap.previous")}
              </button>
              <button type="button" className="annual-recap-primary" onClick={last ? onClose : () => move(1)}>
                {t(last ? "common.close" : page === 0 ? "recap.open" : "recap.next")}
                <RecapIcon name={last ? "check" : "arrow_forward"} />
              </button>
            </div>
          </footer>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
