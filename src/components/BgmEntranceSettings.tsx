import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { SettingGroup, SettingRow, SettingSelect, SettingSwitch } from "./SettingRow";
import "./BgmActivity.css";

export function BgmEntranceSettings({ activity, onUpdate }: { activity: ActivityCampaignDTO; onUpdate: (activity: ActivityCampaignDTO) => void }) {
  const { t } = useI18n();
  const data = activity.bgm;
  const [mode, setMode] = useState(data?.mode ?? "off");
  const [track, setTrack] = useState(data?.track ?? "random");
  const [receiveAudio, setReceiveAudio] = useState(data?.receive_audio ?? true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const saving = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!data?.joined || !data.style) return null;
  const owned = data.tracks.filter((item) => item.owned);
  async function save(next: { mode?: typeof mode; track?: string; receive_audio?: boolean }) {
    if (saving.current || !data?.style) return;
    saving.current = true;
    setBusy(true); setStatus("");
    try {
      const result = await api.configureBgm(activity.key, data.style, undefined, { mode, track, receive_audio: receiveAudio, ...next });
      if (alive.current) {
        setMode(result.bgm?.mode ?? mode);
        setTrack(result.bgm?.track ?? track);
        setReceiveAudio(result.bgm?.receive_audio ?? receiveAudio);
        onUpdate(result);
      }
    } catch (error) { if (alive.current) setStatus(t("bgm.saveFailed")); throw error; }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="bgm-settings">
    <SettingGroup>
    <SettingRow title={t("bgm.receiveAudio")} trailing={<SettingSwitch checked={receiveAudio} disabled={busy} label={t("bgm.receiveAudio")} onChange={value => { void save({ receive_audio: value }).catch(() => {}); }} />} />
    <SettingSelect label={t("bgm.entranceMode")} value={mode} onChange={value => save({ mode: value })} disabled={busy} options={(["off", "auto", ...(data.slots.length ? ["manual" as const] : [])] as const).map((value) => ({ value, label: t(`bgm.mode.${value}`) }))} />
    {mode === "auto" ? <SettingSelect label={t("bgm.entranceTrack")} value={track} onChange={value => save({ track: value })} disabled={busy} options={[{ value: "random", label: t("bgm.random") }, ...owned.map((item) => ({ value: item.key, label: item.title }))]} /> : null}
    </SettingGroup>
    <p>{t("bgm.playbackHint")}</p>
    {!data.slots.length ? <p>{t("bgm.manualNeedsKeys")}</p> : null}
    {busy ? <p role="status">{t("common.processing")}</p> : null}
    {status ? <p role="status">{status}</p> : null}
  </section>;
}
