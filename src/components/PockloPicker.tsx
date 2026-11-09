import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { POCKLO_ORIGIN, pockloPickerMessage } from "../lib/pockloPicker";

export function PockloPicker({ onBrowse, onSelect }: {
  onBrowse: () => void;
  onSelect: (url: string) => boolean;
}) {
  const { t } = useI18n();
  const iframe = useRef<HTMLIFrameElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [notice, setNotice] = useState<"loading" | "unavailable" | "blocked" | "sendFailed" | null>("loading");

  useEffect(() => {
    const frame = iframe.current;
    if (!frame) return;
    const target = frame.contentWindow;
    let ready = false;
    let delivered = false;
    const timeout = window.setTimeout(() => setNotice("unavailable"), 8000);
    function receive(event: MessageEvent) {
      const message = pockloPickerMessage(event, target);
      if (!message || delivered) return;
      if (message.type === "ready") {
        ready = true;
        window.clearTimeout(timeout);
        target?.postMessage({ type: "pocklo.picker.init", version: 1 }, POCKLO_ORIGIN);
        setNotice(null);
      } else if (ready && message.type === "selected") {
        delivered = select.current(message.url);
        if (!delivered) setNotice("sendFailed");
      } else if (ready) {
        setNotice(message.type === "blocked" ? "blocked" : null);
      }
    }
    window.addEventListener("message", receive);
    const url = new URL("/assets/picker/index.html", POCKLO_ORIGIN);
    url.searchParams.set("origin", window.location.origin);
    frame.src = url.href;
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, []);

  return (
    <div className="pocklo-embed-picker">
      <p>{t("pocklo.pickerDraftHint")}</p>
      <iframe ref={iframe} title={t("pocklo.choose")} tabIndex={0}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
      {notice && <p role="status">{t(notice === "loading" ? "common.loading" :
        notice === "blocked" ? "pocklo.pickerPopupBlocked" :
        notice === "sendFailed" ? "pocklo.pickerDraftFailed" : "pocklo.unavailable")}</p>}
      <button type="button" className="secondary-button" onClick={onBrowse}>{t("pocklo.pickerBrowse")}</button>
    </div>
  );
}
