import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import stillfolioMark from "../assets/stillfolio-mark.svg";
import { api, refreshDetachedAuthSession } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { clearOAuthRequest, rememberOAuthRequest } from "../lib/oauthPending";
import { activatePwaCachedAccount, listPwaCachedAccounts, type PwaCachedAccount } from "../lib/pwaAccounts";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { parseSermoLoginHint } from "../lib/stillfolioLogin";
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
  const [accounts] = useState(listPwaCachedAccounts);
  const [selectingAccount, setSelectingAccount] = useState("");
  const [accountError, setAccountError] = useState("");
  const autoRestoreStarted = useRef(false);
  const query = new URLSearchParams(search);
  const loginHint = parseSermoLoginHint(query.get("login_hint"));
  const authorizedSession = session && (!loginHint || loginHint.userId === session.user.user_id && loginHint.slug === getDetectedSpaceSlug()) ? session : null;
  const accountToRestore = loginHint
    ? accounts.find((account) => account.slug === loginHint.slug && account.session.user.user_id === loginHint.userId)
    : accounts.length === 1 ? accounts[0] : undefined;
  const scope = query.get("scope") || "";
  const scopes = scope.split(/\s+/).filter(Boolean);
  const valid = query.get("client_id") === "stillfolio"
    && query.get("response_type") === "code"
    && query.get("redirect_uri") === CALLBACK
    && query.get("code_challenge_method") === "S256"
    && /^[A-Za-z0-9_-]{43}$/.test(query.get("code_challenge") || "")
    && (query.get("state") || "").length >= 16
    && query.getAll("login_hint").length <= 1
    && (!query.has("login_hint") || Boolean(loginHint))
    && scopes.length > 0 && scopes.every((item) => SCOPES.has(item));

  useEffect(() => {
    if (ready && !authorizedSession && valid) rememberOAuthRequest(search);
  }, [ready, authorizedSession, valid, search]);
  useEffect(() => {
    if (!authorizedSession || !valid) return;
    let active = true;
    void api.getSpaceMe().then((space) => { if (active) setSpaceName(space.name); }).catch(() => undefined);
    return () => { active = false; };
  }, [authorizedSession?.user.space_id, valid]);

  const selectAccount = async (account: PwaCachedAccount) => {
    if (selectingAccount) return;
    setSelectingAccount(account.key);
    setAccountError("");
    try {
      const refreshed = await refreshDetachedAuthSession(account.session);
      if (refreshed.user.user_id !== account.session.user.user_id || refreshed.user.space_id !== account.session.user.space_id) {
        throw new Error("Restored account does not match the selected identity");
      }
      activatePwaCachedAccount({ ...account, session: refreshed });
      const nextQuery = new URLSearchParams(search);
      nextQuery.set("login_hint", `${account.slug}:${refreshed.user.user_id}`);
      window.location.replace(buildSpaceHrefForCurrentHost(account.slug, "/oauth/authorize", `?${nextQuery}`));
    } catch {
      setAccountError(t("apps.accountRestoreFailed"));
      setSelectingAccount("");
    }
  };

  useEffect(() => {
    if (ready && valid && !authorizedSession && accountToRestore && !autoRestoreStarted.current) {
      autoRestoreStarted.current = true;
      void selectAccount(accountToRestore);
    }
  }, [ready, valid, authorizedSession, accountToRestore]);

  const approve = async () => {
    if (!valid || busy || !authorizedSession) return;
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
      if (`${destination.origin}${destination.pathname}` !== CALLBACK
        || !destination.searchParams.get("code")
        || destination.searchParams.get("state") !== query.get("state")
        || destination.hash) throw new Error(t("apps.authorizeFailed"));
      clearOAuthRequest();
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
      {!valid ? <p>{t("apps.invalidRequest")}</p> : !ready ? <p>{t("auth.restoring")}</p> : !authorizedSession ? <>
        <p>{accountToRestore && !accountError ? t("apps.restoringAccount") : accounts.length ? t("apps.chooseAccount") : t("apps.signInFirst")}</p>
        {accounts.length && (!accountToRestore || accountError) || accounts.length > 1 ? <div className="oauth-account-list" aria-label={t("apps.chooseAccount")}>
          {accounts.map((account) => <button disabled={Boolean(selectingAccount)} key={account.key} onClick={() => void selectAccount(account)} type="button">
            <UserAvatar className="oauth-account-avatar" name={account.session.user.name} uri={account.session.user.avatar_uri} />
            <span><strong>{account.session.user.name}</strong><small>{account.spaceName} · @{account.slug}</small></span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>)}
        </div> : null}
        {accountError ? <p role="alert">{accountError}</p> : null}
        <Link to="/">{t("apps.backToSermo")}</Link>
      </> : <>
        <p>{t("apps.authorizeDescription", { name: authorizedSession.user.name, space: spaceName || `#${authorizedSession.user.space_id}` })}</p>
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
