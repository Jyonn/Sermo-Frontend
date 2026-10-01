import { useLocation } from "react-router-dom";

import { useI18n } from "../lib/language";

export function RouteResourceState({ status }: { status: "loading" | "error" }) {
  const { t } = useI18n();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");

  return (
    <main className={`auth-restore-screen route-resource-screen${isAppRoute ? " is-app-route" : ""}`}>
      {status === "loading" ? (
        <div className="auth-restore-inline" role="status">
          <span className="auth-restore-spinner" aria-hidden="true" />
          <span>{t("common.loading")}</span>
        </div>
      ) : (
        <div className="route-resource-error" role="alert">
          <strong>{t("common.resourceLoadFailed")}</strong>
          <p>{t("common.resourceLoadFailedHint")}</p>
          <button onClick={() => window.location.reload()} type="button">{t("common.retry")}</button>
        </div>
      )}
    </main>
  );
}
