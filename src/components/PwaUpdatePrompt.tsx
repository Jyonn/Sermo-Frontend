import { useState, useSyncExternalStore } from "react";
import {
  activatePwaUpdate,
  getPwaUpdateCheckSnapshot,
  subscribePwaUpdateCheck,
} from "../lib/pwaUpdate";
import { useI18n } from "../lib/language";

const DISMISSED_UPDATE_KEY = "sermo:pwa-update-dismissed";

export function PwaUpdatePrompt() {
  const { language, t } = useI18n();
  const { result } = useSyncExternalStore(subscribePwaUpdateCheck, getPwaUpdateCheckSnapshot);
  const [dismissedReleaseId, setDismissedReleaseId] = useState(() => window.localStorage.getItem(DISMISSED_UPDATE_KEY));
  const [updating, setUpdating] = useState(false);
  const releaseId = result?.latestVersion;
  const release = result?.latestRelease?.id === releaseId ? result?.latestRelease : null;
  if (!result?.updateAvailable || !releaseId || dismissedReleaseId === releaseId) return null;

  const update = () => {
    setUpdating(true);
    void activatePwaUpdate();
  };
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
        <button className="pwa-recommendation-action" disabled={updating} onClick={update} type="button">
          {updating ? t("common.updating") : t("common.updateNow")}
        </button>
      </div>
    </aside>
  );
}
