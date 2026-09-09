import { useI18n, type TranslationKey } from "../lib/language";

export type DatePickerMode = "year" | "month" | "day";
export type ContentDateRange = {
  earliest_date: string | null;
  latest_date: string | null;
};

type CalendarEntry = { date: string };

type Props<T extends CalendarEntry> = {
  entries: T[];
  loading?: boolean;
  mode?: DatePickerMode;
  modes?: DatePickerMode[];
  month: { year: number; month: number };
  onModeChange?: (mode: DatePickerMode) => void;
  onMonthChange: (month: { year: number; month: number }) => void;
  onSelect: (value: string, entry?: T) => void;
  range?: ContentDateRange | null;
  selected?: string | null;
};

const pad = (value: number) => String(value).padStart(2, "0");
const monthValue = (year: number, month: number) => `${year}-${pad(month)}`;
const dateValue = (year: number, month: number, day: number) => `${monthValue(year, month)}-${pad(day)}`;

function intersectsRange(start: string, end: string, range?: ContentDateRange | null) {
  if (!range) return true;
  if (!range.earliest_date || !range.latest_date) return false;
  return start <= range.latest_date && end >= range.earliest_date;
}

function shiftMonth(current: { year: number; month: number }, delta: number) {
  const serial = current.year * 12 + current.month - 1 + delta;
  return { year: Math.floor(serial / 12), month: ((serial % 12) + 12) % 12 + 1 };
}

function modeLabel(mode: DatePickerMode): TranslationKey {
  return `datePicker.${mode}` as TranslationKey;
}

export function ContentDatePicker<T extends CalendarEntry>({
  entries,
  loading = false,
  mode = "day",
  modes = ["day"],
  month,
  onModeChange,
  onMonthChange,
  onSelect,
  range,
  selected,
}: Props<T>) {
  const { t } = useI18n();
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const earliestYear = range?.earliest_date ? Number(range.earliest_date.slice(0, 4)) : month.year;
  const latestYear = range?.latest_date ? Number(range.latest_date.slice(0, 4)) : month.year;
  const previousMonth = shiftMonth(month, -1);
  const followingMonth = shiftMonth(month, 1);
  const currentMonthStart = `${monthValue(month.year, month.month)}-01`;
  const currentMonthEnd = dateValue(month.year, month.month, new Date(Date.UTC(month.year, month.month, 0)).getUTCDate());
  const previousMonthEnd = dateValue(previousMonth.year, previousMonth.month, new Date(Date.UTC(previousMonth.year, previousMonth.month, 0)).getUTCDate());
  const followingMonthEnd = dateValue(followingMonth.year, followingMonth.month, new Date(Date.UTC(followingMonth.year, followingMonth.month, 0)).getUTCDate());
  const previousEnabled = intersectsRange(`${monthValue(previousMonth.year, previousMonth.month)}-01`, previousMonthEnd, range);
  const nextEnabled = intersectsRange(`${monthValue(followingMonth.year, followingMonth.month)}-01`, followingMonthEnd, range);

  const renderDayGrid = () => {
    const offset = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
    const currentCount = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
      const dayIndex = index - offset + 1;
      if (dayIndex < 1) return <span aria-hidden="true" className="is-leading-blank" key={`blank-${index}`} />;
      const adjacent = dayIndex > currentCount;
      const target = adjacent ? followingMonth : month;
      const day = adjacent ? dayIndex - currentCount : dayIndex;
      const date = dateValue(target.year, target.month, day);
      const entry = byDate.get(date);
      const enabled = Boolean(entry) && intersectsRange(date, date, range);
      return (
        <button
          aria-pressed={selected === date}
          className={`${enabled ? "is-available" : "is-unavailable"}${adjacent ? " is-adjacent" : " is-current"}${selected === date ? " is-selected" : ""}`}
          disabled={!enabled}
          key={date}
          onClick={() => enabled && onSelect(date, entry)}
          type="button"
        >
          {day}
        </button>
      );
    });
  };

  const renderMonthGrid = () => Array.from({ length: 12 }, (_, index) => {
    const candidate = index + 1;
    const value = monthValue(month.year, candidate);
    const end = dateValue(month.year, candidate, new Date(Date.UTC(month.year, candidate, 0)).getUTCDate());
    const enabled = intersectsRange(`${value}-01`, end, range);
    return <button aria-pressed={selected === value} className={selected === value ? "is-selected" : ""} disabled={!enabled} key={value} onClick={() => onSelect(value)} type="button">{t("datePicker.monthNumber", { month: candidate })}</button>;
  });

  const renderYearGrid = () => Array.from({ length: Math.max(0, latestYear - earliestYear + 1) }, (_, index) => earliestYear + index).reverse().map((year) => {
    const value = String(year);
    return <button aria-pressed={selected === value} className={selected === value ? "is-selected" : ""} key={value} onClick={() => onSelect(value)} type="button">{t("datePicker.yearNumber", { year })}</button>;
  });

  return (
    <div className={`content-date-picker is-${mode}${loading ? " is-loading" : ""}`}>
      {modes.length > 1 ? <div className="content-date-picker-modes" role="tablist">
        {modes.map((item) => <button aria-selected={mode === item} className={mode === item ? "is-active" : ""} key={item} onClick={() => onModeChange?.(item)} role="tab" type="button">{t(modeLabel(item))}</button>)}
      </div> : null}
      {mode === "day" ? <>
        <div className="content-date-picker-head">
          <button aria-label={t("datePicker.previousMonth")} disabled={!previousEnabled} onClick={() => onMonthChange(previousMonth)} type="button"><span className="material-symbols-outlined">chevron_left</span></button>
          <strong>{t("messageSearch.yearMonth", { year: month.year, month: month.month })}</strong>
          <button aria-label={t("datePicker.nextMonth")} disabled={!nextEnabled} onClick={() => onMonthChange(followingMonth)} type="button"><span className="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div className="content-date-picker-weekdays">{t("messageSearch.weekdays").split(",").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
        <div className="content-date-picker-days">{renderDayGrid()}</div>
      </> : mode === "month" ? <>
        <div className="content-date-picker-head">
          <button aria-label={t("datePicker.previousYear")} disabled={month.year <= earliestYear} onClick={() => onMonthChange({ ...month, year: month.year - 1 })} type="button"><span className="material-symbols-outlined">chevron_left</span></button>
          <strong>{t("datePicker.yearNumber", { year: month.year })}</strong>
          <button aria-label={t("datePicker.nextYear")} disabled={month.year >= latestYear} onClick={() => onMonthChange({ ...month, year: month.year + 1 })} type="button"><span className="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div className="content-date-picker-periods">{renderMonthGrid()}</div>
      </> : <div className="content-date-picker-periods is-years">{renderYearGrid()}</div>}
    </div>
  );
}
