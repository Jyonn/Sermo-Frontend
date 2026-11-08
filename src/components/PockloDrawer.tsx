import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/language";
import { SideDrawer } from "./SideDrawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { PockloGlyph } from "./PockloGlyph";
import { PockloFileVisual, pockloCdnThumbnail } from "./PockloFileVisual";
import pockloIcon from "../assets/pocklo-mark.svg";
import "./PockloDrawer.css";
import { pockloShareToken } from "./PockloShareCard";

export const POCKLO_HOME = "https://pocklo.jyonn.space/";
const POCKLO_AUTHORIZE = "https://disk.6-79.cn/api/oauth/authorize/";
const RETURN_KEY = "frienden:pocklo-return";

type PockloEntry = { id: string; name: string; folder: boolean; size?: number; preview?: string | null; thumbnail?: string | null };
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
  open, onClose, scope, returnError, onShare, chatName,
}: {
  open: boolean;
  onClose: () => void;
  scope: string;
  returnError?: string;
  chatName?: string;
  onShare?: (url: string) => Promise<boolean | void>;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [revision, setRevision] = useState(0);
  const [folderError, setFolderError] = useState(false);
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
      setConfirmDisconnect(false);
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
  }, [open, scope, returnError, revision]);
  useEffect(() => () => pendingShare.current?.abort(), []);

  useEffect(() => {
    if (!open || !fileMode || status !== "connected") return;
    const controller = new AbortController();
    setFolder(null);
    setFolderError(false);
    api.pockloFiles(folderId, offset, controller.signal).then((value) => {
      if (!controller.signal.aborted) setFolder(value);
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError && ["connect_required", "account_mismatch"].includes(cause.identifier)) report(cause);
        else setFolderError(true);
      }
    });
    return () => controller.abort();
  }, [open, fileMode, status, folderId, offset, revision]);

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
      setConfirmDisconnect(false);
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
        else setError("send_failed");
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
    : error === "send_failed" ? t("pocklo.sendFailed")
    : error === "connect_required" ? ""
    : error ? t("pocklo.unavailable") : "";
  const ready = status === "connected";
  const retry = <button className="secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>{t("common.retry")}</button>;

  return (
    <SideDrawer open={open} onClose={onClose} title={fileMode ? t("pocklo.choose") : t("pocklo.name")} trapFocus>
      <div className="pocklo-drawer">
        {(!fileMode || !ready) && <div className="pocklo-identity">
          <img src={pockloIcon} alt="" />
          <div><strong>{t("pocklo.name")}</strong><p>{t("pocklo.menuHint")}</p></div>
          {status && <span className="pocklo-status" data-connected={ready}>
            <span aria-hidden="true" />{t(ready ? "pocklo.statusConnected" : status === "unavailable" ? "pocklo.statusUnavailable" : "pocklo.statusDisconnected")}
          </span>}
        </div>}
        {message && <p className="pocklo-notice" role="alert">{message}</p>}
        {!status && <FeedbackState tone="loading" title={t("common.loading")} />}
        {status === "unavailable" && <FeedbackState tone="error" title={t("pocklo.unavailable")} action={retry} />}
        {status === "phone_required" && <FeedbackState icon="verified_user" title={t("pocklo.phoneTitle")} description={t("pocklo.phoneRequired")} />}
        {(status === "connect_required" || (!fileMode && ready)) && <div className="pocklo-connection">
          <div className="pocklo-section-title">{t("pocklo.permissions")}</div>
          <ul className="pocklo-permissions">
            <li><PockloGlyph name="folder" />{t("pocklo.permissionBrowse")}</li>
            <li><PockloGlyph name="link" />{t("pocklo.permissionShare")}</li>
          </ul>
          <p>{t(ready ? "pocklo.connectedHint" : "pocklo.connectHint")}</p>
          {status === "connect_required" && <button className="button" disabled={busy} type="button" onClick={() => void connect()}>
            {t(busy ? "pocklo.connecting" : "pocklo.connect")}
            <PockloGlyph name="open" />
          </button>}
        </div>}
        {!fileMode && <div className="pocklo-management">
          <a href={POCKLO_HOME} target="_blank" rel="noreferrer">{t("pocklo.open")} <PockloGlyph name="open" /></a>
          {ready && <button disabled={busy} type="button" onClick={() => setConfirmDisconnect(true)}>{t("pocklo.disconnect")}</button>}
        </div>}
        {fileMode && ready && <>
          <div className="pocklo-folder-header">
            {trail.length > 0 && <button className="icon-button" aria-label={t("pocklo.parentFolder")} disabled={busy} type="button"
              onClick={() => { setTrail(trail.slice(0, -1)); setOffset(0); setSelected(null); setError(""); }}>
              <PockloGlyph name="back" />
            </button>}
            <div><small>{t("pocklo.folderLabel")}</small><strong>{folder?.resource.name ?? trail[trail.length - 1]?.name ?? t("pocklo.name")}</strong></div>
            {trail.length > 0 && folder?.resource.folder && <button className="secondary-button" disabled={busy} type="button"
              aria-pressed={selected?.id === folder.resource.id} onClick={() => setSelected(folder.resource)}>{t("pocklo.selectFolder")}</button>}
          </div>
          {folderError ? <FeedbackState tone="error" title={t("pocklo.folderError")} action={retry} /> : !folder && <FeedbackState tone="loading" title={t("common.loading")} />}
          {folder?.entries.length === 0 && <FeedbackState tone="empty" icon="folder_open" title={t("pocklo.empty")} />}
          {folder?.entries.length ? <div className="simple-list pocklo-file-list" aria-label={folder.resource.name}>
            {folder.entries.map((entry) => <button key={entry.id} className="simple-row menu-link-row pocklo-file-row" disabled={busy}
              aria-pressed={entry.folder ? undefined : selected?.id === entry.id} type="button" onClick={() => {
                setError("");
                if (entry.folder) { setTrail([...trail, entry]); setOffset(0); setSelected(null); }
                else setSelected(entry);
              }}>
              <PockloFileVisual className="pocklo-file-icon" name={entry.name} folder={entry.folder}
                preview={entry.preview} thumbnail={pockloCdnThumbnail(entry.thumbnail)} />
              <span className="row-main"><strong>{entry.name}</strong><small>{t(entry.folder ? "pocklo.kindFolder" : entry.preview === "link" ? "pocklo.kindLink" : "pocklo.kindFile")}</small></span>
              <PockloGlyph name={entry.folder ? "next" : selected?.id === entry.id ? "checked" : "unchecked"} />
            </button>)}
          </div> : null}
          {(offset > 0 || folder?.next_offset != null) && <div className="pocklo-pagination">
            <button className="secondary-button" disabled={busy || offset === 0} type="button" onClick={() => { setOffset(Math.max(0, offset - 100)); setSelected(null); }}>{t("pocklo.previousPage")}</button>
            <button className="secondary-button" disabled={busy || folder?.next_offset == null} type="button" onClick={() => { if (folder?.next_offset != null) setOffset(folder.next_offset); setSelected(null); }}>{t("common.next")}</button>
          </div>}
          <div className="pocklo-share-review">
            <div aria-live="polite">
              <small>{chatName ? t("pocklo.shareDestination", { name: chatName }) : t("pocklo.sendShare")}</small>
              <strong>{selected?.name ?? t("pocklo.selectHint")}</strong>
              {selected && <p><PockloGlyph name="link" />{t("pocklo.linkAccess")}</p>}
            </div>
            <button className="button" disabled={!selected || busy} type="button" onClick={() => void sendShare()}>{t(busy ? "pocklo.sendingShare" : "pocklo.sendShare")}</button>
          </div>
        </>}
      </div>
      <ConfirmDialog open={open && confirmDisconnect} title={t("pocklo.disconnect")} description={t("pocklo.disconnectDetail")}
        confirmLabel={t("pocklo.disconnectAction")} danger busy={busy} onClose={() => setConfirmDisconnect(false)} onConfirm={() => void disconnect()} />
    </SideDrawer>
  );
}
