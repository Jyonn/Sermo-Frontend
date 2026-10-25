import { useEffect, useId, useRef } from "react";
import { useI18n } from "../lib/language";
import { daysInMonth, wheelDate } from "../lib/dateWheel";

function Wheel({ label, values, value, onChange }: { label: string; values: number[]; value: number; onChange: (value: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const index = values.indexOf(value);
  const scrolling = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    if (!scrolling.current) root.current?.scrollTo({ top: index * 44, behavior: "instant" });
  }, [index, values.length]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <div className="date-wheel-column"><span>{label}</span><div ref={root} className="date-wheel-scroll" role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={`${id}-${value}`} onKeyDown={(event) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : event.key === "PageDown" ? 5 : event.key === "PageUp" ? -5 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : Math.max(0, Math.min(values.length - 1, index + delta));
    scrolling.current = false;
    change.current(values[next]);
  }} onScroll={() => {
    scrolling.current = true;
    clearTimeout(timer.current);
    const next = Math.max(0, Math.min(values.length - 1, Math.round((root.current?.scrollTop || 0) / 44)));
    if (values[next] !== value) change.current(values[next]);
    timer.current = setTimeout(() => {
      scrolling.current = false;
    }, 100);
  }}>{values.map((item, i) => <div id={`${id}-${item}`} key={item} role="option" aria-selected={item === value} className={item === value ? "is-selected" : ""} onClick={() => { scrolling.current = false; change.current(item); root.current?.scrollTo({ top: i * 44, behavior: "instant" }); }}>{item}</div>)}</div></div>;
}

export function DateWheelPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const [year, month, day] = value.split("-").map(Number);
  const start = Math.min(1900, year), end = Math.max(new Date().getFullYear() + 100, year);
  return <div className="date-wheel-picker">
    <Wheel label={t("datePicker.year")} values={Array.from({ length: end - start + 1 }, (_, i) => start + i)} value={year} onChange={(next) => onChange(wheelDate(next, month, day))} />
    <Wheel label={t("datePicker.month")} values={Array.from({ length: 12 }, (_, i) => i + 1)} value={month} onChange={(next) => onChange(wheelDate(year, next, day))} />
    <Wheel label={t("datePicker.day")} values={Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)} value={day} onChange={(next) => onChange(wheelDate(year, month, next))} />
  </div>;
}
