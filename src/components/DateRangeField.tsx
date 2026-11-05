import {defaultDateRange} from '../lib/calendarDate';
import { useState } from 'react';
import { useI18n } from '../lib/language';
import { BottomSheet } from './BottomSheet';
import { CalendarDatePicker } from './CalendarDatePicker';
import './SquareExperience.css';
import './SelectionSheet.css';

export function DateRangeSummary({ from, to, onEdit, legend, startLabel, endLabel }: {
  from: string; to: string; onEdit: (side: 'from' | 'to') => void; legend?: string; startLabel?: string; endLabel?: string;
}) {
  const { t, language } = useI18n();
  const format = (value: string, full = false) => new Intl.DateTimeFormat(language, full
    ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
    : { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
  return <fieldset className="square-search-range">
    {legend && <legend>{legend}</legend>}
    {(['from', 'to'] as const).map(side => {
      const value = side === 'from' ? from : to;
      return <button type="button" className="square-date-result" key={side} onClick={() => onEdit(side)}>
        <span>{side === 'from' ? startLabel || t('square.dateFrom') : endLabel || t('square.dateTo')}</span>
        <strong>{value ? format(value) : t('calendarDate.unset')}</strong>
        <small>{value ? format(value, true) : t('calendarDate.select')}</small>
      </button>;
    })}
    <span className="square-date-arrow material-symbols-outlined" aria-hidden="true">chevron_right</span>
  </fieldset>;
}

export type ResearchDateRange = { from:string; to:string };

export function DateRangeField({value,onChange}:{value?:ResearchDateRange;onChange?:(value:ResearchDateRange)=>void} = {}) {
  const { t } = useI18n();
  const [local, setLocal] = useState(defaultDateRange);
  const range=value??local;
  const setRange=(next:ResearchDateRange|((current:ResearchDateRange)=>ResearchDateRange))=>{
    const result=typeof next==='function'?next(range):next;
    setLocal(result);onChange?.(result);
  };
  const [side, setSide] = useState<'from' | 'to' | null>(null);
  const [draft, setDraft] = useState(range.from);
  const [error, setError] = useState(false);
  return <div className="research-date-field">
    <DateRangeSummary from={range.from} to={range.to} startLabel={t('research.start')} endLabel={t('research.end')} onEdit={key => {
      setSide(key); setDraft(range[key] || range.from); setError(false);
    }}/>
    <input type="hidden" name="start" value={range.from}/><input type="hidden" name="end" value={range.to}/>
    <BottomSheet open={side !== null} className="selection-sheet" title={t(side === 'from' ? 'research.start' : 'research.end')} onClose={() => setSide(null)}>
      <div className="research-date-editor"><CalendarDatePicker value={draft} onChange={value => { setDraft(value); setError(false); }}/>
        {error && <p className="research-error" role="alert">{t('square.dateRangeInvalid')}</p>}
        <footer>
          <button type="button" className="button" onClick={() => {
            if (!side) return;
            const next = { ...range, [side]: draft };
            if (next.to && next.to < next.from) { setError(true); return; }
            setRange(next); setSide(null);
          }}>{t('common.done')}</button></footer>
      </div>
    </BottomSheet>
  </div>;
}
