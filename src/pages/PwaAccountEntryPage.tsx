import { useEffect, useMemo, useState } from "react";
import { SpaceAvatar, UserAvatar } from "../components/UserAvatar";
import type { JoinResponseDTO, SpaceDTO } from "../types";
import JoinSpacePage from "./JoinSpacePage";
import "./PwaAccountEntryPage.css";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { activatePwaCachedAccount, listPwaCachedAccounts, refreshPwaCachedAccounts, setDefaultPwaAccountKey } from "../lib/pwaAccounts";
import { listRecentSpaces, rememberRecentSpace } from "../lib/recentSpaces";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";
import { isOAuthLoginPending, completeOAuthLogin, readOAuthRequest, oauthReturnForAccount } from "../lib/oauthPending";

function launchDestination(slug: string) {
  const shortcut = new URLSearchParams(window.location.search).get("shortcut");
  const destination = shortcut === "notifications" ? "notifications" : shortcut === "menu" ? "menu" : "chats";
  return buildSpaceHrefForCurrentHost(slug, `/app/${destination}`, "?source=pwa");
}

export default function PwaAccountEntryPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState(listPwaCachedAccounts);
  const [spaceDetails, setSpaceDetails] = useState(() => new Map<string, SpaceDTO>());
  const recentSpaces = useMemo(() => new Map(listRecentSpaces().map((space) => [space.slug, space])), [spaceDetails]);
  const spaces = useMemo(() => Array.from(accounts.reduce((grouped, account) => {
    const current = grouped.get(account.slug);
    if (current) current.accounts.push(account);
    else grouped.set(account.slug, { slug: account.slug, name: spaceDetails.get(account.slug)?.name ?? account.spaceName, accounts: [account] });
    return grouped;
  }, new Map<string, { slug: string; name: string; accounts: typeof accounts }>()).values()).sort((left, right) => left.slug.localeCompare(right.slug)), [accounts, spaceDetails]);
  const [activeSpaceSlug, setActiveSpaceSlug] = useState<string | null>(null);
  const [spaceSlug, setSpaceSlug] = useState("");
  const [launching, setLaunching] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [otherLoginOpen, setOtherLoginOpen] = useState(accounts.length === 0);
  const activeSpace = spaces.find((space) => space.slug === activeSpaceSlug) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void refreshPwaCachedAccounts(controller.signal).then(setAccounts).catch(() => undefined);
    void Promise.allSettled(spaces.map(async (space) => {
      const detail = await api.getSpaceBySlug(space.slug, controller.signal);
      rememberRecentSpace(detail);
      return detail;
    })).then((results) => {
      const details = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (details.length) setSpaceDetails(new Map(details.map((detail) => [detail.slug, detail])));
    });
    return () => controller.abort();
  }, []);

  const openAccount = (account: (typeof accounts)[number], fromJoin = false) => {
    if (launching || (loginBusy && !fromJoin)) return;
    setLaunching(true);
    setDefaultPwaAccountKey(account.key);
    activatePwaCachedAccount(account);
    if (isOAuthLoginPending()) {
      const pending = readOAuthRequest();
      completeOAuthLogin();
      if (pending) {
        const destination = oauthReturnForAccount(pending, account.slug, account.session.user.user_id);
        window.location.replace(buildSpaceHrefForCurrentHost(account.slug, "/oauth/authorize", destination.slice("/oauth/authorize".length)));
        return;
      }
    }
    window.location.replace(launchDestination(account.slug));
  };

  const openSpace = (space: (typeof spaces)[number]) => {
    if (launching || loginBusy) return;
    if (space.accounts.length === 1) openAccount(space.accounts[0]);
    else { setOtherLoginOpen(false); setActiveSpaceSlug(space.slug); }
  };

  const openSpaceLogin = () => {
    const slug = normalizeSlug(spaceSlug);
    if (!slug || launching) return;
    if (spaces.some((space) => space.slug === slug)) {
      setActiveSpaceSlug(slug);
      setOtherLoginOpen(true);
      return;
    }
    setLaunching(true);
    window.location.assign(buildJoinHrefForCurrentHost(slug));
  };

  const joined = (payload: JoinResponseDTO) => {
    rememberRecentSpace(payload.space);
    openAccount({
      key: `${payload.space.slug}:${payload.auth.data.user_id}`,
      slug: payload.space.slug,
      spaceName: payload.space.name,
      lastVisitedAt: Date.now(),
      session: { accessToken: payload.auth.auth, refreshToken: payload.auth.refresh, user: payload.auth.data },
    }, true);
  };

  return (
    <main className="pwa-account-entry">
      <div className="pwa-account-entry-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <section className="pwa-account-entry-shell">
        <div className="pwa-account-entry-fixed-header">
          <header className="pwa-account-entry-brand">
            <img alt="" aria-hidden="true" src="/icons/frienden-512.png?v=2" />
            <div><span>WEB APP</span><strong>{t("brand.fullName")}</strong></div>
          </header>
          <div className="pwa-account-entry-heading">
            <p>{t("pwa.accountEntryEyebrow")}</p>
            <h1>{accounts.length ? activeSpace ? activeSpace.name : t("pwa.accountEntryWelcome") : t("pwa.loginToContinue")}</h1>
            <small>{accounts.length ? activeSpace ? t("pwa.chooseAccount") : t("pwa.chooseSpace") : t("pwa.otherAccountHint")}</small>
          </div>
        </div>

        <div className={`pwa-account-entry-content${activeSpace && otherLoginOpen ? " is-login-open" : ""}`}>
        <div className="pwa-account-entry-scroll">
          {accounts.length ? activeSpace ? (
            <div className="pwa-account-rail" role="list" aria-label={t("pwa.cachedAccounts")}>
              {activeSpace.accounts.map((account) => (
                  <button className="pwa-account-card" disabled={launching || loginBusy} key={account.key} onClick={() => openAccount(account)} role="listitem" type="button">
                    <UserAvatar cacheKey={account.session.user.avatar_cache_key} className="pwa-account-avatar" frame={account.session.user.avatar_frame_style} name={account.session.user.name} uri={account.session.user.avatar_uri} />
                    <span className="pwa-account-card-copy"><strong>{account.session.user.name}</strong><small><b>{account.spaceName}</b><span>@{account.slug}</span></small></span>
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </button>
              ))}
            </div>
          ) : (
            <div className="pwa-account-rail" role="list" aria-label={t("pwa.cachedSpaces")}>
              {spaces.map((space) => {
                const officialUser = spaceDetails.get(space.slug)?.official_user ?? recentSpaces.get(space.slug)?.officialUser;
                return <button className="pwa-account-card is-space" disabled={launching || loginBusy} key={space.slug} onClick={() => openSpace(space)} role="listitem" type="button">
                  <SpaceAvatar cacheKey={officialUser?.avatar_cache_key} className="pwa-account-avatar" name={officialUser?.name ?? space.name} uri={officialUser?.avatar_uri} />
                  <span className="pwa-account-card-copy"><strong>{space.name}</strong><small><b>@{space.slug}</b></small></span>
                  <span className="material-symbols-outlined" aria-hidden="true">{space.accounts.length === 1 ? "arrow_forward" : "chevron_right"}</span>
                </button>;
              })}
            </div>
          ) : null}
        </div>

        <div className="pwa-account-entry-fixed-footer">
        {activeSpace ? <button className="pwa-account-space-back" disabled={loginBusy || launching} onClick={() => { setActiveSpaceSlug(null); setOtherLoginOpen(false); }} type="button"><span className="material-symbols-outlined">arrow_back</span>{t("pwa.chooseSpace")}</button> : null}
        <div className={`pwa-other-login${accounts.length ? " has-accounts" : ""}${otherLoginOpen ? " is-open" : ""}`}>
          {accounts.length ? <button className="pwa-other-login-trigger" disabled={loginBusy || launching} aria-expanded={otherLoginOpen} onClick={() => setOtherLoginOpen((open) => !open)} type="button"><span className="material-symbols-outlined">person_add</span><strong>{t("pwa.otherAccount")}</strong><span className="material-symbols-outlined">{otherLoginOpen ? "expand_less" : "chevron_right"}</span></button> : null}
          <div className="pwa-other-login-panel">
            <div className="pwa-other-login-panel-inner">
              {activeSpace ? otherLoginOpen ? <JoinSpacePage key={activeSpace.slug} embedded spaceSlug={activeSpace.slug} onJoined={joined} onBusyChange={setLoginBusy} /> : null : otherLoginOpen ? <>
              <div><strong>{accounts.length ? t("pwa.spaceSlug") : t("pwa.otherAccount")}</strong><small>{t("pwa.otherAccountHint")}</small></div>
              <form onSubmit={(event) => { event.preventDefault(); openSpaceLogin(); }}>
                <span>@</span>
                <input aria-label={t("pwa.spaceSlug")} autoCapitalize="none" autoCorrect="off" onChange={(event) => setSpaceSlug(event.target.value)} placeholder={t("pwa.spaceSlugPlaceholder")} value={spaceSlug} />
                <button aria-label={t("pwa.continueLogin")} disabled={!spaceSlug.trim() || launching} type="submit"><span className="material-symbols-outlined">arrow_forward</span></button>
              </form>
              </> : null}
            </div>
          </div>
        </div>
        <footer>{t("landing.slogan")}</footer>
        </div>
        </div>
      </section>
    </main>
  );
}
