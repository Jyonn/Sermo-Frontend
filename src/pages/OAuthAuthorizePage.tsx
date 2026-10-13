import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import stillfolioMark from "../assets/stillfolio-mark.svg";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { clearOAuthRequest, rememberOAuthRequest } from "../lib/oauthPending";
import "./MoreApps.css";

const CALLBACK = String(import.meta.env.VITE_STILLFOLIO_CALLBACK_URI || "https://stillfolio.jyonn.space/auth/sermo/callback");
const SCOPES = new Set(["profile", "phone", "vip"]);

export default function OAuthAuthorizePage() {
  const { t } = useI18n();
  const { search } = useLocation();
  const { ready, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const query = new URLSearchParams(search);
  const scope = query.get("scope") || "";
  const scopes = scope.split(/\s+/).filter(Boolean);
  const valid = query.get("client_id") === "stillfolio"
    && query.get("response_type") === "code"
    && query.get("redirect_uri") === CALLBACK
    && query.get("code_challenge_method") === "S256"
    && /^[A-Za-z0-9_-]{43}$/.test(query.get("code_challenge") || "")
    && (query.get("state") || "").length >= 16
    && scopes.length > 0 && scopes.every((item) => SCOPES.has(item));

  useEffect(() => {
    if (ready && !session && valid) rememberOAuthRequest(search);
    if (ready && session) clearOAuthRequest();
  }, [ready, session, valid, search]);
  useEffect(() => {
    if (!session || !valid) return;
    let active = true;
    void api.getSpaceMe().then((space) => { if (active) setSpaceName(space.name); }).catch(() => undefined);
    return () => { active = false; };
  }, [session?.user.space_id, valid]);

  const approve = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.authorizeExternalApp({
        client_id: "stillfolio",
        redirect_uri: CALLBACK,
        scope,
        state: query.get("state") || "",
        code_challenge: query.get("code_challenge") || "",
        code_challenge_method: "S256",
        response_type: "code",
      });
      const destination = new URL(result.redirect_uri);
      if (`${destination.origin}${destination.pathname}` !== CALLBACK) throw new Error(t("apps.authorizeFailed"));
      window.location.assign(destination.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("apps.authorizeFailed"));
      setBusy(false);
    }
  };

  return <main className="oauth-authorize-page">
    <section className="oauth-authorize-card">
      <img alt="" src={stillfolioMark} />
      <small>SERMO × STILLFOLIO</small>
      <h1>{t("apps.authorizeTitle")}</h1>
      {!valid ? <p>{t("apps.invalidRequest")}</p> : !ready ? <p>{t("auth.restoring")}</p> : !session ? <><p>{t("apps.signInFirst")}</p><Link to="/">{t("apps.backToSermo")}</Link></> : <>
        <p>{t("apps.authorizeDescription", { name: session.user.name, space: spaceName || `#${session.user.space_id}` })}</p>
        <div className="oauth-authorize-scopes">
          {scopes.map((item) => <span key={item}>{t(`apps.scope.${item}` as "apps.scope.profile")}</span>)}
        </div>
        <p className="oauth-authorize-note">{t("apps.authorizeNote")}</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="oauth-authorize-actions"><Link onClick={clearOAuthRequest} to="/app/menu">{t("common.cancel")}</Link><button disabled={busy} onClick={() => void approve()} type="button">{busy ? t("common.loading") : t("apps.allow")}</button></div>
      </>}
    </section>
  </main>;
}
