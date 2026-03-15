import type { ReactNode } from "react";

interface FeedbackStateProps {
  title: string;
  description?: string;
  tone?: "neutral" | "error" | "success" | "loading";
  action?: ReactNode;
}

export function FeedbackState({ title, description, tone = "neutral", action }: FeedbackStateProps) {
  const icon = tone === "error" ? "error" : tone === "success" ? "task_alt" : tone === "loading" ? "progress_activity" : "info";

  return (
    <div className={`feedback-state ${tone}`}>
      <div className="feedback-icon" aria-hidden="true">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="feedback-copy">
        <strong>{title}</strong>
        {description ? <div className="detail-text">{description}</div> : null}
      </div>
      {action ? <div className="feedback-actions">{action}</div> : null}
    </div>
  );
}
