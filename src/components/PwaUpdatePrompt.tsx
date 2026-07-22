import { useEffect, useState } from "react";
import { activatePwaUpdate, PWA_UPDATE_AVAILABLE_EVENT } from "../lib/pwaUpdate";

export function PwaUpdatePrompt() {
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
        <strong>发现新版本</strong>
        <span>更新后即可使用最新功能</span>
      </div>
      <button className="pwa-recommendation-action" disabled={updating} onClick={update} type="button">
        {updating ? "更新中" : "立即更新"}
      </button>
    </aside>
  );
}
