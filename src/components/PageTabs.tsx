import type { ReactNode } from "react";
import "./PageTabs.css";

export function PageTabs<T extends string>({ label, items, value, onChange, trailing }: {
  label: string;
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  trailing?: ReactNode;
}) {
  return <div className="app-page-tabs">
    <div className="app-page-tabs-items" role="tablist" aria-label={label}>
      {items.map((item) => <button aria-selected={value === item.value} key={item.value} onClick={() => onChange(item.value)} role="tab" type="button">{item.label}</button>)}
    </div>
    {trailing ? <div className="app-page-tabs-trailing">{trailing}</div> : null}
  </div>;
}
