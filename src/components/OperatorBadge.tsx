import { useI18n } from "../lib/language";

export function OperatorBadge() {
  const { t } = useI18n();
  return <span className="operator-badge" title={t("profile.operatorAccount")}><span className="material-symbols-outlined" aria-hidden="true">verified</span>{t("profile.operator")}</span>;
}
