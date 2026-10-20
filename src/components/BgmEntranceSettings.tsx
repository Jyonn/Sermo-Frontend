import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { SettingSelect } from "./SettingRow";
import "./BgmActivity.css";

export function BgmEntranceSettings({ activity, onUpdate }: { activity: ActivityCampaignDTO; onUpdate: (activity: ActivityCampaignDTO) => void }) {
  const { t } = useI18n();
  const data = activity.bgm;
  const [mode, setMode] = useState(data?.mode ?? "off");
  const [track, setTrack] = useState(data?.track ?? "random");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!data?.joined || !data.style) return null;
  const owned = data.tracks.filter((item) => item.owned);
  async function save() {
    if (busy || !data?.style) return;
    setBusy(true); setStatus("");
    try {
      const result = await api.configureBgm(activity.key, data.style, undefined, { mode, track, receive_audio: true });
      if (alive.current) { onUpdate(result); setStatus(t("bgm.settingsSaved")); }
    } catch { if (alive.current) setStatus(t("bgm.saveFailed")); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="bgm-settings">
    <SettingSelect label={t("bgm.entranceMode")} value={mode} onChange={setMode} disabled={busy} options={(["off", "auto", "manual"] as const).map((value) => ({ value, label: t(`bgm.mode.${value}`) }))} />
    {mode === "auto" ? <SettingSelect label={t("bgm.entranceTrack")} value={track} onChange={setTrack} disabled={busy} options={[{ value: "random", label: t("bgm.random") }, ...owned.map((item) => ({ value: item.key, label: item.title }))]} /> : null}
    <p>{t("bgm.playbackHint")}</p>
    <button className="primary-button" disabled={busy || (mode === "manual" && !data.slots.length)} onClick={() => void save()} type="button">{t(busy ? "common.processing" : "common.save")}</button>
    {mode === "manual" && !data.slots.length ? <p>{t("bgm.manualNeedsKeys")}</p> : null}
    {status ? <p role="status">{status}</p> : null}
  </section>;
}
