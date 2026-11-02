import { createPortal } from "react-dom";
import {useRef} from 'react';
import {useModalFocus} from '../lib/modalFocus';
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";
import { CURRENT_RELEASE, type ExplicitUpdateCheckResult, type UpdateSourceKey } from "../lib/pwaUpdate";
import { usePwaUpdateActivation } from "../lib/usePwaUpdateActivation";
import { UpdateFailureFeedback } from "./UpdateReportButton";
import { SITE_ORIGINS, updateSiteLabel } from "../lib/siteOrigins";
import { updateDestination } from "../lib/updateDestination";

interface UpdateCheckDialogProps {
  checking: boolean;
  onCheck: () => void;
  onClose: () => void;
  open: boolean;
  result: ExplicitUpdateCheckResult | null;
}

export function UpdateCheckDialog({ checking, onCheck, onClose, open, result }: UpdateCheckDialogProps) {
  const { t } = useI18n();
  const { phase, install } = usePwaUpdateActivation();
  const installing = phase !== "idle" && phase !== "error";
  const root=useRef<HTMLElement|null>(null);
  useBodyScrollLock(open);
  useModalFocus(root,open,()=>{if(!installing)onClose()});
  if (!open || typeof document === "undefined") return null;

  const successfulSources = result?.sources.filter((source) => source.status === "ok").length ?? 0;
  const allFailed = Boolean(result && successfulSources === 0);
  const partiallyFailed = Boolean(result && successfulSources > 0 && successfulSources < result.sources.length);
  const sourceName = (key: UpdateSourceKey) => t(updateSiteLabel(key));
  const destination = updateDestination(result, window.location.origin);
  const sources=result?.sources ?? SITE_ORIGINS.map(site=>({...site,release:null,releaseId:null,status:'idle' as const}));
  const current=sources.find(source=>source.origin===window.location.origin);
  const others=sources.filter(source=>source.origin!==window.location.origin);

  return createPortal(
    <div className="dialog-backdrop update-check-backdrop" onClick={() => { if (!installing) onClose(); }} role="presentation">
      <section ref={root} aria-labelledby="update-check-title" aria-modal="true" className="update-check-dialog is-compact" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="update-check-header">
          <div><h2 id="update-check-title">{t("update.check")}</h2><p className="update-installed-version">{t('update.current',{version:result?.currentRelease.id??CURRENT_RELEASE.id})}</p></div>
          <button aria-label={t("common.close")} className="icon-button" disabled={installing} onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="update-check-body">
          <div className={`update-check-summary${checking ? " is-checking" : result?.updateAvailable ? " is-available" : allFailed ? " is-error" : ""}`}>
            <span className={`material-symbols-outlined${checking ? " is-spinning" : ""}`} aria-hidden="true">
              {checking ? "progress_activity" : result?.updateAvailable ? "new_releases" : allFailed ? "cloud_off" : "check_circle"}
            </span>
            <div>
              <strong>{checking ? t("update.checking") : result?.updateAvailable ? t("update.available") : allFailed ? t("update.unavailable") : t("update.latest")}</strong>
              {result?.updateAvailable?<p>{t('update.latestVersion')} · {result.latestVersion}</p>:null}
            </div>
          </div>

          <div className="update-current-site">
            <div><small>{t('update.currentSite')}</small><strong>{window.location.host}</strong></div>
            <span>{current?.status==='ok'?current.releaseId:current?.status==='error'?t('update.checkFailed'):t('update.waiting')}</span>
          </div>
          <details className="update-other-sites"><summary>{t('update.otherSites')}{partiallyFailed?<span className="update-other-warning" aria-label={t('update.partialHint')}> · {t('update.checkFailed')}</span>:null}</summary>
          <div className="update-source-list">
            {others.map((source) => (
              <div className="update-source-row" key={source.key}>
                <span className="material-symbols-outlined" aria-hidden="true">{source.status === "ok" ? "cloud_done" : source.status === "error" ? "cloud_off" : "cloud_queue"}</span>
                <div><strong>{sourceName(source.key)}{source.origin === window.location.origin ? ` · ${t("update.currentSite")}` : ""}</strong><a href={`${source.origin}/`} referrerPolicy="no-referrer" rel="noreferrer"><small>{new URL(source.origin).host}</small></a></div>
                <em className={`is-${source.status}`}>{source.status === "ok" ? source.releaseId : source.status === "error" ? t("update.checkFailed") : t("update.waiting")}</em>
              </div>
            ))}
          </div>
          </details>

          {allFailed ? <p className="update-network-advice"><span className="material-symbols-outlined" aria-hidden="true">wifi_find</span>{t("update.switchNetworkHint")}</p> : null}
          {phase === "error" ? <UpdateFailureFeedback /> : null}
        </div>

        <footer className="update-check-actions">
          <button className="ghost-button" disabled={checking || installing} onClick={destination ? () => window.location.assign(destination) : onCheck} type="button">{t(destination ? "update.goToNewSite" : "update.recheck")}</button>
          {destination ? <button className="button" disabled={installing} onClick={onClose} type="button">{t("update.wait")}</button> : result?.updateAvailable ? <button className="button" disabled={installing} onClick={install} type="button">{installing ? <span aria-hidden="true" className="media-wait-spinner" /> : null}{installing ? t(`update.${phase}` as "update.preparing" | "update.installing" | "update.restarting") : t("common.updateNow")}</button> : <button className="button" onClick={onClose} type="button">{t("common.gotIt")}</button>}
        </footer>
      </section>
    </div>,
    document.body
  );
}
