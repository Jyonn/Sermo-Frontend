import { useEffect, useState } from "react";
import { useI18n } from "../lib/language";
import { approvedMigrationDestination, claimMigrationNotice, MIGRATION_NOTICE_KEY } from "../lib/siteMigration";
import { migrationDestination } from "../lib/siteOrigins";
import { BrandIcon } from "./OAuthConsentBrand";
import "../styles/site-migration.css";

export function SiteMigrationNotice() {
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (!migrationDestination(window.location.hostname)) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const check = async () => {
      try {
        const response = await fetch("/site-migration.json", { cache: "no-store", credentials: "omit", signal: controller.signal });
        if (!response.ok) return;
        const next = approvedMigrationDestination(window.location.hostname, await response.json());
        if (!active || !next) return;
        const claim = () => {
          if (active && claimMigrationNotice(window.localStorage)) setDestination(next);
        };
        if (navigator.locks) await navigator.locks.request(MIGRATION_NOTICE_KEY, claim);
        else claim();
      } catch { /* Keep the old site usable when the readiness file is unavailable. */ }
      finally { window.clearTimeout(timeout); }
    };
    void check();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, []);
  if (!destination) return null;
  return <MigrationNoticeCard destination={destination} onClose={() => setDestination(null)} />;
}

export function MigrationNoticeCard({ destination, onClose }: { destination: string; onClose: () => void }) {
  const { t } = useI18n();
  const oldBrand = t("migration.oldBrand");
  const newBrand = t("migration.newBrand");
  return (
    <aside aria-label={t("migration.title")} className="site-migration-notice">
      <div>
        <div className="migration-brand-transition">
          <div className="migration-brand"><BrandIcon className="migration-brand-icon" src="/icons/sermo-192.png" name={oldBrand} /><span>{oldBrand}</span></div>
          <svg className="migration-brand-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-5-5 5 5-5 5" /></svg>
          <div className="migration-brand"><BrandIcon className="migration-brand-icon" src="/icons/frienden-192.png?v=2" name={newBrand} /><span>{newBrand}</span></div>
        </div>
        <strong>{t("migration.title")}</strong><p>{t("migration.message")}</p><small>{t("migration.accountHint")}</small>
      </div>
      <a className="button" href={`${destination}/`} referrerPolicy="no-referrer" rel="noreferrer">{t("migration.visit")}</a>
      <button aria-label={t("common.close")} className="icon-button" onClick={onClose} type="button"><span aria-hidden="true" className="material-symbols-outlined">close</span></button>
    </aside>
  );
}
