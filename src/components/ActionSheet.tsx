import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useModalFocus } from "../lib/modalFocus";
import { useI18n } from "../lib/language";
import { InlineAlert } from "./InlineAlert";
import "./InteractionPatterns.css";

export interface SheetAction {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export function ActionSheet({ open, title, description, actions, onClose, compactHeader=false }: { open: boolean; title: string; description?: string; actions: SheetAction[]; onClose: () => void; compactHeader?: boolean }) {
  const { t } = useI18n();
  const titleId = useId();
  const root = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const running = useRef(false);
  useEffect(() => { if (open) setError(false); }, [open]);
  useBodyScrollLock(open);
  useModalFocus(root, open, () => { if (!running.current) onClose(); });
  if (!open) return null;
  async function select(action: SheetAction) {
    if (running.current || action.disabled) return;
    running.current = true; setBusy(action.key); setError(false);
    try { await action.onSelect(); onClose(); }
    catch { setError(true); }
    finally { running.current = false; setBusy(null); }
  }
  return createPortal(<div className="pattern-backdrop" onClick={() => { if (!running.current) onClose(); }} role="presentation">
    <section className={`action-sheet${compactHeader?' has-compact-header':''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={root} onClick={(event) => event.stopPropagation()}>
      <div className="action-sheet-group"><header><h2 id={titleId}>{title}</h2>{description ? <p>{description}</p> : null}</header>
        {actions.map((action) => <button key={action.key} className={action.danger ? "is-danger" : ""} disabled={Boolean(busy) || action.disabled} onClick={() => void select(action)} type="button">
          {action.icon ? <span className="action-sheet-icon" aria-hidden="true">{action.icon}</span> : null}<span><strong>{action.label}</strong>{action.description ? <small>{action.description}</small> : null}</span>{busy === action.key ? <span className="media-wait-spinner" aria-hidden="true" /> : null}
        </button>)}
        {error ? <InlineAlert>{t("patterns.actionFailed")}</InlineAlert> : null}
      </div>
      <button className="action-sheet-cancel" disabled={Boolean(busy)} onClick={onClose} type="button">{t("common.cancel")}</button>
    </section>
  </div>, document.body);
}
