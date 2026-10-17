import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import chronelleIcon from "../assets/chronelle-icon.png";
import { ConfirmDialog } from "./ConfirmDialog";

export function ChronellePluginDialog({ open, onClose, userId, calendarId, onChange }: {
  open: boolean; onClose: () => void; userId: number; calendarId?: string; onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const storageKey = `sermo:chronelle-pending:${userId}`;
  const [pending, setPending] = useState(() => sessionStorage.getItem(storageKey) === "1");
  const [busy, setBusy] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const callback = useRef(onChange);
  callback.current = onChange;
  const finish = () => { sessionStorage.removeItem(storageKey); setPending(false); };

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: number;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const result = await api.claimChronelle();
          if (cancelled) return;
          if (result.status !== "pending") {
            sessionStorage.removeItem(storageKey);
            setPending(false);
            if (result.status === "approved" && result.chronelle_calendar_id) callback.current(result.chronelle_calendar_id);
            showToast(t(result.status === "approved" ? "chronelle.bound" : result.status === "denied" ? "chronelle.denied" : "chronelle.expired"));
            return;
          }
        } catch { /* Retry transient failures without interrupting authorization. */ }
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 5000);
    };
    timer = window.setTimeout(() => void poll(), 5000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pending, storageKey, t]);

  const authorize = async () => {
    if (busy) return;
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const result = await api.authorizeChronelle();
      const target = new URL(result.authorize_url);
      if (target.origin !== "https://chronelle.jyonn.space" || !target.hash.startsWith("#/authorize/")) throw new Error(t("chronelle.failed"));
      sessionStorage.setItem(storageKey, "1");
      setPending(true);
      if (popup) popup.location.replace(target.href);
      else window.location.assign(target.href);
    } catch (error) {
      popup?.close();
      showToast(error instanceof Error ? error.message : t("chronelle.failed"), "error");
    } finally { setBusy(false); }
  };
  const unlink = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.unbindChronelle();
      finish();
      onChange("");
      setUnlinkOpen(false);
      showToast(t("chronelle.unbound"));
    } catch (error) { showToast(error instanceof Error ? error.message : t("chronelle.failed"), "error"); }
    finally { setBusy(false); }
  };
  return <>
    <ConfirmDialog open={open && !unlinkOpen} onClose={onClose} onConfirm={() => void authorize()} busy={busy} title={t("chronelle.title")} description={t("chronelle.introduction")} confirmLabel={t(pending ? "chronelle.continue" : "chronelle.manage")}>
      <div className="more-apps-consent">
        <img alt="" src={chronelleIcon} />
        <div><strong>{t("chronelle.publicOnly")}</strong><span>{t("chronelle.description")}</span></div>
        {pending ? <p role="status">{t("chronelle.waiting")}</p> : null}
        {calendarId ? <button className="chronelle-unbind" type="button" disabled={busy} onClick={() => setUnlinkOpen(true)}><span className="material-symbols-outlined" aria-hidden="true">link_off</span>{t("chronelle.unbind")}</button> : null}
      </div>
    </ConfirmDialog>
    <ConfirmDialog open={unlinkOpen} title={t("chronelle.unbind")} description={t("chronelle.unlinkHint")} busy={busy} danger onClose={() => setUnlinkOpen(false)} onConfirm={() => void unlink()} />
  </>;
}
