import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/language";
import { SideDrawer } from "./SideDrawer";
import "./PockloDrawer.css";
import { pockloShareToken } from "./PockloShareCard";

export const POCKLO_HOME = "https://pocklo.jyonn.space/";
const POCKLO_AUTHORIZE = "https://disk.6-79.cn/api/oauth/authorize/";
const RETURN_KEY = "frienden:pocklo-return";

type PockloEntry = { id: string; name: string; folder: boolean; size?: number };
export type PockloFolder = {
  resource: PockloEntry;
  entries: PockloEntry[];
  next_offset: number | null;
};

export function usePockloReturn(scope: string, onReturn: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState("");
  const open = useRef(onReturn);
  open.current = onReturn;
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const result = query.get("pocklo");
    if (!result) return;
    query.delete("pocklo");
    navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
    if (scope && sessionStorage.getItem(RETURN_KEY) === scope + ":" + window.location.pathname) {
      sessionStorage.removeItem(RETURN_KEY);
      setOutcome(result === "connected" ? "" : result);
      open.current();
    }
  }, [location.pathname, location.search, navigate, scope]);
  return outcome;
}

export function PockloDrawer({
  open, onClose, scope, returnError, onShare,
}: {
  open: boolean;
  onClose: () => void;
  scope: string;
  returnError?: string;
  onShare?: (url: string) => Promise<boolean | void>;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<PockloEntry[]>([]);
  const [folder, setFolder] = useState<PockloFolder | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PockloEntry | null>(null);
  const pendingShare = useRef<AbortController | null>(null);
  const operation = useRef<{ resourceId: string; key: string } | null>(null);
  const fileMode = Boolean(onShare);
  const folderId = trail[trail.length - 1]?.id ?? "";

  useEffect(() => {
    if (!open) {
      pendingShare.current?.abort();
      operation.current = null;
      setTrail([]);
      setOffset(0);
      setSelected(null);
      return;
    }
    let live = true;
    setStatus("");
    setError(returnError ?? "");
    api.pockloConnection().then((value) => {
      if (live) setStatus(value.status ?? "unavailable");
    }).catch(() => {
      if (live) setStatus("unavailable");
    });
    return () => { live = false; };
  }, [open, scope, returnError]);
  useEffect(() => () => pendingShare.current?.abort(), []);

  useEffect(() => {
    if (!open || !fileMode || status !== "connected") return;
    const controller = new AbortController();
    setFolder(null);
    api.pockloFiles(folderId, offset, controller.signal).then((value) => {
      if (!controller.signal.aborted) setFolder(value);
    }).catch((cause) => {
      if (!controller.signal.aborted) report(cause);
    });
    return () => controller.abort();
  }, [open, fileMode, status, folderId, offset]);

  function report(cause: unknown) {
    const code = cause instanceof ApiError ? cause.identifier : "unavailable";
    setError(code);
    if (code === "connect_required" || code === "account_mismatch") setStatus("connect_required");
  }

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { origin, pathname: path } = window.location;
      const { authorize_url } = await api.pockloConnection({ action: "connect", origin, path });
      const target = new URL(authorize_url ?? "");
      if (target.origin + target.pathname !== POCKLO_AUTHORIZE || target.username || target.password || target.hash) throw Error();
      sessionStorage.setItem(RETURN_KEY, scope + ":" + path);
      window.location.assign(target.href);
    } catch (cause) {
      report(cause);
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.pockloConnection({ action: "disconnect" });
      setStatus("connect_required");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  }

  async function sendShare() {
    if (!selected || !onShare || busy || pendingShare.current) return;
    const controller = new AbortController();
    pendingShare.current = controller;
    if (operation.current?.resourceId !== selected.id) {
      operation.current = { resourceId: selected.id, key: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    try {
      const { url } = await api.pockloShare(selected.id, operation.current.key, controller.signal);
      if (!pockloShareToken(url)) throw Error();
      if (!controller.signal.aborted) {
        if (await onShare(url) !== false) onClose();
      }
    } catch (cause) {
      if (!controller.signal.aborted) report(cause);
    } finally {
      pendingShare.current = null;
      setBusy(false);
    }
  }

  const message = error === "account_mismatch" ? t("pocklo.mismatch")
    : error === "denied" ? t("pocklo.denied")
    : error === "connect_required" ? t("pocklo.connect")
    : error ? t("pocklo.unavailable") : "";

  return (
    <SideDrawer open={open} onClose={onClose} title={t("pocklo.name")} actionLabel={fileMode ? t("pocklo.sendShare") : undefined}
      actionDisabled={!selected || busy || status !== "connected"} actionBusy={busy} onAction={fileMode ? () => void sendShare() : undefined}>
      <div className="pocklo-drawer">
        {!fileMode && <a className="button" href={POCKLO_HOME} target="_blank" rel="noreferrer">{t("pocklo.open")}</a>}
        {!status ? <p role="status">{t("common.loading")}</p> : null}
        {message ? <p role="alert">{message}</p> : null}
        {status === "unavailable" ? <p>{t("pocklo.unavailable")}</p> : null}
        {status === "phone_required" ? <p>{t("pocklo.phoneRequired")}</p> : null}
        {status === "connect_required" && <>
          <p>{t("pocklo.connectHint")}</p>
          <button className="button" disabled={busy} type="button" onClick={() => void connect()}>{t("pocklo.connect")}</button>
        </>}
        {!fileMode && status === "connected" && <>
          <p>{t("pocklo.connectedHint")}</p>
          <button className="button" disabled={busy} type="button" onClick={() => void disconnect()}>{t("pocklo.disconnect")}</button>
        </>}
        {fileMode && status === "connected" && <>
          <p>{selected ? t("pocklo.shareHint", { name: selected.name }) : t("pocklo.selectHint")}</p>
          {trail.length > 0 && <button className="button" disabled={busy} type="button" onClick={() => { setTrail(trail.slice(0, -1)); setOffset(0); setSelected(null); setError(""); }}>{t("pocklo.parentFolder")}</button>}
          {trail.length > 0 && folder?.resource.folder && <button className="button" disabled={busy} type="button"
            aria-pressed={selected?.id === folder.resource.id} onClick={() => setSelected(folder.resource)}>{t("pocklo.selectFolder")}</button>}
          {!folder && !error ? <p role="status">{t("common.loading")}</p> : null}
          {folder?.entries.length === 0 ? <p>{t("pocklo.empty")}</p> : null}
          {folder?.entries.length ? <div className="simple-list" aria-label={folder.resource.name}>
            {folder.entries.map((entry) => <button key={entry.id} className="simple-row menu-link-row" disabled={busy}
              aria-pressed={entry.folder ? undefined : selected?.id === entry.id} type="button" onClick={() => {
                setError("");
                if (entry.folder) { setTrail([...trail, entry]); setOffset(0); setSelected(null); }
                else setSelected(entry);
              }}>
              <span className="material-symbols-outlined" aria-hidden="true">{entry.folder ? "folder" : "draft"}</span>
              <span className="row-main"><strong>{entry.name}</strong></span>
              <span className="material-symbols-outlined" aria-hidden="true">{entry.folder ? "chevron_right" : selected?.id === entry.id ? "check_circle" : "radio_button_unchecked"}</span>
            </button>)}
          </div> : null}
          {offset > 0 && <button className="button" disabled={busy} type="button" onClick={() => { setOffset(Math.max(0, offset - 100)); setSelected(null); }}>{t("pocklo.previousPage")}</button>}
          {folder?.next_offset != null && <button className="button" disabled={busy} type="button" onClick={() => { setOffset(folder.next_offset!); setSelected(null); }}>{t("common.next")}</button>}
        </>}
      </div>
    </SideDrawer>
  );
}
