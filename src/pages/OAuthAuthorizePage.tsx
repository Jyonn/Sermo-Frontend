import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import stillfolioMark from "../assets/stillfolio-mark.svg";
import chronelleIcon from "../assets/chronelle-icon.png";
import { oauthClient } from "../lib/oauthClients";
import { api, refreshDetachedAuthSession } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { clearOAuthRequest, rememberOAuthRequest } from "../lib/oauthPending";
import { activatePwaCachedAccount, listPwaCachedAccounts, refreshPwaCachedAccounts, type PwaCachedAccount } from "../lib/pwaAccounts";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { parseSermoLoginHint } from "../lib/stillfolioLogin";
import "./MoreApps.css";

const CALLBACK = String(import.meta.env.VITE_STILLFOLIO_CALLBACK_URI || "https://stillfolio.jyonn.space/auth/sermo/callback");

export default function OAuthAuthorizePage() {
  const { t } = useI18n();
  const { search } = useLocation();
  const { ready, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [accounts, setAccounts] = useState(listPwaCachedAccounts);
  const [accountsRefreshing, setAccountsRefreshing] = useState(false);
  const [selectingAccount, setSelectingAccount] = useState("");
  const [accountError, setAccountError] = useState("");
  const autoRestoreStarted = useRef(false);
  const query = new URLSearchParams(search);
  const client = oauthClient(query.get("client_id"), CALLBACK);
  const appName = client ? t(client.nameKey) : "";
  const loginHint = parseSermoLoginHint(query.get("login_hint"));
  const authorizedSession = session && (!loginHint || loginHint.userId === session.user.user_id && loginHint.slug === getDetectedSpaceSlug()) ? session : null;
  const accountToRestore = loginHint
    ? accounts.find((account) => account.slug === loginHint.slug && account.session.user.user_id === loginHint.userId)
    : accounts.length === 1 ? accounts[0] : undefined;
  const scope = query.get("scope") || "";
  const scopes = scope.split(/\s+/).filter(Boolean);
  const valid = Boolean(client)
    && query.get("response_type") === "code"
    && query.get("redirect_uri") === client?.callback
    && query.get("code_challenge_method") === "S256"
    && /^[A-Za-z0-9_-]{43}$/.test(query.get("code_challenge") || "")
    && (query.get("state") || "").length >= 16
    && (query.get("state") || "").length <= 512
    && query.getAll("login_hint").length <= 1
    && (!query.has("login_hint") || Boolean(loginHint))
    && scopes.length > 0 && scopes.every((item) => client?.scopes.includes(item));

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
    if (selectingAccount || accountsRefreshing) return;
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
    if (!ready || !valid || authorizedSession || accountToRestore) return;
    let active = true;
    setAccountsRefreshing(true);
    void refreshPwaCachedAccounts().then((next) => { if (active) { setAccountsRefreshing(false); setAccounts(next); } })
      .catch(() => undefined).finally(() => { if (active) setAccountsRefreshing(false); });
    return () => { active = false; };
  }, [ready, valid, Boolean(authorizedSession), Boolean(accountToRestore)]);

  useEffect(() => {
    if (ready && valid && !authorizedSession && accountToRestore && !autoRestoreStarted.current) {
      autoRestoreStarted.current = true;
      void selectAccount(accountToRestore);
    }
  }, [ready, valid, authorizedSession, accountToRestore]);

  const approve = async () => {
    if (!valid || busy || !authorizedSession || !client) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.authorizeExternalApp({
        client_id: client.id,
        redirect_uri: client.callback,
        scope,
        state: query.get("state") || "",
        code_challenge: query.get("code_challenge") || "",
        code_challenge_method: "S256",
        response_type: "code",
      });
      const destination = new URL(result.redirect_uri);
      if (`${destination.origin}${destination.pathname}` !== client.callback
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
      <img alt="" src={client?.id === "supervision-local" ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='25' fill='%2379917e'/%3E%3Cpath d='M7 32a25 25 0 0 1 50 0Z' fill='%23e9eee7'/%3E%3C/svg%3E" : client?.id === "chronelle" ? chronelleIcon : stillfolioMark} />
      <small>FRIENDEN{client ? ` × ${client.label}` : ""}</small>
      <h1>{t("apps.authorizeTitle", { app: appName })}</h1>
      {!valid ? <p>{t("apps.invalidRequest")}</p> : !ready ? <p>{t("auth.restoring")}</p> : !authorizedSession ? <>
        <p>{accountsRefreshing || accountToRestore && !accountError ? t("apps.restoringAccount") : accounts.length ? t("apps.chooseAccount", { app: appName }) : t("apps.signInFirst", { app: appName })}</p>
        {accounts.length && (!accountToRestore || accountError) || accounts.length > 1 ? <div className="oauth-account-list" aria-label={t("apps.chooseAccount")}>
          {accounts.map((account) => <button disabled={Boolean(selectingAccount) || accountsRefreshing} key={account.key} onClick={() => void selectAccount(account)} type="button">
            <UserAvatar cacheKey={account.session.user.avatar_cache_key} className="oauth-account-avatar" name={account.session.user.name} uri={account.session.user.avatar_uri} />
            <span><strong>{account.session.user.name}</strong><small>{account.spaceName} · @{account.slug}</small></span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>)}
        </div> : null}
        {accountError ? <p role="alert">{accountError}</p> : null}
        <Link to="/">{t("apps.backToSermo")}</Link>
      </> : <>
        <p>{t("apps.authorizeDescription", { app: appName, name: authorizedSession.user.name, space: spaceName || `#${authorizedSession.user.space_id}` })}</p>
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
