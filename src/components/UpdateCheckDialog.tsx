import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";
import { activatePwaUpdate, type ExplicitUpdateCheckResult, type UpdateSourceKey } from "../lib/pwaUpdate";

interface UpdateCheckDialogProps {
  checking: boolean;
  onCheck: () => void;
  onClose: () => void;
  open: boolean;
  result: ExplicitUpdateCheckResult | null;
}

export function UpdateCheckDialog({ checking, onCheck, onClose, open, result }: UpdateCheckDialogProps) {
  const { language, t } = useI18n();
  useBodyScrollLock(open);
  if (!open || typeof document === "undefined") return null;

  const successfulSources = result?.sources.filter((source) => source.status === "ok").length ?? 0;
  const allFailed = Boolean(result && successfulSources === 0);
  const partiallyFailed = Boolean(result && successfulSources > 0 && successfulSources < result.sources.length);
  const localizedRelease = result?.latestRelease?.locales[language] ?? result?.latestRelease?.locales.en;
  const sourceName = (key: UpdateSourceKey) => t(key === "primary" ? "update.primarySite" : "update.mirrorSite");
  const install = () => {
    if (!activatePwaUpdate()) window.location.reload();
  };

  return createPortal(
    <div className="dialog-backdrop update-check-backdrop" onClick={onClose} role="presentation">
      <section aria-labelledby="update-check-title" aria-modal="true" className="update-check-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="update-check-header">
          <div className="update-check-mark" aria-hidden="true"><span className="material-symbols-outlined">system_update</span></div>
          <div><small>{t("update.versionAndUpdate")}</small><h2 id="update-check-title">{t("update.check")}</h2></div>
          <button aria-label={t("common.close")} className="icon-button" onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="update-check-body">
          <div className={`update-check-summary${checking ? " is-checking" : result?.updateAvailable ? " is-available" : allFailed ? " is-error" : ""}`}>
            <span className={`material-symbols-outlined${checking ? " is-spinning" : ""}`} aria-hidden="true">
              {checking ? "progress_activity" : result?.updateAvailable ? "new_releases" : allFailed ? "cloud_off" : "check_circle"}
            </span>
            <div>
              <strong>{checking ? t("update.checking") : result?.updateAvailable ? t("update.available") : allFailed ? t("update.unavailable") : t("update.latest")}</strong>
              <p>{checking ? t("update.checkingHint") : allFailed ? t("update.networkHint") : partiallyFailed ? t("update.partialHint") : result ? t("update.latestHint") : t("update.readyHint")}</p>
            </div>
          </div>

          <div className="update-version-strip">
            <div><small>{t("update.currentVersion")}</small><strong>{result?.currentRelease.id ?? "-"}</strong></div>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            <div><small>{t("update.latestVersion")}</small><strong>{result?.latestVersion ?? "-"}</strong></div>
          </div>

          <div className="update-source-list">
            {(result?.sources ?? [
              { key: "primary" as const, origin: "https://sermo.jyonn.space", release: null, releaseId: null, status: "idle" as const },
              { key: "mirror" as const, origin: "https://sermo.6-79.cn", release: null, releaseId: null, status: "idle" as const },
            ]).map((source) => (
              <div className="update-source-row" key={source.key}>
                <span className="material-symbols-outlined" aria-hidden="true">{source.status === "ok" ? "cloud_done" : source.status === "error" ? "cloud_off" : "cloud_queue"}</span>
                <div><strong>{sourceName(source.key)}</strong><small>{new URL(source.origin).host}</small></div>
                <em className={`is-${source.status}`}>{source.status === "ok" ? source.releaseId : source.status === "error" ? t("update.checkFailed") : t("update.waiting")}</em>
              </div>
            ))}
          </div>

          {result?.updateAvailable && localizedRelease ? <div className="update-release-copy"><strong>{localizedRelease.title}</strong><ul>{localizedRelease.items.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {allFailed ? <p className="update-network-advice"><span className="material-symbols-outlined" aria-hidden="true">wifi_find</span>{t("update.switchNetworkHint")}</p> : null}
        </div>

        <footer className="update-check-actions">
          <button className="ghost-button" disabled={checking} onClick={onCheck} type="button">{t("update.recheck")}</button>
          {result?.updateAvailable ? <button className="button" onClick={install} type="button">{t("common.updateNow")}</button> : <button className="button" onClick={onClose} type="button">{t("common.gotIt")}</button>}
        </footer>
      </section>
    </div>,
    document.body
  );
}
