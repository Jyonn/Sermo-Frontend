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
  const initialKey = getDefaultPwaAccountKey();
  const [selectedKey, setSelectedKey] = useState(() => accounts.some((account) => account.key === initialKey) ? initialKey : accounts[0]?.key || "");
  const [spaceSlug, setSpaceSlug] = useState("");
  const [launching, setLaunching] = useState(false);
  const [otherLoginOpen, setOtherLoginOpen] = useState(accounts.length === 0);
  const selectedAccount = accounts.find((account) => account.key === selectedKey) ?? null;

  const selectAccount = (key: string) => {
    setSelectedKey(key);
    setDefaultPwaAccountKey(key);
  };

  const openAccount = (account: (typeof accounts)[number]) => {
    if (launching) return;
    setLaunching(true);
    activatePwaCachedAccount(account);
    window.location.replace(launchDestination(account.slug));
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
        <header className="pwa-account-entry-brand">
          <img alt="" aria-hidden="true" src="/icons/sermo-512.png?v=6" />
          <div><span>WEB APP</span><strong>{t("brand.fullName")}</strong></div>
        </header>
        <div className="pwa-account-entry-heading">
          <p>{t("pwa.accountEntryEyebrow")}</p>
          <h1>{accounts.length ? t("pwa.accountEntryWelcome") : t("pwa.loginToContinue")}</h1>
          <small>{accounts.length ? t("pwa.chooseAccount") : t("pwa.otherAccountHint")}</small>
        </div>

        {accounts.length ? (
          <>
            <div className="pwa-account-rail" role="listbox" aria-label={t("pwa.cachedAccounts")}>
              {accounts.map((account) => {
                const selected = account.key === selectedKey;
                return (
                  <button aria-selected={selected} className={`pwa-account-card${selected ? " is-selected" : ""}`} key={account.key} onClick={() => selectAccount(account.key)} role="option" type="button">
                    <UserAvatar className="pwa-account-avatar" frame={account.session.user.avatar_frame_style} name={account.session.user.name} uri={account.session.user.avatar_uri} />
                    <span className="pwa-account-card-copy"><strong>{account.session.user.name}</strong><small><b>{account.spaceName}</b><span>@{account.slug}</span></small></span>
                    <span className="pwa-account-check" aria-hidden="true"><i /></span>
                  </button>
                );
              })}
            </div>
            <button className="pwa-account-primary" disabled={!selectedAccount || launching} onClick={() => selectedAccount && openAccount(selectedAccount)} type="button">
              <span>{launching ? t("pwa.entering") : t("pwa.enterAccount")}</span><span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </>
        ) : null}

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
      </section>
    </main>
  );
}
