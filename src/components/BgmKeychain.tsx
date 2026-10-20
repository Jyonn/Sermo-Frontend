import type { ActivityCampaignDTO } from "../types";
import { BGM_KEY_CENTERS, bgmKeyState } from "../lib/bgmEntrance";
import { useI18n } from "../lib/language";
import "./BgmActivity.css";

export function BgmKeychain({ style, slots = [], tracks = [], onPress, playingKey, disabled = false }: {
  style: "blue" | "pink"; slots?: string[];
  tracks?: NonNullable<ActivityCampaignDTO["bgm"]>["tracks"];
  onPress?: (key: string) => void; playingKey?: string | null; disabled?: boolean;
}) {
  const { t } = useI18n();
  return <div className={`bgm-keychain is-${style}`}>
    <span className="bgm-device-brand" aria-hidden="true">Frienden<small>{t("bgm.deviceBrand")}</small></span>
    {BGM_KEY_CENTERS[style].map(([left, top], index) => {
      const track = tracks.find((item) => item.key === slots[index]);
      const state = bgmKeyState(track, playingKey);
      const props = { className: `bgm-key is-${state}`, style: { left: `${left}%`, top: `${top}%` } };
      return onPress ? <button {...props} key={index} disabled={state === "inactive" || disabled} aria-pressed={state === "playing"} aria-label={state === "inactive" ? t("bgm.emptySlot", { number: index + 1 }) : t(state === "playing" ? "bgm.stopPlayback" : "bgm.playTrack", { title: track!.title })} onClick={() => track && onPress(track.key)} type="button"><span>{index + 1}</span>{state === "playing" ? <i className="bgm-key-equalizer" aria-hidden="true"><i /><i /><i /></i> : null}</button> : <span {...props} key={index} aria-hidden="true">{index + 1}</span>;
    })}
  </div>;
}
