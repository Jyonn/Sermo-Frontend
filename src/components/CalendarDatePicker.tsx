import { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/language';
import { calendarDate, defaultDateRange, FIRST_YEAR, LAST_YEAR, MONTH_COUNT, monthDays, monthIndex } from '../lib/calendarDate';
import { SelectControl } from './SettingRow';
import './CalendarDatePicker.css';

const DAYS_PER_WEEK = 7;
const MONTH_CELLS = 42;
const MONTH_HEIGHT = 240;
const yearOptions = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => {
  const year = String(FIRST_YEAR + i);
  return { value: year, label: year };
});
const dayOffsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function CalendarDatePicker({ value, onChange, min, max, onClear, onDone, doneDisabled, error }: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  onClear?: () => void;
  onDone: () => void;
  doneDisabled?: boolean;
  error?: string;
}) {
  const { t, language } = useI18n();
  const today = defaultDateRange().from;
  const selected = value || today;
  const selectedIndex = monthIndex(selected);
  const viewport = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(selectedIndex * MONTH_HEIGHT);
  const visible = Math.min(MONTH_COUNT - 1, Math.round(top / MONTH_HEIGHT));
  const first = Math.max(0, visible - 2);
  const last = Math.min(MONTH_COUNT, visible + 3);
  const current = monthDays(visible);
  const monthName = new Intl.DateTimeFormat(language, { month: 'long' });
  const yearMonthName = new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long' });
  const isOutsideRange = (date: string) => Boolean((min && date < min) || (max && date > max));

  const jump = (index: number) => {
    const nextTop = index * MONTH_HEIGHT;
    viewport.current?.scrollTo({ top: nextTop, behavior: 'instant' });
    setTop(nextTop);
  };
  useLayoutEffect(() => { jump(selectedIndex); }, [selectedIndex]);

  return <div className="calendar-date-picker">
    <div className="calendar-date-jump">
      <button type="button" className="calendar-month-step" aria-label={t('datePicker.previousMonth')} disabled={visible === 0} onClick={() => jump(visible - 1)}>
        <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
      </button>
      <SelectControl compact label={t('datePicker.year')} value={String(current.year)} options={yearOptions} onChange={year => jump((Number(year) - FIRST_YEAR) * 12 + current.month - 1)} />
      <SelectControl compact label={t('datePicker.month')} value={String(current.month)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName.format(new Date(2026, i, 1)) }))} onChange={month => jump((current.year - FIRST_YEAR) * 12 + Number(month) - 1)} />
      <button type="button" className="calendar-month-step" aria-label={t('datePicker.nextMonth')} disabled={visible === MONTH_COUNT - 1} onClick={() => jump(visible + 1)}>
        <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>
    </div>
    <div className="calendar-date-weekdays" aria-hidden="true">
      {Array.from({ length: DAYS_PER_WEEK }, (_, i) => <span key={i}>{new Intl.DateTimeFormat(language, { weekday: 'narrow' }).format(new Date(2026, 10, 2 + i))}</span>)}
    </div>
    <div className="calendar-date-months" ref={viewport} style={{ height: MONTH_HEIGHT }} tabIndex={0} aria-label={t('calendarDate.browse')} onScroll={event => setTop(event.currentTarget.scrollTop)}>
      <div style={{ height: first * MONTH_HEIGHT }} aria-hidden="true" />
      {Array.from({ length: last - first }, (_, i) => first + i).map(index => {
        const { year, month, offset, count } = monthDays(index);
        const firstDate = calendarDate(year, month, 1);
        const firstAvailable = min && min > firstDate ? min : firstDate;
        const tabDate = index === selectedIndex && !isOutsideRange(selected) ? selected : firstAvailable;
        return <section className="calendar-date-month" key={index} style={{ height: MONTH_HEIGHT }} aria-label={yearMonthName.format(new Date(year, month - 1, 1))}>
          <div className="calendar-date-grid">
            {Array.from({ length: MONTH_CELLS }, (_, cell) => {
              const day = cell - offset + 1;
              if (day < 1 || day > count) return <span aria-hidden="true" key={cell} />;
              const date = calendarDate(year, month, day);
              return <button type="button" key={cell} tabIndex={index === visible && date === tabDate ? 0 : -1}
                aria-label={date} aria-pressed={date === value} aria-current={date === today ? 'date' : undefined}
                disabled={isOutsideRange(date)} onClick={() => onChange(date)} onKeyDown={event => {
                  const delta = dayOffsets[event.key];
                  if (!delta) return;
                  event.preventDefault();
                  const next = new Date(year, month - 1, day + delta);
                  const candidate = calendarDate(next.getFullYear(), next.getMonth() + 1, next.getDate());
                  if (next.getFullYear() < FIRST_YEAR || next.getFullYear() > LAST_YEAR || isOutsideRange(candidate)) return;
                  onChange(candidate);
                  requestAnimationFrame(() => viewport.current?.querySelector<HTMLButtonElement>(`button[aria-label="${candidate}"]`)?.focus({ preventScroll: true }));
                }}
              >{day}</button>;
            })}
          </div>
        </section>;
      })}
      <div style={{ height: (MONTH_COUNT - last) * MONTH_HEIGHT }} aria-hidden="true" />
    </div>
    {error ? <p className="calendar-date-error" role="alert">{error}</p> : null}
    <footer className="calendar-date-actions">
      <button className="calendar-date-today" type="button" onClick={() => {
        jump(monthIndex(today));
        if (!isOutsideRange(today)) onChange(today);
      }}>{t('calendarDate.today')}</button>
      {onClear ? <button type="button" className="ghost-button" onClick={onClear}>{t('common.clear')}</button> : null}
      <button type="button" className="button" disabled={doneDisabled} onClick={onDone}>
        <span>{t('common.done')}{value && visible !== selectedIndex ? <time dateTime={value}>{value.split('-').join('/')}</time> : null}</span>
      </button>
    </footer>
  </div>;
}
