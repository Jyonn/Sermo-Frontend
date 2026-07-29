import { useI18n } from "../lib/language";

export function HeaderSyncIndicator({ syncing }: { syncing: boolean }) {
  const { t } = useI18n();
  if (!syncing) return null;
  return (
    <span aria-label={t("header.syncing")} className="header-sync-indicator" role="status">
      <span className="material-symbols-outlined">progress_activity</span>
    </span>
  );
}
