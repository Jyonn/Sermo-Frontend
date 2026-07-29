import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  isStandalonePwa,
  markPwaRecommendationShown,
  PWA_INSTALL_STATE_EVENT,
  requestPwaInstall,
  wasPwaRecommendationShown,
} from "../lib/pwaInstall";
import { enableWebPush, getWebPushState } from "../lib/webPush";
import { PwaInstallSheet } from "./PwaInstallSheet";
import { useI18n } from "../lib/language";
import { getDetectedSpaceSlug } from "../lib/spaceEntry";

type RecommendationKind = "install" | "push";

export function PwaRecommendation() {
  const { t } = useI18n();
  const { session } = useAuth();
  const location = useLocation();
  const [spaceName, setSpaceName] = useState(() => t("pwa.currentSpace"));
  const [kind, setKind] = useState<RecommendationKind | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const appName = `${spaceName} - ${t("brand.yanlang")}`;

  useEffect(() => {
    if (!session || !location.pathname.startsWith("/app")) return;
    let active = true;
    const slug = getDetectedSpaceSlug() || String(session.user.space_id);

    void api.getSpaceMe().then((space) => {
      if (active) setSpaceName(space.name);
    }).catch(() => undefined);

    const timer = window.setTimeout(() => {
      void (async () => {
        const standalone = isStandalonePwa();
        const nextKind: RecommendationKind = standalone ? "push" : "install";
        if (wasPwaRecommendationShown(slug, nextKind)) return;
        if (standalone && await getWebPushState() === "on") return;
        markPwaRecommendationShown(slug, nextKind);
        if (active) setKind(nextKind);
      })();
    }, 900);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [location.pathname, session?.accessToken, session?.user.space_id, session?.user.user_id]);

  useEffect(() => {
    const handleInstalled = () => {
      if (!isStandalonePwa()) return;
      setKind(null);
      setInstallGuideOpen(false);
    };
    window.addEventListener(PWA_INSTALL_STATE_EVENT, handleInstalled);
    return () => window.removeEventListener(PWA_INSTALL_STATE_EVENT, handleInstalled);
  }, []);

  const act = async () => {
    if (!kind || busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "install") {
        const outcome = await requestPwaInstall();
        if (outcome === "unavailable") {
          setInstallGuideOpen(true);
        } else if (outcome === "accepted") {
          setKind(null);
        }
      } else {
        await enableWebPush();
        setKind(null);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("common.operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!kind) return <PwaInstallSheet onClose={() => setInstallGuideOpen(false)} open={installGuideOpen} spaceName={spaceName} />;

  return (
    <>
      <aside className="pwa-recommendation" role="status">
        <button className="pwa-recommendation-dismiss" onClick={() => setKind(null)} type="button" aria-label={t("pwa.dismiss")}>
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="pwa-recommendation-icon" aria-hidden="true">
          <span className="pwa-symbol">{kind === "install" ? "+" : "!"}</span>
        </div>
        <div className="pwa-recommendation-copy">
          <strong>{kind === "install" ? t("pwa.installTitle", { name: appName }) : t("pwa.enableNotifications")}</strong>
          <span>{kind === "install" ? t("pwa.installHint") : t("pwa.notificationHint")}</span>
          {error ? <span className="pwa-recommendation-error">{error}</span> : null}
        </div>
        <button className="pwa-recommendation-action" disabled={busy} onClick={() => void act()} type="button">
          {busy ? t("pwa.wait") : kind === "install" ? t("pwa.install") : t("pwa.enable")}
        </button>
      </aside>
      <PwaInstallSheet onClose={() => setInstallGuideOpen(false)} open={installGuideOpen} spaceName={spaceName} />
    </>
  );
}
