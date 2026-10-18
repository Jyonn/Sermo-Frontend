import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import { OAuthConsentBrand } from "../components/OAuthConsentBrand";
import { OAuthVerificationCard } from "../components/OAuthVerificationCard";
import { oauthVerificationTarget } from "../lib/oauthConsent";
import { validOAuthReturn, type OAuthClientMetadata } from "../lib/oauthClients";
import { api, ApiError, refreshDetachedAuthSession, getDetachedOAuthAdminStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { clearOAuthRequest, rememberOAuthRequest, rememberAdminOAuthRequest } from "../lib/oauthPending";
import { activatePwaCachedAccount, listPwaCachedAccounts, refreshPwaCachedAccounts, type PwaCachedAccount } from "../lib/pwaAccounts";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { parseSermoLoginHint } from "../lib/stillfolioLogin";
import "./MoreApps.css";

export default function OAuthAuthorizePage() {
  const { t } = useI18n();
  const { search } = useLocation();
  const { ready, session, setSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [eligibility, setEligibility] = useState<{ userId: number; value: Awaited<ReturnType<typeof api.getOAuthEligibility>> } | null>(null);
  const [eligibilityError, setEligibilityError] = useState(false);
  const [eligibilityReload, setEligibilityReload] = useState(0);
  const [spaceName, setSpaceName] = useState("");
  const [accounts, setAccounts] = useState(listPwaCachedAccounts);
  const [accountsRefreshing, setAccountsRefreshing] = useState(false);
  const [selectingAccount, setSelectingAccount] = useState("");
  const [accountError, setAccountError] = useState("");
  const [adminAccounts, setAdminAccounts] = useState<Set<string>>(new Set());
  const [adminAccountsLoading, setAdminAccountsLoading] = useState(true);
  const [choosingAccount, setChoosingAccount] = useState(false);
  const autoRestoreStarted = useRef(false);
  const [metadata, setMetadata] = useState<{ search: string; client: OAuthClientMetadata | null } | null>(null);
  const client = metadata?.search === search ? metadata.client : null;
  const requestId = new URLSearchParams(search).get("request_id");
  const query = client?.parameters ? new URLSearchParams(client.parameters) : new URLSearchParams(search);
  const targetSpace = client?.target_space;
  const appName = client?.name || "";
  useEffect(() => {
    let active = true;
    void api.getOAuthMetadata(Object.fromEntries(new URLSearchParams(search))).then((value) => {
      if (active) setMetadata({ search, client: value });
    }).catch(() => { if (active) setMetadata({ search, client: null }); });
    return () => { active = false; };
  }, [search]);
  const loginHint = parseSermoLoginHint(query.get("login_hint"));
  const authorizedSession = session && (!targetSpace || session.user.space_id === targetSpace.id) && (!loginHint || loginHint.userId === session.user.user_id && loginHint.slug === getDetectedSpaceSlug()) ? session : null;
  const eligibilityValue = eligibility?.userId === authorizedSession?.user.user_id ? eligibility?.value : null;
  const nextVerification = eligibilityValue?.missing_verifications[0];
  const adminProof = client?.purpose === "space_admin";
  const adminAllowed = !adminProof || eligibilityValue?.space_admin === true;
  useEffect(() => {
    if (!authorizedSession) return;
    const controller = new AbortController();
    setEligibility(null);
    setEligibilityError(false);
    void api.getOAuthEligibility(controller.signal).then(value => {
      if (!controller.signal.aborted) setEligibility({ userId: authorizedSession.user.user_id, value });
    }).catch(() => { if (!controller.signal.aborted) setEligibilityError(true); });
    return () => controller.abort();
  }, [authorizedSession?.user.user_id, eligibilityReload]);
  useEffect(() => {
    if (!authorizedSession) return;
    const refresh = () => { if (document.visibilityState === "visible") setEligibilityReload(value => value + 1); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [authorizedSession?.user.user_id]);
  useEffect(() => {
    if (!adminProof) return;
    const controller = new AbortController();
    setAdminAccountsLoading(true);
    setAdminAccounts(new Set());
    void Promise.all(accounts.map(async account => {
      try { return await getDetachedOAuthAdminStatus(account.session, controller.signal) ? account.key : null; }
      catch { return null; }
    })).then(keys => {
      if (controller.signal.aborted) return;
      setAdminAccounts(new Set(keys.filter((key): key is string => key !== null)));
      setAdminAccountsLoading(false);
    });
    return () => controller.abort();
  }, [accounts, adminProof]);
  const matchingAccounts = accounts.filter(account => (!targetSpace || account.session.user.space_id === targetSpace.id) && (!adminProof || adminAccounts.has(account.key)));
  const accountToRestore = loginHint
    ? matchingAccounts.find((account) => account.slug === loginHint.slug && account.session.user.user_id === loginHint.userId)
    : !adminProof && matchingAccounts.length === 1 ? matchingAccounts[0] : undefined;
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
      if (targetSpace && refreshed.user.space_id !== targetSpace.id) throw new Error("Wrong space");
      if (adminProof && !await getDetachedOAuthAdminStatus(refreshed)) throw new Error("Administrator required");
      activatePwaCachedAccount({ ...account, session: refreshed });
      const nextQuery = new URLSearchParams(search);
      if (!requestId) nextQuery.set("login_hint", `${account.slug}:${refreshed.user.user_id}`);
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
    if (!valid || busy || !authorizedSession || !client || !eligibilityValue?.eligible || !adminAllowed) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.authorizeExternalApp(requestId ? { request_id: requestId } : {
        client_id: client.id,
        redirect_uri: client.callback,
        scope,
        state: query.get("state") || "",
        code_challenge: query.get("code_challenge") || "",
        code_challenge_method: "S256",
        response_type: "code",
      });
      const destination = new URL(result.redirect_uri);
      if (!validOAuthReturn(destination.href, client.callback, query.get("state") || "")) throw new Error(t("apps.authorizeFailed"));
      clearOAuthRequest();
      window.location.assign(destination.href);
    } catch (cause) {
      if (cause instanceof ApiError && cause.identifier === "verification_required") {
        setEligibility(null);
        setEligibilityReload(value => value + 1);
        setError("");
      } else setError(cause instanceof Error ? cause.message : t("apps.authorizeFailed"));
      setBusy(false);
    }
  };

  const cancel = () => {
    clearOAuthRequest();
    if (requestId) void api.cancelOAuthRequest(requestId).catch(() => undefined);
  };

  const showChooser = !authorizedSession || choosingAccount || adminProof && !adminAllowed;
  const checkingAccounts = accountsRefreshing || adminProof && adminAccountsLoading;
  const adminLogin = <Link className="oauth-secondary" onClick={() => rememberAdminOAuthRequest(search)} to="/space?mode=login&oauth_switch=1">{t("apps.adminLoginShort")}</Link>;

  return <main className="oauth-authorize-page">
    <section className="oauth-authorize-card">
      <OAuthConsentBrand client={client} />
      <div className="oauth-consent-heading"><small>{t("apps.withFrienden")}</small><h1>{client ? t("apps.continueTo", { app: appName }) : t("apps.signInHeading")}</h1></div>
      {metadata?.search !== search ? <p>{t("common.loading")}</p> : !valid ? <p>{t("apps.invalidRequest")}</p> : !ready ? <p>{t("auth.restoring")}</p> : showChooser ? <>
        <p>{t(adminProof ? "apps.chooseAdminShort" : "apps.chooseAccount", { app: appName })}</p>
        {checkingAccounts ? <p role="status">{t("common.loading")}</p> : matchingAccounts.length ? <div className="oauth-account-list" aria-label={t("apps.chooseAccount")}>
          {matchingAccounts.map(account => <button disabled={Boolean(selectingAccount)} key={account.key} onClick={() => void selectAccount(account)} type="button">
            <UserAvatar cacheKey={account.session.user.avatar_cache_key} className="oauth-account-avatar" name={account.session.user.name} uri={account.session.user.avatar_uri} />
            <span><strong>{account.session.user.name}</strong><small>{account.spaceName} · @{account.slug}</small></span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>)}
        </div> : <p>{t(adminProof ? "apps.noAdminShort" : "apps.signInFirst", { app: appName })}</p>}
        {accountError ? <p role="alert">{accountError}</p> : null}
        {eligibilityError ? <button className="oauth-text-button" type="button" onClick={() => setEligibilityReload(value => value + 1)}>{t("common.retry")}</button> : null}
        <div className="oauth-entry-actions">
          {adminProof ? adminLogin : <Link className="oauth-secondary" onClick={() => { rememberOAuthRequest(search); if (targetSpace && session?.user.space_id !== targetSpace.id) setSession(null); }} to={targetSpace ? buildSpaceHrefForCurrentHost(targetSpace.slug, "/") : "/"}>{t("apps.backToSermo")}</Link>}
          <Link className="oauth-quiet" onClick={cancel} to="/">{t("common.cancel")}</Link>
        </div>
      </> : <>
        <div className="oauth-selected-account">
          <div className="oauth-consent-identity"><UserAvatar className="oauth-account-avatar" name={authorizedSession!.user.name} uri={authorizedSession!.user.avatar_uri} cacheKey={authorizedSession!.user.avatar_cache_key} /><div><strong>{authorizedSession!.user.name}</strong><small>{spaceName || targetSpace?.name || `#${authorizedSession!.user.space_id}`}</small></div></div>
          <button className="oauth-switch-account" type="button" onClick={() => setChoosingAccount(true)}>{t("apps.switchAccountShort")}</button>
        </div>
        <OAuthVerificationCard eligibility={eligibilityValue} search={search} failed={eligibilityError} onReload={() => setEligibilityReload(value => value + 1)} />
        <section className="oauth-authorize-scopes" aria-label={t("apps.sharedInformation")}>
          <small>{t("apps.sharedInformation")}</small>
          {scopes.map(item => <span key={item}>{t(`apps.scope.${item}` as "apps.scope.profile")}</span>)}
          {adminProof ? <span>{t("apps.adminProofShort")}</span> : null}
        </section>
        {error ? <p role="alert">{error}</p> : null}
        <div className="oauth-authorize-actions">
          <Link className="oauth-cancel" onClick={cancel} to="/app/menu">{t("common.cancel")}</Link>
          {eligibilityValue?.eligible ? <button className="oauth-primary" disabled={busy || !adminAllowed} onClick={() => void approve()} type="button">{busy ? t("common.loading") : t("apps.allow")}</button> : nextVerification ? <Link className="oauth-primary" to={oauthVerificationTarget(nextVerification, search).to} state={oauthVerificationTarget(nextVerification, search).state} onClick={() => rememberOAuthRequest(search)}>{t(nextVerification === "email" ? "apps.verifyEmailAction" : "apps.verifyPhoneAction")}</Link> : <button className="oauth-primary" type="button" disabled>{t("apps.checkingVerification")}</button>}
        </div>
      </>}
    </section>
  </main>;
}
