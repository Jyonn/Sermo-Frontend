import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/language";
import { SideDrawer } from "./SideDrawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { PockloGlyph } from "./PockloGlyph";
import { PockloFileVisual, pockloCdnThumbnail } from "./PockloFileVisual";
import { BottomSheet } from "./BottomSheet";
import pockloIcon from "../assets/pocklo-mark.svg";
import "./PockloDrawer.css";
import { POCKLO_ORIGIN, pockloShareToken } from "../lib/pockloShare";

export const POCKLO_HOME = POCKLO_ORIGIN + "/";
const POCKLO_AUTHORIZE = "https://disk.6-79.cn/api/oauth/authorize/";
const RETURN_KEY = "frienden:pocklo-return";
const VIEW_KEY = "frienden:pocklo-directory-view";
const FOLDER_CACHE_TTL = 120_000;
type FolderView = "list" | "grid";

type PockloEntry = { id: string; name: string; folder: boolean; size?: number; preview?: string | null; thumbnail?: string | null };
export type PockloFolder = {
  resource: PockloEntry;
  entries: PockloEntry[];
  next_offset: number | null;
  has_more?: boolean;
};
type FolderStep = { entry: PockloEntry; offset: number; query: string; scrollTop: number; view: FolderView };

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
  const [folderRevision, setFolderRevision] = useState(0);
  const [folderError, setFolderError] = useState(false);
  const [trail, setTrail] = useState<FolderStep[]>([]);
  const [loadedFolder, setLoadedFolder] = useState<{ key: string; value: PockloFolder } | null>(null);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PockloEntry | null>(null);
  const [view, setView] = useState<FolderView>(() => localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list");
  const drawerContent = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, { value: PockloFolder; expires: number }>());
  const restore = useRef<FolderStep | "top" | null>(null);
  const pendingShare = useRef<AbortController | null>(null);
  const operation = useRef<{ resourceId: string; key: string } | null>(null);
  const fileMode = Boolean(onShare);
  const current = trail[trail.length - 1]?.entry;
  const folderId = current?.id ?? "";
  const folderPrefix = `${scope}:${folderId}:`;
  const search = query.trim();
  const folderKey = `${folderPrefix}${offset}:${search}`;
  const folder = loadedFolder?.key === folderKey ? loadedFolder.value : null;

  useEffect(() => {
    if (!open) {
      pendingShare.current?.abort();
      operation.current = null;
      setTrail([]);
      setOffset(0);
      setQuery("");
      setSelected(null);
      setLoadedFolder(null);
      restore.current = null;
      setConfirmDisconnect(false);
      return;
    }
    let live = true;
    setStatus("");
    setError(returnError ?? "");
    api.pockloConnection().then((value) => {
      if (!live) return;
      const nextStatus = value.status ?? "unavailable";
      if (nextStatus !== "connected") cache.current.clear();
      setStatus(nextStatus);
    }).catch(() => {
      if (live) setStatus("unavailable");
    });
    return () => { live = false; };
  }, [open, scope, returnError, revision]);
  useEffect(() => () => pendingShare.current?.abort(), []);
  useEffect(() => { cache.current.clear(); }, [scope]);

  useEffect(() => {
    if (!open || !fileMode || status !== "connected") return;
    setFolderError(false);
    const cached = search ? undefined : cache.current.get(folderKey);
    if (cached && cached.expires > Date.now()) {
      setLoadedFolder({ key: folderKey, value: cached.value });
      return;
    }
    const controller = new AbortController();
    const load = () => api.pockloFiles(folderId, offset, controller.signal, search).then((value) => {
      if (controller.signal.aborted) return;
      if (!search) {
        if (cache.current.size >= 48) {
          const oldest = cache.current.keys().next();
          if (!oldest.done) cache.current.delete(oldest.value);
        }
        cache.current.set(folderKey, { value, expires: Date.now() + FOLDER_CACHE_TTL });
      }
      setLoadedFolder({ key: folderKey, value });
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError && ["connect_required", "account_mismatch"].includes(cause.identifier)) report(cause);
        else setFolderError(true);
      }
    });
    const debounce = search ? window.setTimeout(load, 220) : undefined;
    if (!search) void load();
    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [open, fileMode, status, folderId, offset, folderKey, folderRevision, search]);

  useLayoutEffect(() => {
    if (!folder || !restore.current) return;
    const scroller = drawerContent.current?.closest<HTMLElement>(".sheet-body");
    if (!scroller) return;
    const target = restore.current;
    restore.current = null;
    if (target === "top") scroller.scrollTop = 0;
    else if (target.view === view) scroller.scrollTop = target.scrollTop;
    else {
      const row = drawerContent.current?.querySelector<HTMLElement>(`[data-pocklo-entry="${CSS.escape(target.entry.id)}"]`);
      if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
  }, [folder, view]);

  function refreshFolder() {
    for (const key of cache.current.keys()) {
      if (key.startsWith(folderPrefix)) cache.current.delete(key);
    }
    setLoadedFolder(null);
    setSelected(null);
    setError("");
    setFolderRevision((value) => value + 1);
  }

  function openFolder(entry: PockloEntry) {
    const scrollTop = drawerContent.current?.closest<HTMLElement>(".sheet-body")?.scrollTop ?? 0;
    restore.current = "top";
    setTrail([...trail, { entry, offset, query, scrollTop, view }]);
    setOffset(0);
    setQuery("");
    setSelected(null);
  }

  function goToParent() {
    const step = trail[trail.length - 1];
    if (!step) return;
    restore.current = step;
    setTrail(trail.slice(0, -1));
    setOffset(step.offset);
    setQuery(step.query);
    setSelected(null);
    setError("");
  }

  function changeView(next: FolderView) {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  function report(cause: unknown) {
    const code = cause instanceof ApiError ? cause.identifier : "unavailable";
    setError(code);
    if (code === "connect_required" || code === "account_mismatch") {
      cache.current.clear();
      setLoadedFolder(null);
      setStatus("connect_required");
    }
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
      cache.current.clear();
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

  const content = (
      <div className="pocklo-drawer" ref={drawerContent}>
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
              onClick={goToParent}>
              <PockloGlyph name="back" />
            </button>}
            <div><small>{t("pocklo.folderLabel")}</small><strong>{folder?.resource.name ?? current?.name ?? t("pocklo.name")}</strong></div>
            {trail.length > 0 && folder?.resource.folder && <button className="secondary-button" disabled={busy} type="button"
              aria-pressed={selected?.id === folder.resource.id} onClick={() => setSelected(folder.resource)}>{t("pocklo.selectFolder")}</button>}
          </div>
          <label className="pocklo-search">
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input type="search" maxLength={256} value={query} disabled={busy} aria-label={t("pocklo.search")}
              placeholder={t("pocklo.search")} onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
                setSelected(null);
                setError("");
                restore.current = "top";
              }} />
          </label>
          <div className="pocklo-folder-toolbar">
            <div className="pocklo-view-switch" role="group" aria-label={t("pocklo.viewMode")}>
              <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}><PockloGlyph name="list" />{t("pocklo.listView")}</button>
              <button type="button" aria-pressed={view === "grid"} onClick={() => changeView("grid")}><PockloGlyph name="grid" />{t("pocklo.gridView")}</button>
            </div>
            <button className="icon-button" type="button" onClick={refreshFolder} disabled={busy || (!folder && !folderError)}
              aria-label={t("pocklo.refreshFolder")} title={t("pocklo.refreshFolder")}><PockloGlyph name="refresh" /></button>
          </div>
          {folderError ? <FeedbackState tone="error" title={t("pocklo.folderError")} action={<button className="secondary-button" type="button" onClick={refreshFolder}>{t("common.retry")}</button>} /> : !folder && <FeedbackState tone="loading" title={t("common.loading")} />}
          {folder?.entries.length === 0 && <FeedbackState tone="empty" icon={search ? "search" : "folder_open"} title={t(search ? "pocklo.searchEmpty" : "pocklo.empty")} />}
          {folder?.entries.length ? <div className={view === "grid" ? "pocklo-file-grid" : "simple-list pocklo-file-list"} aria-label={folder.resource.name}>
            {folder.entries.map((entry) => <button key={entry.id} data-pocklo-entry={entry.id}
              className={view === "grid" ? "pocklo-file-tile" : "simple-row menu-link-row pocklo-file-row"} disabled={busy}
              aria-pressed={entry.folder ? undefined : selected?.id === entry.id} type="button" onClick={() => {
                setError("");
                if (entry.folder) openFolder(entry);
                else setSelected(entry);
              }}>
              <PockloFileVisual className="pocklo-file-icon" name={entry.name} folder={entry.folder}
                preview={entry.preview} thumbnail={pockloCdnThumbnail(entry.thumbnail)} />
              <span className="row-main"><strong>{entry.name}</strong><small>{t(entry.folder ? "pocklo.kindFolder" : entry.preview === "link" ? "pocklo.kindLink" : "pocklo.kindFile")}</small></span>
              <PockloGlyph name={entry.folder ? "next" : selected?.id === entry.id ? "checked" : "unchecked"} />
            </button>)}
          </div> : null}
          {search && folder?.has_more ? <p role="status">{t("pocklo.searchLimit")}</p> : null}
          {(offset > 0 || folder?.next_offset != null) && <div className="pocklo-pagination">
            <button className="secondary-button" disabled={busy || offset === 0} type="button" onClick={() => { setOffset(Math.max(0, offset - 100)); setSelected(null); }}>{t("pocklo.previousPage")}</button>
            <button className="secondary-button" disabled={busy || folder?.next_offset == null} type="button" onClick={() => { if (folder?.next_offset != null) setOffset(folder.next_offset); setSelected(null); }}>{t("common.next")}</button>
          </div>}
        </>}
      </div>
  );
  if (fileMode) return (
    <BottomSheet open={open} onClose={onClose} title={t("pocklo.choose")} description={t("pocklo.pickerDraftHint")}
      className="pocklo-resource-sheet" bodyClassName="pocklo-resource-body"
      footer={ready ? <footer className="pocklo-share-review">
        <div aria-live="polite">
          <small>{chatName ? t("pocklo.shareDestination", { name: chatName }) : t("pocklo.addShare")}</small>
          <strong>{selected?.name ?? t("pocklo.selectHint")}</strong>
          {selected && <p><PockloGlyph name="link" />{t("pocklo.linkAccess")}</p>}
        </div>
        <button className="button" disabled={!selected || busy} type="button" onClick={() => void sendShare()}>{t(busy ? "pocklo.creatingShare" : "pocklo.addShare")}</button>
      </footer> : undefined}>{content}</BottomSheet>
  );
  return (
    <SideDrawer open={open} onClose={onClose} title={t("pocklo.name")} trapFocus>
      {content}
      <ConfirmDialog open={open && confirmDisconnect} title={t("pocklo.disconnect")} description={t("pocklo.disconnectDetail")}
        confirmLabel={t("pocklo.disconnectAction")} danger busy={busy} onClose={() => setConfirmDisconnect(false)} onConfirm={() => void disconnect()} />
    </SideDrawer>
  );
}
