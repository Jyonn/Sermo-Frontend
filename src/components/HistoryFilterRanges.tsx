import { useState } from 'react';
import { historyDay } from '../lib/historyManagement';
import { useI18n } from '../lib/language';
import { BottomSheet } from './BottomSheet';
import { CalendarDatePicker } from './CalendarDatePicker';
import { DateRangeSummary } from './DateRangeField';
import { OverlayIconButton } from './OverlayIconButton';

type Range = { from: string; to: string };
type RangeProps = { value: Range; onChange: (value: Range) => void };

const allDay: Range = { from: '', to: '' };
const daytime: Range = { from: '10:00', to: '18:00' };
const timeParts = (length: number) => Array.from({ length }, (_, i) => String(i).padStart(2, '0'));
const hours = timeParts(24);
const minutes = timeParts(60);

export function HistoryDateRange({ value, onChange }: RangeProps) {
  const { t } = useI18n();
  const [side, setSide] = useState<keyof Range | null>(null);
  const [draft, setDraft] = useState('');

  const edit = (key: keyof Range) => {
    const today = historyDay(Date.now() / 1000);
    const fallback = key === 'from' && value.to && today > value.to ? value.to
      : key === 'to' && value.from && today < value.from ? value.from : today;
    setDraft(value[key] || fallback);
    setSide(key);
  };
  const finish = (date: string) => {
    if (!side) return;
    onChange({ ...value, [side]: date });
    setSide(null);
  };

  return <div className="history-range-panel history-date-range">
    <DateRangeSummary from={value.from} to={value.to} onEdit={edit} legend={t('square.dateRange')} />
    <BottomSheet
      open={side !== null}
      title={t(side === 'from' ? 'square.dateFrom' : 'square.dateTo')}
      className="selection-sheet"
      onClose={() => setSide(null)}
      footer={<footer className="history-range-sheet-actions">
        <button className="ghost-button" type="button" onClick={() => finish('')}>{t('common.clear')}</button>
        <button className="button" type="button" onClick={() => finish(draft)}>{t('common.done')}</button>
      </footer>}
    >
      <CalendarDatePicker value={draft} onChange={setDraft} min={side === 'to' ? value.from : undefined} max={side === 'from' ? value.to : undefined} />
    </BottomSheet>
  </div>;
}

function HistoryTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const [hour, minute] = (value || ':').split(':');
  return <fieldset className="history-clock">
    <legend>{label}</legend>
    <div className="history-clock-fields">
      <label>
        <span>{t('historyManager.hour')}</span>
        <select value={hour} aria-label={`${label} · ${t('historyManager.hour')}`} onChange={event => onChange(`${event.target.value}:${minute || '00'}`)}>
          <option value="" disabled>–</option>
          {hours.map(item => <option key={item}>{item}</option>)}
        </select>
      </label>
      <span className="history-clock-separator" aria-hidden="true">:</span>
      <label>
        <span>{t('historyManager.minute')}</span>
        <select value={minute} aria-label={`${label} · ${t('historyManager.minute')}`} onChange={event => onChange(`${hour || '00'}:${event.target.value}`)}>
          <option value="" disabled>–</option>
          {minutes.map(item => <option key={item}>{item}</option>)}
        </select>
      </label>
      <OverlayIconButton icon="backspace" disabled={!value} aria-label={`${t('common.clear')} · ${label}`} onClick={() => onChange('')} />
    </div>
  </fieldset>;
}

export function HistoryTimeRange({ value, onChange }: RangeProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const { from, to } = draft;
  const invalid = Boolean(from && from === to);
  const overnight = Boolean(from && to && from > to);
  const summary = value.from || value.to
    ? `${value.from || '–'} – ${value.to || '–'}`
    : t('historyManager.allDay');

  return <div className="history-range-panel history-time-range">
    <span className="history-range-label">{t('historyManager.daily')}</span>
    <button className="history-time-result" type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`${t('historyManager.daily')} · ${summary}`} onClick={() => { setDraft(value); setOpen(true); }}>
      <span className="history-time-icon material-symbols-outlined" aria-hidden="true">schedule</span>
      <span><strong>{summary}</strong><small>{t(value.from && value.to && value.from > value.to ? 'historyManager.overnight' : 'historyManager.timeZone')}</small></span>
      <span className="material-symbols-outlined history-time-arrow" aria-hidden="true">chevron_right</span>
    </button>
    <BottomSheet
      open={open}
      title={t('historyManager.daily')}
      className="selection-sheet history-clock-sheet"
      onClose={() => setOpen(false)}
      footer={<footer className="history-range-sheet-actions">
        <button className="ghost-button" type="button" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        <button className="button" type="button" disabled={invalid} onClick={() => { onChange(draft); setOpen(false); }}>{t('common.done')}</button>
      </footer>}
    >
      <div className="history-clock-editor">
        <div className="history-clock-presets">
          <button type="button" aria-pressed={!from && !to} onClick={() => setDraft(allDay)}>{t('historyManager.allDay')}</button>
          <button type="button" aria-pressed={from === daytime.from && to === daytime.to} onClick={() => setDraft(daytime)}>10:00–18:00</button>
        </div>
        <HistoryTimeInput label={t('historyManager.timeFrom')} value={from} onChange={next => setDraft({ ...draft, from: next })} />
        <HistoryTimeInput label={t('historyManager.timeTo')} value={to} onChange={next => setDraft({ ...draft, to: next })} />
        {invalid ? <p className="history-clock-error" role="alert">{t('historyManager.invalidTimes')}</p> :
          <p className="history-clock-hint" aria-live="polite">{t('historyManager.timeHint')}{overnight ? ` · ${t('historyManager.overnight')}` : ''}</p>}
      </div>
    </BottomSheet>
  </div>;
}
