import type { ReactNode } from "react";
import "./InteractionPatterns.css";

export function InlineAlert({ id, children, tone = "error", action }: { id?: string; children: ReactNode; tone?: "error" | "success" | "info"; action?: ReactNode }) {
  return <div id={id} className={`inline-alert is-${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span aria-hidden="true" className="material-symbols-outlined">{tone === "error" ? "error" : tone === "success" ? "check_circle" : "info"}</span>
    <div>{children}</div>{action ? <span className="inline-alert-action">{action}</span> : null}
  </div>;
}
