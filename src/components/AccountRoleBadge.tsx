import { useI18n } from "../lib/language";

const roles = {
  official: { icon: "verified", label: "profile.officialAccount" },
  operator: { icon: "shield_person", label: "profile.operatorAccount" },
} as const;

export function AccountRoleBadge({ kind }: { kind: keyof typeof roles }) {
  const { t } = useI18n();
  const { icon, label } = roles[kind];
  const name = t(label);
  return (
    <span className={`account-role-badge account-role-badge--${kind}`} role="img" aria-label={name} title={name}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </span>
  );
}
