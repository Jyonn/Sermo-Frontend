import { useEffect, useState } from "react";
import {
  activatePwaUpdate,
  PWA_UPDATE_AVAILABLE_EVENT,
  type ReleaseNotes,
} from "../lib/pwaUpdate";
import { useI18n } from "../lib/language";

export function PwaUpdatePrompt() {
  const { language, t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [release, setRelease] = useState<ReleaseNotes | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      setRelease((event as CustomEvent<ReleaseNotes | null>).detail);
      setAvailable(true);
    };
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, show);
    return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, show);
  }, []);

  if (!available) return null;

  const update = () => {
    setUpdating(true);
    if (!activatePwaUpdate()) setUpdating(false);
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
          {release?.id ? <span>{release.id}</span> : null}
        </div>
        {localizedRelease ? (
          <ul className="pwa-update-list">
            {localizedRelease.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <span>{t("common.updateHint")}</span>
        )}
      </div>
      <button className="pwa-recommendation-action" disabled={updating} onClick={update} type="button">
        {updating ? t("common.updating") : t("common.updateNow")}
      </button>
    </aside>
  );
}
