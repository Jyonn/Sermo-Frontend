import { useEffect, useMemo, useState } from "react";
import { UserAvatar } from "../components/UserAvatar";
import { useI18n } from "../lib/language";
import { activatePwaCachedAccount, getDefaultPwaAccountKey, isPwaAutoLoginEnabled, listPwaCachedAccounts, setDefaultPwaAccountKey, setPwaAutoLoginEnabled } from "../lib/pwaAccounts";
import { buildSpaceHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";

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
  const [autoLogin, setAutoLogin] = useState(isPwaAutoLoginEnabled);
  const [spaceSlug, setSpaceSlug] = useState("");
  const [launching, setLaunching] = useState(false);
  const selectedAccount = accounts.find((account) => account.key === selectedKey) ?? null;

  const openAccount = (account: (typeof accounts)[number]) => {
    if (launching) return;
    setLaunching(true);
    activatePwaCachedAccount(account);
    window.location.replace(launchDestination(account.slug));
  };

  useEffect(() => {
    const chooseManually = new URLSearchParams(window.location.search).get("choose") === "1";
    if (!chooseManually && autoLogin && selectedAccount) openAccount(selectedAccount);
    // This launcher intentionally uses the account snapshot captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAccount = (key: string) => {
    setSelectedKey(key);
    setDefaultPwaAccountKey(key);
  };

  const toggleAutoLogin = () => {
    const next = !autoLogin;
    setAutoLogin(next);
    setPwaAutoLoginEnabled(next);
    if (next && selectedKey) setDefaultPwaAccountKey(selectedKey);
  };

  const openOtherSpace = () => {
    const slug = normalizeSlug(spaceSlug);
    if (!slug || launching) return;
    setLaunching(true);
    window.location.assign(buildSpaceHrefForCurrentHost(slug));
  };

  return (
    <main className="pwa-account-entry">
      <div className="pwa-account-entry-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <section className="pwa-account-entry-shell">
        <header className="pwa-account-entry-brand">
          <img alt="" aria-hidden="true" src="/icons/sermo-192.png?v=4" />
          <div><span>SERMO</span><strong>{t("pwa.accountEntryTitle")}</strong></div>
        </header>
        <div className="pwa-account-entry-heading">
          <p>{accounts.length ? t("pwa.accountEntryEyebrow") : t("pwa.accountEntryWelcome")}</p>
          <h1>{accounts.length ? t("pwa.chooseAccount") : t("pwa.loginToContinue")}</h1>
        </div>

        {accounts.length ? (
          <>
            <div className="pwa-account-rail" role="listbox" aria-label={t("pwa.cachedAccounts")}>
              {accounts.map((account) => {
                const selected = account.key === selectedKey;
                return (
                  <button aria-selected={selected} className={`pwa-account-card${selected ? " is-selected" : ""}`} key={account.key} onClick={() => selectAccount(account.key)} role="option" type="button">
                    <UserAvatar className="pwa-account-avatar" frame={account.session.user.avatar_frame_style} name={account.session.user.name} uri={account.session.user.avatar_uri} vip={account.session.user.is_permanent_vip} />
                    <span className="pwa-account-card-copy">
                      <strong>{account.session.user.name}</strong>
                      <small><b>{account.spaceName}</b><span>@{account.slug}</span></small>
                    </span>
                    <span className="pwa-account-check" aria-hidden="true"><i /></span>
                  </button>
                );
              })}
            </div>
            <button className={`pwa-auto-login-row${autoLogin ? " is-on" : ""}`} onClick={toggleAutoLogin} type="button">
              <span className="pwa-auto-login-mark"><span className="material-symbols-outlined">bolt</span></span>
              <span><strong>{t("pwa.autoLogin")}</strong><small>{t("pwa.autoLoginHint")}</small></span>
              <span className={`switch${autoLogin ? " active" : ""}`} aria-hidden="true" />
            </button>
            <button className="pwa-account-primary" disabled={!selectedAccount || launching} onClick={() => selectedAccount && openAccount(selectedAccount)} type="button">
              <span>{launching ? t("pwa.entering") : t("pwa.enterAccount")}</span><span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </>
        ) : null}

        <div className={`pwa-other-login${accounts.length ? " has-accounts" : ""}`}>
          <div><strong>{t("pwa.otherAccount")}</strong><small>{t("pwa.otherAccountHint")}</small></div>
          <form onSubmit={(event) => { event.preventDefault(); openOtherSpace(); }}>
            <span>@</span>
            <input aria-label={t("pwa.spaceSlug")} autoCapitalize="none" autoCorrect="off" onChange={(event) => setSpaceSlug(event.target.value)} placeholder={t("pwa.spaceSlugPlaceholder")} value={spaceSlug} />
            <button aria-label={t("pwa.continueLogin")} disabled={!spaceSlug.trim() || launching} type="submit"><span className="material-symbols-outlined">arrow_forward</span></button>
          </form>
        </div>
        <footer>{t("landing.slogan")}</footer>
      </section>
    </main>
  );
}
