import { useEffect, useState } from "react";
import { useI18n } from "../lib/language";
import "./MediaWaitFeedback.css";

export type MediaWaitPhase = "idle" | "loading" | "buffering" | "error";

export function useDelayedMediaWait(phase: MediaWaitPhase, delay = 300) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (phase !== "loading" && phase !== "buffering") return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [phase, delay]);
  return phase === "error" || visible;
}

export function usePlaybackWait() {
  const [phase, setPhase] = useState<MediaWaitPhase>("idle");
  return {
    phase,
    visible: useDelayedMediaWait(phase),
    start: () => setPhase("loading"),
    ready: () => setPhase("idle"),
    waiting: () => setPhase("buffering"),
    stop: () => setPhase((current) => current === "error" ? current : "idle"),
    fail: () => setPhase("error"),
  };
}

export function MediaWaitFeedback({ phase, onRetry, loadingLabel }: { phase: MediaWaitPhase; onRetry?: () => void; loadingLabel?: string }) {
  const { t } = useI18n();
  const visible = useDelayedMediaWait(phase);
  if (!visible || phase === "idle") return null;
  return <div className={`media-wait-feedback is-${phase}`} onClick={(event) => event.stopPropagation()} role={phase === "error" ? "alert" : "status"}>
    {phase === "error" ? <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span> : <span className="media-wait-spinner" aria-hidden="true" />}
    <span>{phase === "loading" && loadingLabel ? loadingLabel : t(phase === "loading" ? "media.loadingOriginal" : phase === "buffering" ? "media.buffering" : "media.loadFailed")}</span>
    {phase === "error" && onRetry ? <button onClick={onRetry} type="button">{t("common.retry")}</button> : null}
  </div>;
}
