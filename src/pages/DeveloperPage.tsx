import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { FeedbackState } from "../components/FeedbackState";
import { OAuthApplicationWorkspace } from "../components/OAuthApplicationWorkspace";
import { TabPageHeader } from "../components/TabPageHeader";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { canManageOAuthApplications } from "../lib/oauthDeveloperAccess";
import type { SpaceDTO } from "../types";

export default function DeveloperPage() {
  const { session } = useAuth();
  const { t } = useI18n();
  const spaceId = session?.user.space_id;
  const [result, setResult] = useState<{ spaceId: number; space?: SpaceDTO; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!spaceId) return;
    const controller = new AbortController();
    setResult(null);
    void api.getSpaceMe(controller.signal).then((space) => {
      if (!controller.signal.aborted) setResult({ spaceId, space });
    }).catch((cause) => {
      if (!controller.signal.aborted) setResult({ spaceId, error: cause instanceof Error ? cause.message : t("apps.authorizeFailed") });
    });
    return () => controller.abort();
  }, [spaceId, retry, t]);
  const current = result?.spaceId === spaceId ? result : null;
  if (current?.space && !canManageOAuthApplications(current.space, spaceId)) return <Navigate replace to="/app/menu" />;
  return <AppChrome title={t("nav.developer")} hideTopbar shellClassName="desktop-tab-shell developer-tab-shell">
    <section className="page-stack">
      <TabPageHeader title={t("nav.developer")} />
      {current?.space ? <OAuthApplicationWorkspace key={spaceId} /> : current?.error ? <FeedbackState tone="error" title={t("apps.authorizeFailed")} description={current.error} action={<button className="ghost-button" type="button" onClick={() => setRetry((value) => value + 1)}>{t("common.retry")}</button>} /> : <FeedbackState tone="loading" title={t("common.loading")} />}
    </section>
  </AppChrome>;
}
