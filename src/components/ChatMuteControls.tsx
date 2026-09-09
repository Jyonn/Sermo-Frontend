import { useEffect, useState } from "react";
import { useI18n, type TranslationKey } from "../lib/language";
import type { ChatMuteDuration, ChatMuteState } from "../types";

const durationOptions: ChatMuteDuration[] = ["10s", "2m", "10m", "1h", "6h", "1d", "7d", "permanent"];

export function ChatMuteControls({
  busy,
  mute,
  onMute,
  onUnmute,
}: {
  busy: boolean;
  mute?: ChatMuteState;
  onMute: (duration: ChatMuteDuration) => void;
  onUnmute: () => void;
}) {
  const { t } = useI18n();
  const [duration, setDuration] = useState<ChatMuteDuration>("10m");

  useEffect(() => setDuration("10m"), [mute?.active, mute?.muted_until, mute?.permanent]);

  return (
    <div className="chat-mute-controls">
      {mute?.active ? (
        <div className="chat-mute-current">
          <span className="material-symbols-outlined">voice_over_off</span>
          <span><strong>{t("chat.memberMuted")}</strong><small>{mute.permanent ? t("chat.muteDuration.permanent") : t("chat.mutedUntil", { time: new Date((mute.muted_until ?? 0) * 1000).toLocaleString() })}</small></span>
        </div>
      ) : null}
      <div className="chat-mute-duration-grid">
        {durationOptions.map((item) => (
          <button className={duration === item ? "is-active" : ""} disabled={busy} key={item} onClick={() => setDuration(item)} type="button">
            {t(`chat.muteDuration.${item}` as TranslationKey)}
          </button>
        ))}
      </div>
      <button className="button chat-mute-confirm" disabled={busy} onClick={() => onMute(duration)} type="button">
        {busy ? t("common.saving") : mute?.active ? t("chat.updateMute") : t("chat.muteMember")}
      </button>
      {mute?.active ? <button className="chat-mute-remove" disabled={busy} onClick={onUnmute} type="button">{t("chat.unmuteMember")}</button> : null}
    </div>
  );
}
