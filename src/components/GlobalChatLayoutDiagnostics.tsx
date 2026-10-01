import { useState, useSyncExternalStore } from "react";
import { SideDrawer } from "./SideDrawer";
import { useI18n } from "../lib/language";
import { copyText } from "../lib/presentation";
import { showToast } from "../lib/toast";
import {
  chatLayoutDiagnosticsReport,
  clearChatLayoutDiagnostics,
  getChatLayoutDiagnostics,
  subscribeChatLayoutDiagnostics,
} from "../lib/chatLayoutDiagnostics";

export function GlobalChatLayoutDiagnostics() {
  const { t } = useI18n();
  const { enabled, entries } = useSyncExternalStore(subscribeChatLayoutDiagnostics, getChatLayoutDiagnostics, getChatLayoutDiagnostics);
  const [open, setOpen] = useState(false);

  if (!enabled && !open) return null;

  return <>
    {enabled && !open ? <button aria-label={t("diagnostics.open")} className="chat-diagnostics-fab" onClick={() => setOpen(true)} type="button">
      <span className="material-symbols-outlined" aria-hidden="true">bug_report</span>
      <span>{entries.length}</span>
    </button> : null}
    <SideDrawer historyKey="chat-diagnostics" onClose={() => setOpen(false)} open={open} title={t("diagnostics.title")}>
      <div className="chat-diagnostics-panel">
        <p>{t("diagnostics.privacy")}</p>
        <div className="chat-diagnostics-actions">
          <button disabled={!entries.length} onClick={() => void copyText(chatLayoutDiagnosticsReport()).then((copied) => showToast(t(copied ? "diagnostics.copied" : "common.copyFailed"), copied ? "success" : "error"))} type="button">{t("diagnostics.copy")}</button>
          <button disabled={!entries.length} onClick={clearChatLayoutDiagnostics} type="button">{t("common.clear")}</button>
        </div>
        {entries.length ? <ol className="chat-diagnostics-events">
          {[...entries].reverse().map((entry, index) => <li key={`${entry.elapsed}-${index}`}>
            <time>{new Date(entry.at).toLocaleTimeString()}</time>
            <strong>{entry.event}</strong>
            <code>{JSON.stringify(entry.metrics)}</code>
          </li>)}
        </ol> : <p className="chat-diagnostics-empty">{t("diagnostics.empty")}</p>}
      </div>
    </SideDrawer>
  </>;
}
