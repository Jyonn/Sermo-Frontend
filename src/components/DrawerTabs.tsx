import type { ReactNode } from "react";

export function DrawerTabs<T extends string>({ label, items, value, onChange, className = "friend-request-tabs" }: {
  label: string;
  items: ReadonlyArray<{ value: T; label: string; content?: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return <div className={className} role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.value} role="tab" type="button"
      aria-label={item.content ? item.label : undefined}
      aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1}
      className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}
      onKeyDown={(event) => {
        const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + offset + items.length) % items.length;
        onChange(items[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>{item.content ?? item.label}</button>)}
  </div>;
}
