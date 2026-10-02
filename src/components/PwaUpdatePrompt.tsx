import { useState, useSyncExternalStore } from "react";
import {
  getPwaUpdateCheckSnapshot,
  subscribePwaUpdateCheck,
} from "../lib/pwaUpdate";
import { usePwaUpdateActivation } from "../lib/usePwaUpdateActivation";
import { useI18n } from "../lib/language";

const DISMISSED_UPDATE_KEY = "sermo:pwa-update-dismissed";

export function PwaUpdatePrompt() {
  const { language, t } = useI18n();
  const { result } = useSyncExternalStore(subscribePwaUpdateCheck, getPwaUpdateCheckSnapshot);
  const [dismissedReleaseId, setDismissedReleaseId] = useState(() => window.localStorage.getItem(DISMISSED_UPDATE_KEY));
  const { phase, install } = usePwaUpdateActivation();
  const updating = phase !== "idle" && phase !== "error";
  const releaseId = result?.latestVersion;
  const release = result?.latestRelease?.id === releaseId ? result?.latestRelease : null;
  if (!result?.updateAvailable || !releaseId || dismissedReleaseId === releaseId) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, releaseId);
    setDismissedReleaseId(releaseId);
  };
  const localizedRelease = release?.locales[language] ?? release?.locales.en;

  return (
    <aside className="pwa-recommendation pwa-update-prompt" role="alert">
      <div className="pwa-recommendation-icon" aria-hidden="true">
        <span className="material-symbols-outlined">refresh</span>
      </div>
      <div className="pwa-recommendation-copy">
        <div className="pwa-update-heading">
          <strong>{localizedRelease?.title ?? t("common.updateAvailable")}</strong>
          <span>{releaseId}</span>
        </div>
        {localizedRelease ? (
          <ul className="pwa-update-list">
            {localizedRelease.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <span>{t("common.updateHint")}</span>
        )}
      </div>
      <div className="pwa-update-actions">
        <button className="pwa-update-dismiss" disabled={updating} onClick={dismiss} type="button">{t("common.gotIt")}</button>
        <button className="pwa-recommendation-action" disabled={updating} onClick={install} type="button">
          {updating ? <span aria-hidden="true" className="media-wait-spinner" /> : null}
          {updating ? t(`update.${phase}` as "update.preparing" | "update.installing" | "update.restarting") : t("common.updateNow")}
        </button>
      </div>
      {phase === "error" ? <p className="pwa-update-error" role="alert">{t("update.installFailed")}</p> : null}
    </aside>
  );
}
