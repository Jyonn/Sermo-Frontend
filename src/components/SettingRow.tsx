import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/language';
import { useBodyScrollLock } from '../lib/bodyLock';
import { useModalFocus } from '../lib/modalFocus';
import './SelectControl.css';

export type SettingRowTone = "default" | "danger";

export function SettingGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`setting-group ${className}`.trim()}>{children}</div>;
}

export function SettingSwitch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <button aria-label={label} aria-pressed={checked} className={`switch${checked ? " active" : ""}`} disabled={disabled} onClick={() => onChange(!checked)} type="button" />;
}

export function SettingRow({
  className = "",
  description,
  disabled = false,
  icon,
  locked,
  onClick,
  title,
  tone = "default",
  trailing,
  value,
}: {
  className?: string;
  description?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  locked?: ReactNode;
  onClick?: () => void;
  title: ReactNode;
  tone?: SettingRowTone;
  trailing?: ReactNode;
  value?: ReactNode;
}) {
  const content = <>
    {icon ? <span className="setting-row-icon">{icon}</span> : null}
    <span className="setting-row-copy"><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
    <span className="setting-row-trailing">
      {locked ? <span className="setting-row-lock"><span className="material-symbols-outlined" aria-hidden="true">lock</span>{locked}</span> : null}
      {value !== undefined ? <span className="setting-row-value">{value}</span> : null}
      {trailing ?? (onClick ? <span className="material-symbols-outlined setting-row-chevron" aria-hidden="true">chevron_right</span> : null)}
    </span>
  </>;
  const classes = `setting-row tone-${tone}${disabled ? " is-disabled" : ""}${onClick ? " is-action" : ""} ${className}`.trim();
  return onClick ? <button className={classes} disabled={disabled} onClick={onClick} type="button">{content}</button> : <div className={classes}>{content}</div>;
}

export function SelectControl<T extends string>({ disabled = false, label, onChange, options, value, compact = false, onOpen, triggerLabel }: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void | Promise<void>;
  options: Array<{ label: string; value: T }>;
  value: T;
  compact?: boolean;
  onOpen?: () => void;
  triggerLabel?: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const running = useRef(false);
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const selected = options.find(option => option.value === value);
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const close = () => { if (!running.current) setOpen(false); };
  useBodyScrollLock(open);
  useModalFocus(root, open, close);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  function show() {
    if (disabled || !options.length) return;
    onOpen?.(); setQuery(''); setError(false); setOpen(true);
  }
  async function choose(next: T) {
    if (running.current || disabled) return;
    if (next === value) { setOpen(false); return; }
    running.current = true; setBusy(true); setError(false);
    try { await onChange(next); setOpen(false); }
    catch { setError(true); }
    finally { running.current = false; setBusy(false); }
  }
  return <>
    <button className={`setting-select setting-select-trigger${compact ? ' is-compact' : ' is-row'}${disabled ? ' is-disabled' : ''}`} aria-label={`${label}: ${selected?.label || t('select.choose')}`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled || !options.length} type="button" onClick={show} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); }
    }}>
      {!compact && <span className="setting-select-label">{label}</span>}
      <span className="setting-select-value">{triggerLabel ?? (selected?.label || t('select.choose'))}</span><span className="material-symbols-outlined setting-row-chevron" aria-hidden="true">chevron_right</span>
    </button>
    {open && createPortal(<div className="dialog-backdrop option-picker-backdrop" role="presentation" onClick={event => { event.stopPropagation(); close(); }}>
      <section ref={root} tabIndex={-1} className="option-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <header><h2 id={titleId}>{label}</h2><button type="button" className="option-picker-close" disabled={busy} aria-label={t('common.close')} onClick={close}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
        {options.length > 8 && <label className="option-picker-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><input aria-label={t('select.search')} placeholder={t('select.search')} value={query} onChange={event => setQuery(event.target.value)} disabled={busy}/></label>}
        <div className="option-picker-list" role="listbox" aria-label={label} aria-busy={busy} onKeyDown={event => {
          if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
          event.preventDefault();
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
          if (!items.length) return;
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
          items[next]?.focus();
        }}>{visible.map(option => <button type="button" key={option.value} role="option" aria-selected={option.value === value} disabled={busy || disabled} onClick={() => void choose(option.value)}><span>{option.label}</span><span className="material-symbols-outlined" aria-hidden="true">{option.value === value ? 'check' : ''}</span></button>)}
          {!visible.length && <p>{t('select.empty')}</p>}
        </div>
        {error && <p className="option-picker-error" role="alert">{t('patterns.actionFailed')}</p>}
        {busy && <p className="option-picker-status" role="status">{t('common.processing')}</p>}
      </section>
    </div>, document.body)}
  </>;
}

export function SettingSelect<T extends string>(props: Parameters<typeof SelectControl<T>>[0]) {
  return <SelectControl {...props} />;
}
