import { useEffect, useMemo, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { InputDialog } from "../components/InputDialog";
import { buildAdminEntryHref, buildJoinHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";
import { listRecentSpaces, type RecentSpaceEntry } from "../lib/recentSpaces";
import { useI18n } from "../lib/language";

export default function LandingPage() {
  const { t } = useI18n();
  const [slugInput, setSlugInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [recentSpaces, setRecentSpaces] = useState<RecentSpaceEntry[]>([]);
  const normalizedSlug = useMemo(() => normalizeSlug(slugInput), [slugInput]);

  useEffect(() => {
    setRecentSpaces(listRecentSpaces());
  }, []);

  const joinSpace = () => {
    if (!normalizedSlug) {
      setSubmitError(t("landing.slugRequired"));
      return;
    }

    setJoinDialogOpen(false);
    window.location.assign(buildJoinHrefForCurrentHost(normalizedSlug));
  };

  return (
    <AppChrome
      hidePageTitle
      publicHeader
      title={t("brand.fullName")}
      topbarAction={
        <>
          <a className="ghost-chip" href={buildAdminEntryHref("create")}>
            {t("landing.createSpace")}
          </a>
          <button className="ghost-chip" onClick={() => setJoinDialogOpen(true)} type="button">
            {t("landing.joinSpace")}
          </button>
        </>
      }
    >
      <div className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">{t("brand.fullName")}</p>
            <h1>{t("landing.slogan")}</h1>
            <p className="landing-description">{t("landing.description")}</p>
            <div className="landing-actions">
              <a className="button" href={buildAdminEntryHref("create")}>
                {t("landing.createMine")}
              </a>
              <button className="ghost-button landing-secondary" onClick={() => setJoinDialogOpen(true)} type="button">
                {t("landing.joinSpace")}
              </button>
            </div>
          </div>
        </section>

        {recentSpaces.length ? (
          <section className="landing-entry-panel">
            <div className="landing-entry-copy">
              <p className="landing-eyebrow">{t("landing.myEntrancesEyebrow")}</p>
              <h2>{t("landing.myEntrances")}</h2>
              <p>{t("landing.entrancesHint")}</p>
            </div>
            <div className="landing-entry-list">
              {recentSpaces.map((space) => (
                <a className="landing-entry-item" href={buildJoinHrefForCurrentHost(space.slug)} key={space.slug}>
                  <div className="landing-entry-main">
                    <strong>{space.name}</strong>
                    <span>{space.domain}</span>
                  </div>
                  <span className="landing-entry-action">{t("landing.enter")}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <InputDialog
        confirmLabel={t("landing.enterSpace")}
        onChange={setSlugInput}
        onClose={() => setJoinDialogOpen(false)}
        onConfirm={joinSpace}
        open={joinDialogOpen}
        placeholder={t("landing.slugPlaceholder")}
        title={t("landing.joinSpace")}
        value={slugInput}
      />
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
