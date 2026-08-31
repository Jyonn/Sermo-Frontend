import { useState } from "react";
import { useI18n } from "../lib/language";
import { buildJoinHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";

export default function PwaAccountEntryPage() {
  const { t } = useI18n();
  const [spaceSlug, setSpaceSlug] = useState("");
  const [launching, setLaunching] = useState(false);

  const openSpaceLogin = () => {
    const slug = normalizeSlug(spaceSlug);
    if (!slug || launching) return;
    setLaunching(true);
    window.location.assign(buildJoinHrefForCurrentHost(slug));
  };

  return (
    <main className="pwa-account-entry">
      <div className="pwa-account-entry-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <section className="pwa-account-entry-shell">
        <header className="pwa-account-entry-brand">
          <img alt="" aria-hidden="true" src="/icons/sermo-192.png?v=4" />
          <div><span>WEB APP</span><strong>{t("brand.fullName")}</strong></div>
        </header>
        <div className="pwa-account-entry-heading">
          <p>{t("pwa.accountEntryEyebrow")}</p>
          <h1>{t("pwa.loginToContinue")}</h1>
          <small>{t("pwa.otherAccountHint")}</small>
        </div>
        <div className="pwa-other-login is-open">
          <div className="pwa-other-login-panel">
            <div className="pwa-other-login-panel-inner">
              <div><strong>{t("pwa.spaceSlug")}</strong><small>{t("pwa.otherAccountHint")}</small></div>
              <form onSubmit={(event) => { event.preventDefault(); openSpaceLogin(); }}>
                <span>@</span>
                <input aria-label={t("pwa.spaceSlug")} autoCapitalize="none" autoCorrect="off" onChange={(event) => setSpaceSlug(event.target.value)} placeholder={t("pwa.spaceSlugPlaceholder")} value={spaceSlug} />
                <button aria-label={t("pwa.continueLogin")} disabled={!spaceSlug.trim() || launching} type="submit"><span className="material-symbols-outlined">arrow_forward</span></button>
              </form>
            </div>
          </div>
        </div>
        <footer>{t("landing.slogan")}</footer>
      </section>
    </main>
  );
}
