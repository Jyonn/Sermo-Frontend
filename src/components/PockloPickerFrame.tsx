import { useLayoutEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/language";
import { readPockloPickerMessage } from "../lib/pockloPicker";
import { POCKLO_ORIGIN, pockloShareToken } from "../lib/pockloShare";
import { FeedbackState } from "./FeedbackState";

export function PockloPickerFrame({ onClose, onShare, onConnectionError, onFallback }: {
  onClose: () => void;
  onShare: (url: string) => Promise<boolean | void>;
  onConnectionError: (error: ApiError) => void;
  onFallback: () => void;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onClose, onShare, onConnectionError });
  callbacks.current = { onClose, onShare, onConnectionError };
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [draftError, setDraftError] = useState(false);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element?.contentWindow) return;
    const target = element.contentWindow;
    const lifetime = new AbortController();
    const pending = new Map<string, AbortController>();
    const created = new Set<string>();
    let ready = false;
    let sharing = false;
    let adding = false;
    const handshake = window.setTimeout(() => setStatus("unavailable"), 8000);
    const post = (type: string, fields: object) => {
      if (!lifetime.signal.aborted) target.postMessage({ type: "pocklo.picker." + type, version: 1, ...fields }, POCKLO_ORIGIN);
    };

    async function receive(event: MessageEvent) {
      const message = readPockloPickerMessage(event, target);
      if (!message || lifetime.signal.aborted) return;
      if (message.type === "ready") {
        ready = true;
        created.clear();
        window.clearTimeout(handshake);
        // Frienden reports connected only for a grant with both files.read and shares.create.
        post("init", { canShare: true });
        setStatus("ready");
        return;
      }
      if (!ready) return;
      if (message.type === "cancelled") {
        callbacks.current.onClose();
        return;
      }
      if (message.type === "selected") {
        if (adding || !created.has(message.url)) return;
        adding = true;
        try {
          if (await callbacks.current.onShare(message.url) === false) throw Error();
          created.delete(message.url);
          if (!lifetime.signal.aborted) callbacks.current.onClose();
        } catch {
          if (!lifetime.signal.aborted) setDraftError(true);
        } finally {
          adding = false;
        }
        return;
      }
      const { requestId } = message;
      if (pending.has(requestId)) return;
      if (pending.size >= 12 || (message.type === "share" && sharing)) {
        post("response", { requestId, error: "unavailable" });
        return;
      }
      const controller = new AbortController();
      pending.set(requestId, controller);
      if (message.type === "share") sharing = true;
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const { signal } = controller;
      try {
        if (message.type === "files") {
          const result = await api.pockloFiles(message.resourceId, message.offset, signal, message.query);
          post("response", { requestId, result });
        } else {
          const { url } = await api.pockloShare(message.resourceId, message.operationId, signal);
          const token = pockloShareToken(url);
          if (!token) throw Error();
          const canonical = POCKLO_ORIGIN + "/share/" + token;
          created.clear();
          created.add(canonical);
          post("response", { requestId, result: { url: canonical } });
        }
      } catch (cause) {
        if (lifetime.signal.aborted) return;
        const error = cause instanceof ApiError ? cause.identifier : "unavailable";
        post("response", { requestId, error });
        if (cause instanceof ApiError && (error === "connect_required" || error === "account_mismatch")) {
          callbacks.current.onConnectionError(cause);
        }
      } finally {
        window.clearTimeout(timeout);
        pending.delete(requestId);
        if (message.type === "share") sharing = false;
      }
    }
    window.addEventListener("message", receive);
    const url = new URL("/picker/embed/", POCKLO_ORIGIN);
    url.searchParams.set("mode", "oauth");
    url.searchParams.set("origin", window.location.origin);
    element.src = url.href;
    return () => {
      lifetime.abort();
      for (const controller of pending.values()) controller.abort();
      window.clearTimeout(handshake);
      window.removeEventListener("message", receive);
    };
  }, []);

  return <div className="pocklo-picker-frame">
    {status === "loading" && <FeedbackState tone="loading" title={t("common.loading")} />}
    {status === "unavailable" && <FeedbackState tone="error" title={t("pocklo.unavailable")} />}
    {draftError && <p className="pocklo-notice" role="alert">{t("pocklo.sendFailed")}</p>}
    <iframe ref={frame} title={t("pocklo.choose")} hidden={status !== "ready"} tabIndex={0}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
    {status !== "loading" && <button type="button" className="secondary-button" onClick={onFallback}>{t("pocklo.friendenPicker")}</button>}
  </div>;
}
