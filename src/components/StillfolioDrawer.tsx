import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { rememberExternalPickerReturn } from "../lib/externalPickerReturn";
import { useI18n } from "../lib/language";
import { stillfolioShareUrl, type StillfolioAlbum } from "../lib/stillfolioPicker";
import stillfolioMark from "../assets/stillfolio-mark.svg";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackState } from "./FeedbackState";
import { SideDrawer } from "./SideDrawer";
import "./StillfolioDrawer.css";

const AUTHORIZE = "https://api.stillfolio.jyonn.space/api/oauth/authorize/";

type Props = {
  open: boolean;
  onClose: () => void;
  scope: string;
  returnError: string;
  onShare?: (url: string) => Promise<boolean | void>;
  onLegacyPick?: () => void;
  openAppUrl?: string;
};

export function StillfolioDrawer({ open, onClose, scope, returnError, onShare, onLegacyPick, openAppUrl }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [albums, setAlbums] = useState<StillfolioAlbum[]>([]);
  const [selected, setSelected] = useState<StillfolioAlbum | null>(null);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const operation = useRef<{ album: string; key: string } | null>(null);
  const sharing = useRef<AbortController | null>(null);
  const picker = Boolean(onShare);

  useEffect(() => {
    setStatus("");
    setError(returnError);
    setAlbums([]);
    setSelected(null);
    setOffset(0);
    setNext(null);
    operation.current = null;
    if (!open) return;
    let active = true;
    void api.stillfolioConnection().then((value) => {
      if (active) setStatus(value.status ?? "unavailable");
    }).catch(() => {
      if (active) setStatus("unavailable");
    });
    return () => {
      active = false;
      sharing.current?.abort();
    };
  }, [open, revision, returnError, scope]);

  function report(cause: unknown) {
    const code = cause instanceof ApiError ? cause.identifier : "unavailable";
    setError(code);
    if (code === "connect_required" || code === "account_mismatch") {
      setSelected(null);
      setAlbums([]);
      setStatus("connect_required");
    }
  }

  useEffect(() => {
    if (!open || !picker || status !== "connected") return;
    const controller = new AbortController();
    setLoading(true);
    void api.stillfolioAlbums(offset, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setAlbums((current) => offset ? [...current, ...value.albums] : value.albums);
      setNext(value.next_offset);
    }).catch((cause) => {
      if (!controller.signal.aborted) report(cause);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, offset, picker, status]);

  async function changeConnection(action: "connect" | "disconnect") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { origin, pathname: path } = window.location;
      const value = await api.stillfolioConnection(action === "connect" ? { action, origin, path } : { action });
      if (action === "disconnect") {
        setStatus("connect_required");
        return;
      }
      const target = new URL(value.authorize_url ?? "");
      if (target.origin + target.pathname !== AUTHORIZE || target.username || target.password || target.hash) throw Error();
      rememberExternalPickerReturn("stillfolio", scope, path);
      window.location.assign(target.href);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
      setDisconnecting(false);
    }
  }

  async function share() {
    if (!selected || !onShare || busy || sharing.current) return;
    const controller = new AbortController();
    sharing.current = controller;
    if (operation.current?.album !== selected.id) operation.current = { album: selected.id, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await api.stillfolioShare(selected.id, operation.current.key, controller.signal);
      const url = stillfolioShareUrl(result.url);
      if (!url) throw Error();
      if (controller.signal.aborted) return;
      const accepted = await onShare(url);
      if (controller.signal.aborted) return;
      if (accepted === false) setError("send_failed");
      else onClose();
    } catch (cause) {
      if (!controller.signal.aborted) report(cause);
    } finally {
      sharing.current = null;
      setBusy(false);
    }
  }

  const title = t("apps.stillfolio");
  const connected = status === "connected";
  const retry = () => setRevision((value) => value + 1);
  const retryButton = <button className="secondary-button" type="button" onClick={retry}>{t("common.retry")}</button>;
  const content = <div className="stillfolio-drawer">
    {!picker && <div className="pocklo-identity">
      <img src={stillfolioMark} alt="" />
      <div><strong>{title}</strong><p>{t("apps.stillfolioDescription")}</p></div>
      {connected && <span className="pocklo-status" data-connected="true">{t("pocklo.statusConnected")}</span>}
    </div>}
    {error && error !== "connect_required" && <p className="pocklo-notice" role="alert">{
      error === "account_mismatch" ? t("stillfolio.accountMismatch")
        : error === "denied" ? t("stillfolio.denied")
        : error === "send_failed" ? t("stillfolio.sendFailed") : t("stillfolio.unavailable")
    }</p>}
    {!status && <FeedbackState tone="loading" title={t("common.loading")} />}
    {status === "unavailable" && <FeedbackState tone="error" title={t("stillfolio.unavailable")} action={retryButton} />}
    {status === "phone_required" && <FeedbackState icon="verified_user" title={t("pocklo.phoneTitle")} description={t("stillfolio.phoneRequired")} />}
    {status === "connect_required" && <FeedbackState icon="link" title={t("stillfolio.connect")} description={t("stillfolio.connectHint")} action={
      <button className="button" disabled={busy} type="button" onClick={() => void changeConnection("connect")}>{t("stillfolio.connect")}</button>
    } />}
    {picker && connected && <>
      {albums.length > 0 && <div className="simple-list" aria-label={t("apps.pickStillfolio")}>
        {albums.map((album) => <button className="simple-row stillfolio-album" type="button" key={album.id}
          aria-pressed={selected?.id === album.id} disabled={busy} onClick={() => setSelected(album)}>
          <span className="material-symbols-outlined" aria-hidden="true">photo_library</span>
          <span><strong>{album.name || t("stillfolio.untitled")}</strong><small>{album.share_url ? t("stillfolio.linkReady") : t("stillfolio.privateAlbum")}</small></span>
          {selected?.id === album.id && <span className="material-symbols-outlined" aria-hidden="true">check</span>}
        </button>)}
      </div>}
      {loading && <FeedbackState tone="loading" title={t("common.loading")} />}
      {!loading && error === "unavailable" && retryButton}
      {!loading && !error && albums.length === 0 && <FeedbackState tone="empty" icon="photo_library" title={t("stillfolio.empty")} />}
      {next !== null && <button className="secondary-button" type="button" disabled={busy || loading}
        onClick={() => setOffset(next)}>{t("common.next")}</button>}
    </>}
    {!picker && <div className="pocklo-management">
      {openAppUrl && <a href={openAppUrl} target="_blank" rel="noreferrer">{t("stillfolio.open")}</a>}
      {connected && <button type="button" onClick={() => setDisconnecting(true)}>{t("stillfolio.disconnect")}</button>}
    </div>}
    {status === "unavailable" && onLegacyPick && <button className="secondary-button" type="button" onClick={onLegacyPick}>{t("stillfolio.legacyPicker")}</button>}
  </div>;

  if (picker) return <BottomSheet open={open} onClose={onClose} title={t("apps.pickStillfolio")}
    className="pocklo-resource-sheet" bodyClassName="pocklo-resource-body" footer={connected && selected ? <footer className="pocklo-share-review">
      <div aria-live="polite"><strong>{selected.name || t("stillfolio.untitled")}</strong><p>{t("stillfolio.publicLink")}</p></div>
      <button className="button" disabled={busy} type="button" onClick={() => void share()}>
        {t(busy ? "pocklo.sendingShare" : "stillfolio.sendAlbum")}
      </button>
    </footer> : undefined}>{content}</BottomSheet>;

  return <SideDrawer open={open} onClose={onClose} title={title} trapFocus>
    {content}
    <ConfirmDialog open={open && disconnecting} title={t("stillfolio.disconnect")} description={t("stillfolio.disconnectHint")}
      confirmLabel={t("stillfolio.disconnect")} danger busy={busy} onClose={() => setDisconnecting(false)} onConfirm={() => void changeConnection("disconnect")} />
  </SideDrawer>;
}
