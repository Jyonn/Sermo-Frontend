import { useEffect, useState, useSyncExternalStore } from "react";
import { SideDrawer } from "./SideDrawer";
import { useI18n } from "../lib/language";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { showToast } from "../lib/toast";
import {
  chatLayoutDiagnosticsReport,
  clearChatLayoutDiagnostics,
  getChatLayoutDiagnostics,
  subscribeChatLayoutDiagnostics,
  setChatLayoutDiagnosticsEnabled,
  setChatLayoutDiagnosticsRecording,
} from "../lib/chatLayoutDiagnostics";

export function GlobalChatLayoutDiagnostics() {
  const { t } = useI18n();
  const { debuggerVisible, enabled, recording, entries } = useSyncExternalStore(subscribeChatLayoutDiagnostics, getChatLayoutDiagnostics, getChatLayoutDiagnostics);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { session } = useAuth();
  const verified = Boolean(session?.user.verified);

  useEffect(() => {
    if (!verified && enabled) setChatLayoutDiagnosticsEnabled(false);
  }, [verified, enabled]);

  const upload = async () => {
    setUploading(true);
    try {
      await api.uploadDebugReport(JSON.parse(chatLayoutDiagnosticsReport()));
      showToast(t("diagnostics.uploaded"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("diagnostics.uploadFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  if (!verified || (!debuggerVisible && !enabled && !open)) return null;

  return <>
    {!open ? <button aria-label={t("diagnostics.open")} className={`chat-diagnostics-fab${enabled && recording ? " is-recording" : ""}`} onClick={() => setOpen(true)} type="button">
      <span className="material-symbols-outlined" aria-hidden="true">bug_report</span>
      <span>{entries.length}</span>
    </button> : null}
    <SideDrawer historyKey="chat-diagnostics" onClose={() => setOpen(false)} open={open} title={t("diagnostics.title")}>
      <div className="chat-diagnostics-panel">
        <div className="chat-diagnostics-recorder">
          <span className={enabled && recording ? "is-recording" : ""}><i aria-hidden="true" />{t(!enabled ? "diagnostics.noEvent" : recording ? "diagnostics.recording" : "diagnostics.paused")}</span>
          <button disabled={!enabled} onClick={() => setChatLayoutDiagnosticsRecording(!recording)} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">{recording ? "pause" : "fiber_manual_record"}</span>
            {t(recording ? "diagnostics.pause" : "diagnostics.start")}
          </button>
        </div>
        <p>{t("diagnostics.privacy")}</p>
        <div className="chat-diagnostics-actions">
          <button disabled={!entries.length || uploading} onClick={() => void upload()} type="button">{t(uploading ? "diagnostics.uploading" : "diagnostics.upload")}</button>
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
