import { useI18n } from "../lib/language";

interface OfficialBadgeProps {
  className?: string;
}

export function OfficialBadge({ className = "" }: OfficialBadgeProps) {
  const { t } = useI18n();

  return (
    <span className={`official-badge${className ? ` ${className}` : ""}`} title={t("profile.officialAccount")}>
      <span className="material-symbols-outlined" aria-hidden="true">verified</span>
      {t("profile.official")}
    </span>
  );
}
