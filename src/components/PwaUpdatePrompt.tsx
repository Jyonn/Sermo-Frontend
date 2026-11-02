import { useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPwaUpdateCheckSnapshot,
  subscribePwaUpdateCheck,
} from "../lib/pwaUpdate";
import { useI18n } from "../lib/language";

const DISMISSED_UPDATE_KEY = "sermo:pwa-update-dismissed";

export function PwaUpdatePrompt() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { result } = useSyncExternalStore(subscribePwaUpdateCheck, getPwaUpdateCheckSnapshot);
  const [dismissedReleaseId, setDismissedReleaseId] = useState(() => window.localStorage.getItem(DISMISSED_UPDATE_KEY));
  const releaseId = result?.latestVersion;
  if (!result?.updateAvailable || !releaseId || dismissedReleaseId === releaseId) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, releaseId);
    setDismissedReleaseId(releaseId);
  };

  return (
    <aside className="pwa-update-prompt" role="status">
      <span className="pwa-update-dot" aria-hidden="true" />
      <span className="pwa-update-label">{t("common.updateAvailable")}</span>
      <div className="pwa-update-actions">
        <button onClick={dismiss} type="button">{t("common.gotIt")}</button>
        <button className="pwa-update-view" onClick={() => { dismiss(); navigate("/app/menu?check-update=1"); }} type="button">{t("update.view")}</button>
      </div>
    </aside>
  );
}
