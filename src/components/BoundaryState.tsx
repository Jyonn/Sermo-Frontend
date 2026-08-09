import type { ReactNode } from "react";

interface ContentLoaderProps {
  label: string;
  rows?: number;
  variant?: "list" | "compact";
}

export function ContentLoader({ label, rows = 2, variant = "list" }: ContentLoaderProps) {
  return (
    <div className={`content-loader is-${variant}`} role="status" aria-live="polite">
      <div className="content-loader-signal" aria-hidden="true"><i /><i /><i /></div>
      <span>{label}</span>
      {variant === "list" ? (
        <div className="content-loader-rows" aria-hidden="true">
          {Array.from({ length: rows }, (_, index) => (
            <i key={index}><b /><span><b /><b /></span></i>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface QuietStateProps {
  action?: ReactNode;
  description?: string;
  icon?: string;
  title: string;
}

export function QuietState({ action, description, icon = "more_horiz", title }: QuietStateProps) {
  return (
    <div className="quiet-state">
      <span className="quiet-state-mark material-symbols-outlined" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="quiet-state-action">{action}</div> : null}
    </div>
  );
}
