import { Link } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { useI18n } from "../lib/language";

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <AppChrome
      appearanceActionsFirst
      hideMobileNav
      hidePageTitle
      publicHeader
      shellClassName="landing-facade-shell"
      showAppearanceActions
      title={t("brand.fullName")}
      topbarAction={<Link className="landing-facade-entry" to="/pwa">{t("landing.letterEnter")} <span aria-hidden="true">↗</span></Link>}
      topbarClassName="landing-facade-topbar"
      topbarLeading={
        <Link aria-label={t("brand.fullName")} className="landing-facade-brand" to="/">
          <img alt="" src="/icons/frienden-logo.svg" />
          <span>{t("brand.yanlang")}</span>
        </Link>
      }
    >
      <div className="landing-facade">
        <section className="landing-facade-hero">
          <div className="landing-facade-copy">
            <p className="landing-facade-eyebrow">{t("landing.letterEyebrow")}</p>
            <h1>
              <span>{t("landing.letterHeadlineFirst")}</span>
              <em>{t("landing.letterHeadlineSecond")}</em>
            </h1>
            <p className="landing-facade-description">{t("landing.letterDescription")}</p>
            <Link className="landing-facade-cta" to="/pwa">
              {t("landing.letterEnter")}
              <span aria-hidden="true">↗</span>
            </Link>
            <p className="landing-facade-fineprint">{t("landing.letterFineprint")}</p>
          </div>
          <div className="landing-facade-art" aria-hidden="true">
            <div className="landing-facade-paper">
              <span className="landing-facade-paper-brand">{t("brand.fullName")}</span>
              <p>{t("landing.letterCardOne")}</p>
              <small>{t("landing.letterCardOneSignoff")}</small>
            </div>
            <div className="landing-facade-paper">
              <span className="landing-facade-paper-brand">{t("brand.fullName")}</span>
              <p>{t("landing.letterCardTwo")}</p>
              <small>{t("landing.letterCardTwoSignoff")}</small>
            </div>
            <div className="landing-facade-paper">
              <span className="landing-facade-paper-brand">{t("brand.fullName")}</span>
              <p>{t("landing.letterCardThree")}</p>
              <small>FRIENDEN</small>
            </div>
            <div className="landing-facade-stamp">{t("brand.yanlang")}</div>
          </div>
        </section>
        <footer className="landing-facade-footer">
          <span>{t("landing.letterFooter")}</span>
          <span>FRIENDEN · {new Date().getFullYear()}</span>
        </footer>
      </div>
    </AppChrome>
  );
}
