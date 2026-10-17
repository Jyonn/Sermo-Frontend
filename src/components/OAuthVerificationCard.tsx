import { Link } from "react-router-dom";
import { useI18n } from "../lib/language";
import { oauthVerificationTarget, type OAuthEligibility } from "../lib/oauthConsent";
import { rememberOAuthRequest } from "../lib/oauthPending";
import { ContactChannelIcon } from "./ContactChannelIcon";

export function OAuthVerificationCard({ eligibility, search, failed, onReload }: {
  eligibility: OAuthEligibility | null | undefined; search: string; failed: boolean; onReload: () => void;
}) {
  const { t } = useI18n();
  if (!eligibility) return <div className="oauth-verification-loading" role="status"><span>{t(failed ? "apps.verificationCheckFailed" : "apps.checkingVerification")}</span>{failed ? <button type="button" className="oauth-text-button" onClick={onReload}>{t("common.retry")}</button> : null}</div>;
  if (eligibility.eligible) return null;
  return <section className="oauth-verification-card" aria-labelledby="oauth-verification-title">
    <header><span className="material-symbols-outlined" aria-hidden="true">shield</span><div><h2 id="oauth-verification-title">{t("apps.finishVerification")}</h2><p>{t("apps.verificationGuide")}</p></div></header>
    <div className="oauth-verification-steps">
      {(["email", "phone"] as const).map(channel => {
        const missing = eligibility.missing_verifications.includes(channel);
        const content = <><ContactChannelIcon kind={channel === "email" ? "email" : "sms"} size="compact" /><span><strong>{t(channel === "email" ? "apps.emailVerification" : "apps.phoneVerification")}</strong><small>{t(missing ? "apps.verificationPending" : "apps.verificationDone")}</small></span><span className="oauth-step-action">{missing ? t("apps.verifyNow") : <span className="material-symbols-outlined" aria-label={t("apps.verificationDone")}>check_circle</span>}</span></>;
        const target = oauthVerificationTarget(channel, search);
        return missing ? <Link key={channel} className="oauth-verification-step" to={target.to} state={target.state} onClick={() => rememberOAuthRequest(search)}>{content}</Link> : <div key={channel} className="oauth-verification-step is-complete">{content}</div>;
      })}
    </div>
    <button type="button" className="oauth-text-button" onClick={onReload}>{t("apps.refreshVerification")}</button>
  </section>;
}
