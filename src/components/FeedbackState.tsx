import type { ReactNode } from "react";

interface FeedbackStateProps {
  title: string;
  description?: string;
  tone?: "neutral" | "empty" | "error" | "success" | "loading";
  icon?: string;
  action?: ReactNode;
}

export function FeedbackState({ title, description, tone = "neutral", icon, action }: FeedbackStateProps) {
  const symbol = icon ?? (tone === "error" ? "error" : tone === "success" ? "task_alt" : tone === "loading" ? "progress_activity" : tone === "empty" ? "inbox" : "info");

  return (
    <div className={`feedback-state ${tone}`} role={tone === "error" ? "alert" : "status"} aria-busy={tone === "loading" || undefined}>
      <div className="feedback-icon" aria-hidden="true">
        <span className="material-symbols-outlined">{symbol}</span>
      </div>
      <div className="feedback-copy">
        <strong>{title}</strong>
        {description ? <div className="detail-text">{description}</div> : null}
      </div>
      {action ? <div className="feedback-actions">{action}</div> : null}
    </div>
  );
}
