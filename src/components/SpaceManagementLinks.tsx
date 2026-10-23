import { useI18n } from "../lib/language";
import { buildAdminEntryHref } from "../lib/spaceEntry";
import "./SpaceManagementLinks.css";

export function SpaceManagementLinks({ slug, disabled = false }: { slug?: string; disabled?: boolean }) {
  const { t } = useI18n();
  return <nav className="space-management-links" aria-label={t("landing.spaceManagement")}>
    <a aria-disabled={disabled || undefined} href={disabled ? undefined : buildAdminEntryHref("create")} tabIndex={disabled ? -1 : undefined}>
      <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>{t("landing.createNewSpace")}
    </a>
    <a aria-disabled={disabled || undefined} href={disabled ? undefined : buildAdminEntryHref("login", slug)} tabIndex={disabled ? -1 : undefined}>
      <span className="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>{t("landing.adminLogin")}
    </a>
  </nav>;
}
