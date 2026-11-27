import { useRef, useState } from "react";
import { useI18n } from "../lib/language";
import type { SquareStatementMediaDTO } from "../types";
import { usePlaybackWait } from "./MediaWaitFeedback";

export function SquareStatementAudio({ audio, preload = "metadata" }: {
  audio: SquareStatementMediaDTO;
  preload?: "none" | "metadata";
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const audioWait = usePlaybackWait();
  const audioRef = useRef<HTMLAudioElement>(null);

  return <div className="square-statement-audio">
    <button onClick={(event) => {
      event.stopPropagation();
      const player = audioRef.current;
      if (!player) return;
      if (player.paused) {
        if (audioWait.phase === "error") player.load();
        audioWait.start();
        void player.play().catch(audioWait.fail);
      } else player.pause();
    }} type="button" aria-label={audioWait.phase === "error" ? t("common.retry") : audioWait.visible ? t("media.buffering") : playing ? t("media.pause") : t("media.play")}>
      {audioWait.visible && audioWait.phase !== "error" ? <span className="media-wait-spinner" aria-hidden="true" /> : <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>}
    </button>
    <div className="square-audio-wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
    <small>{audioWait.phase === "error" ? t("common.retry") : audio.duration_seconds ? `${audio.duration_seconds}s` : t("square.voice")}</small>
    <audio hidden onEnded={() => { setPlaying(false); audioWait.ready(); }} onError={audioWait.fail}
      onPause={() => { setPlaying(false); audioWait.stop(); }} onPlaying={() => { setPlaying(true); audioWait.ready(); }}
      onStalled={audioWait.waiting} onWaiting={audioWait.waiting} preload={preload} ref={audioRef} src={audio.uri} />
  </div>;
}
