import { useEffect, useRef, type ReactNode } from "react";

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

export function SettingSelect<T extends string>({ disabled = false, label, onChange, options, value }: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void | Promise<void>;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) menuRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <SettingRow title={label} trailing={
    <details className={`setting-select${disabled ? " is-disabled" : ""}`} ref={menuRef}>
      <summary aria-disabled={disabled} aria-label={`${label}: ${selected.label}`} onClick={(event) => { if (disabled) event.preventDefault(); }}><span>{selected.label}</span><span className="material-symbols-outlined" aria-hidden="true">expand_more</span></summary>
      <div className="setting-select-options" role="listbox" aria-label={label}>{options.map((option) => <button aria-selected={option.value === value} key={option.value} onClick={() => { menuRef.current?.removeAttribute("open"); if (option.value !== value) void onChange(option.value); }} role="option" type="button"><span>{option.label}</span><i aria-hidden="true">{option.value === value ? "✓" : ""}</i></button>)}</div>
    </details>
  } />;
}
