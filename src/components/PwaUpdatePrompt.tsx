import { useEffect, useState } from "react";
import { activatePwaUpdate, PWA_UPDATE_AVAILABLE_EVENT } from "../lib/pwaUpdate";
import { useI18n } from "../lib/language";

export function PwaUpdatePrompt() {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const show = () => setAvailable(true);
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, show);
    return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, show);
  }, []);

  if (!available) return null;

  const update = () => {
    setUpdating(true);
    if (!activatePwaUpdate()) setUpdating(false);
  };

  return (
    <aside className="pwa-recommendation pwa-update-prompt" role="alert">
      <div className="pwa-recommendation-icon" aria-hidden="true">
        <span className="material-symbols-outlined">refresh</span>
      </div>
      <div className="pwa-recommendation-copy">
        <strong>{t("common.updateAvailable")}</strong>
        <span>{t("common.updateHint")}</span>
      </div>
      <button className="pwa-recommendation-action" disabled={updating} onClick={update} type="button">
        {updating ? t("common.updating") : t("common.updateNow")}
      </button>
    </aside>
  );
}
