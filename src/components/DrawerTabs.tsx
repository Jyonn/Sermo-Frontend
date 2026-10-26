export function DrawerTabs<T extends string>({ label, items, value, onChange }: {
  label: string;
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return <div className="friend-request-tabs" role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.value} role="tab" type="button"
      aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1}
      className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}
      onKeyDown={(event) => {
        const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + offset + items.length) % items.length;
        onChange(items[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>{item.label}</button>)}
  </div>;
}
