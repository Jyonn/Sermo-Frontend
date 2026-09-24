import { useMemo, useState } from "react";
import { UserAvatar } from "../components/UserAvatar";
import { useI18n } from "../lib/language";
import { activatePwaCachedAccount, getDefaultPwaAccountKey, listPwaCachedAccounts, setDefaultPwaAccountKey } from "../lib/pwaAccounts";
import { buildJoinHrefForCurrentHost, buildSpaceHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";

function launchDestination(slug: string) {
  const shortcut = new URLSearchParams(window.location.search).get("shortcut");
  const destination = shortcut === "notifications" ? "notifications" : shortcut === "menu" ? "menu" : "chats";
  return buildSpaceHrefForCurrentHost(slug, `/app/${destination}`, "?source=pwa");
}

export default function PwaAccountEntryPage() {
  const { t } = useI18n();
  const accounts = useMemo(listPwaCachedAccounts, []);
  const spaces = useMemo(() => Array.from(accounts.reduce((grouped, account) => {
    const current = grouped.get(account.slug);
    if (current) current.accounts.push(account);
    else grouped.set(account.slug, { slug: account.slug, name: account.spaceName, accounts: [account] });
    return grouped;
  }, new Map<string, { slug: string; name: string; accounts: typeof accounts }>()).values()).sort((left, right) => left.slug.localeCompare(right.slug)), [accounts]);
  const initialKey = getDefaultPwaAccountKey();
  const [activeSpaceSlug, setActiveSpaceSlug] = useState<string | null>(null);
  const [spaceSlug, setSpaceSlug] = useState("");
  const [launching, setLaunching] = useState(false);
  const [otherLoginOpen, setOtherLoginOpen] = useState(accounts.length === 0);
  const activeSpace = spaces.find((space) => space.slug === activeSpaceSlug) ?? null;

  const openAccount = (account: (typeof accounts)[number]) => {
    if (launching) return;
    setLaunching(true);
    setDefaultPwaAccountKey(account.key);
    activatePwaCachedAccount(account);
    window.location.replace(launchDestination(account.slug));
  };

  const openSpace = (space: (typeof spaces)[number]) => {
    if (space.accounts.length === 1) openAccount(space.accounts[0]);
    else setActiveSpaceSlug(space.slug);
  };

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
        <div className="pwa-account-entry-fixed-header">
          <header className="pwa-account-entry-brand">
            <img alt="" aria-hidden="true" src="/icons/frienden-512.png?v=1" />
            <div><span>WEB APP</span><strong>{t("brand.fullName")}</strong></div>
          </header>
          <div className="pwa-account-entry-heading">
            <p>{t("pwa.accountEntryEyebrow")}</p>
            <h1>{accounts.length ? activeSpace ? activeSpace.name : t("pwa.accountEntryWelcome") : t("pwa.loginToContinue")}</h1>
            <small>{accounts.length ? activeSpace ? t("pwa.chooseAccount") : t("pwa.chooseSpace") : t("pwa.otherAccountHint")}</small>
          </div>
        </div>

        <div className="pwa-account-entry-scroll">
          {accounts.length ? activeSpace ? (
            <div className="pwa-account-rail" role="list" aria-label={t("pwa.cachedAccounts")}>
              {activeSpace.accounts.map((account) => (
                  <button className="pwa-account-card" key={account.key} onClick={() => openAccount(account)} role="listitem" type="button">
                    <UserAvatar className="pwa-account-avatar" frame={account.session.user.avatar_frame_style} name={account.session.user.name} uri={account.session.user.avatar_uri} />
                    <span className="pwa-account-card-copy"><strong>{account.session.user.name}</strong><small><b>{account.spaceName}</b><span>@{account.slug}</span></small></span>
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </button>
              ))}
            </div>
          ) : (
            <div className="pwa-account-rail" role="list" aria-label={t("pwa.cachedSpaces")}>
              {spaces.map((space) => {
                const defaultAccount = space.accounts.find((account) => account.key === initialKey) ?? space.accounts[0];
                return <button className="pwa-account-card is-space" key={space.slug} onClick={() => openSpace(space)} role="listitem" type="button">
                  <UserAvatar className="pwa-account-avatar" frame={defaultAccount.session.user.avatar_frame_style} groupMembers={space.accounts.slice(0, 4).map((account) => ({ name: account.session.user.name, uri: account.session.user.avatar_uri }))} name={space.name} uri={defaultAccount.session.user.avatar_uri} />
                  <span className="pwa-account-card-copy"><strong>{space.name}</strong><small><b>@{space.slug}</b><span>{t("pwa.accountsInSpace", { count: space.accounts.length })}</span></small></span>
                  <span className="material-symbols-outlined" aria-hidden="true">{space.accounts.length === 1 ? "arrow_forward" : "chevron_right"}</span>
                </button>;
              })}
            </div>
          ) : null}
        </div>

        <div className="pwa-account-entry-fixed-footer">
        {activeSpace ? <button className="pwa-account-space-back" onClick={() => setActiveSpaceSlug(null)} type="button"><span className="material-symbols-outlined">arrow_back</span>{t("pwa.chooseSpace")}</button> : null}
        <div className={`pwa-other-login${accounts.length ? " has-accounts" : ""}${otherLoginOpen ? " is-open" : ""}`}>
          {accounts.length ? <button className="pwa-other-login-trigger" aria-expanded={otherLoginOpen} onClick={() => setOtherLoginOpen((open) => !open)} type="button"><span className="material-symbols-outlined">person_add</span><strong>{t("pwa.otherAccount")}</strong><span className="material-symbols-outlined">{otherLoginOpen ? "expand_less" : "chevron_right"}</span></button> : null}
          <div className="pwa-other-login-panel">
            <div className="pwa-other-login-panel-inner">
              <div><strong>{accounts.length ? t("pwa.spaceSlug") : t("pwa.otherAccount")}</strong><small>{t("pwa.otherAccountHint")}</small></div>
              <form onSubmit={(event) => { event.preventDefault(); openSpaceLogin(); }}>
                <span>@</span>
                <input aria-label={t("pwa.spaceSlug")} autoCapitalize="none" autoCorrect="off" onChange={(event) => setSpaceSlug(event.target.value)} placeholder={t("pwa.spaceSlugPlaceholder")} value={spaceSlug} />
                <button aria-label={t("pwa.continueLogin")} disabled={!spaceSlug.trim() || launching} type="submit"><span className="material-symbols-outlined">arrow_forward</span></button>
              </form>
            </div>
          </div>
        </div>
        <footer>{t("landing.slogan")}</footer>
        </div>
      </section>
    </main>
  );
}
