import { useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import { ChronelleCalendar } from "./ChronelleCalendar";
import { ConfirmDialog } from "./ConfirmDialog";
import { InputDialog } from "./InputDialog";
import { SideDrawer } from "./SideDrawer";

export function ChronellePluginDrawer({ open, onClose, onRouteOpen, calendarId, onChange }: {
  open: boolean; onClose: () => void; onRouteOpen: () => void;
  calendarId?: string; onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const [inputOpen, setInputOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (unlink: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      let id = "";
      if (unlink) await api.unbindChronelle();
      else id = (await api.bindChronelle(url)).chronelle_calendar_id;
      onChange(id);
      setInputOpen(false);
      setUnlinkOpen(false);
      setUrl("");
      showToast(t(unlink ? "chronelle.unbound" : "chronelle.bound"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chronelle.failed"), "error");
    } finally { setBusy(false); }
  };
  return <>
    <SideDrawer historyKey="chronelle" open={open} onClose={onClose} onRouteOpen={onRouteOpen} title={t("chronelle.title")}>
      <div className="more-apps-drawer">
        <p className="row-subtle">{t("chronelle.description")}</p>
        <button className="button" disabled={busy} type="button" onClick={() => setInputOpen(true)}>{t(calendarId ? "chronelle.replace" : "chronelle.bind")}</button>
        {calendarId ? <div><ChronelleCalendar calendarId={calendarId} /><button className="button danger" disabled={busy} type="button" onClick={() => setUnlinkOpen(true)}>{t("chronelle.unbind")}</button></div> : null}
      </div>
    </SideDrawer>
    <InputDialog open={inputOpen} title={t("chronelle.bind")} description={t("chronelle.linkHint")} placeholder="https://chronelle.jyonn.space/#/share/…" value={url} maxLength={1000} busy={busy} onChange={setUrl} onClose={() => { if (!busy) setInputOpen(false); }} onConfirm={() => { if (url.trim()) void save(false); }} />
    <ConfirmDialog open={unlinkOpen} title={t("chronelle.unbind")} description={t("chronelle.unlinkHint")} busy={busy} danger onClose={() => { if (!busy) setUnlinkOpen(false); }} onConfirm={() => void save(true)} />
  </>;
}
