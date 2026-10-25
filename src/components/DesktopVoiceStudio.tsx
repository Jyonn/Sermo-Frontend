import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { useModalFocus } from "../lib/modalFocus";

export function DesktopVoiceStudio({ phase, open, bars, duration, previewPlaying, onStart, onStop, onPreview, onSend, onCancel, onClose, children }: {
  phase: string; open: boolean; bars: number[]; duration: number; previewPlaying: boolean;
  onStart: () => void; onStop: () => void; onPreview: () => void; onSend: () => void; onCancel: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const anchor = useRef<HTMLSpanElement | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [position, setPosition] = useState({left: 0, top: 0});
  useModalFocus(surface, true, () => close.current());
  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const height = surface.current?.offsetHeight ?? 240;
      const width = surface.current?.offsetWidth ?? 286;
      setPosition({left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.top - height - 11, window.innerHeight - height - 12))});
    };
    update();
    const observer = new ResizeObserver(update);
    const composer = anchor.current?.closest(".composer");
    if (composer) observer.observe(composer);
    document.addEventListener("transitionend", update, true);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {observer.disconnect();document.removeEventListener("transitionend", update, true);window.removeEventListener("resize", update);window.removeEventListener("scroll", update, true);};
  }, [phase, open]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !surface.current?.contains(event.target) && !anchor.current?.parentElement?.contains(event.target)) close.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, []);
  const seconds = Math.max(0, Math.round(duration));
  return <><span ref={anchor} hidden/>{createPortal(<div ref={surface} className="desktop-tool-popover is-voice" style={{position:"fixed",left:position.left,top:position.top,bottom:"auto",zIndex:1000,maxHeight:"calc(100dvh - 24px)",overflowY:"auto"}} role="region" aria-label={t("audio.record")}>
    <header><strong>{t("audio.record")}</strong></header>
    <div className={`desktop-voice-studio is-${phase}`}>
      <div className="desktop-voice-waveform" aria-hidden="true">{bars.map((bar, index) => <i key={index} style={{ "--voice-level": `${bar}` } as CSSProperties} />)}</div>
      <time>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</time>
      {!open ? <button className="desktop-voice-main" onClick={onStart} type="button"><span className="material-symbols-outlined">mic</span>{t("composer.startRecording")}</button>
        : phase === "recording" ? <button className="desktop-voice-main is-stop" onClick={onStop} type="button"><span className="material-symbols-outlined">stop</span>{t("audio.stopRecording")}</button>
        : phase === "recorded" ? <div className="desktop-voice-actions"><button onClick={onPreview} type="button"><span className="material-symbols-outlined">{previewPlaying ? "pause" : "play_arrow"}</span>{previewPlaying ? t("audio.pausePreview") : t("audio.preview")}</button><button className="is-send" onClick={onSend} type="button"><span className="material-symbols-outlined">send</span>{t("common.send")}</button></div>
        : <div className="desktop-tool-loading"><span className="composer-recording-spinner" />{phase === "sending" ? t("common.sendingPlain") : phase === "requesting" ? t("audio.preparingMicrophone") : t("audio.generating")}</div>}
      {open && phase !== "sending" ? <button className="desktop-voice-discard" onClick={onCancel} type="button">{t("common.cancel")}</button> : null}
      {children}
    </div>
  </div>, document.body)}</>;
}
